import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import { useAuth } from './AuthContext';
import optimizedChatService, { ChatMessage } from '@/services/optimizedChatService';
import { socketService } from '@/services/socketService';
import enhancedCacheService from '@/services/enhancedCacheService';
import readStatusBatchService from '@/services/readStatusBatchService';

interface ChatUser {
  id: string;
  name: string;
  profileImage?: string;
  isOnline?: boolean;
  lastSeen?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  country?: string;
  countryFlag?: string;
}

interface ActiveChat {
  conversationId: string;
  otherUser: ChatUser;
  messages: ChatMessage[];
  isLoading: boolean;
  lastActivity: Date;
  unreadCount: number;
  isTyping: boolean;
  lastMessagePreview?: string; // Preview del último mensaje desde DynamoDB
  metadata?: {
    accessCount: number;
    priority: 'high' | 'medium' | 'low';
    lastAccessTime: number;
  };
}

interface ChatContextType {
  // Estado global de chats
  activeChats: Map<string, ActiveChat>;
  currentChatId: string | null;
  isGlobalLoading: boolean;
  lastUpdateTimestamp: number; // Para forzar re-renderizaciones
  
  // Gestión de chats
  openChat: (userId: string, userInfo?: Partial<ChatUser>) => Promise<string>;
  closeChat: (conversationId: string) => void;
  setCurrentChat: (conversationId: string | null) => void;
  
  // Mensajes
  sendMessage: (conversationId: string, content: string, replyTo?: ChatMessage, messageType?: 'text' | 'image') => Promise<void>;
  getMessages: (conversationId: string) => ChatMessage[];
  markAsRead: (conversationId: string) => Promise<void>;
  
  // Utilidades
  getChatByUserId: (userId: string) => ActiveChat | null;
  getChatByConversationId: (conversationId: string) => ActiveChat | null;
  getUnreadCount: () => number;
  getUnreadCountFromDatabase: () => Promise<number>;
  preloadChat: (userId: string, userInfo?: Partial<ChatUser>) => Promise<void>;
  getOtherUserInfo: (conversationId: string) => Promise<ChatUser | null>;
  
  // Estados
  getConnectionStatus: () => any;
  refreshChats: () => Promise<void>;
  syncReadStatusQueue: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [activeChats, setActiveChats] = useState<Map<string, ActiveChat>>(new Map());
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number>(Date.now());
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  
  // Refs para optimización
  const isInitialized = useRef(false);
  const messageListenerAttached = useRef(false);
  const lastSyncTime = useRef<Date>(new Date());
  const refreshTimeout = useRef<any>(null);
  const isRefreshing = useRef(false);

  // Inicialización del proveedor de chat
  useEffect(() => {
    if (user && token && !isInitialized.current) {
      initializeChatProvider();
      isInitialized.current = true;
    } else if (!user || !token) {
      cleanup();
      isInitialized.current = false;
    }

    return () => {
      if (!user || !token) {
        cleanup();
      }
    };
  }, [user, token]);

  // Listener para cambios en el estado de la app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Inicializar el proveedor de chat
  const initializeChatProvider = async () => {
    try {
      console.log('🚀 ChatProvider: Inicializando proveedor global de chat');
      setIsGlobalLoading(true);

      // Inicializar el servicio de caché mejorado
      await enhancedCacheService.initialize();

      // Inicializar el servicio de sincronización por lotes para mensajes leídos
      await readStatusBatchService.initialize();

      // Asegurar que el servicio de chat optimizado esté inicializado
      if (!optimizedChatService.isInitialized()) {
        await optimizedChatService.initialize(user!.id);
      }

      // Configurar listeners de mensajes si no están configurados
      if (!messageListenerAttached.current) {
        optimizedChatService.onNewMessage(handleNewMessage);
        messageListenerAttached.current = true;
      }

      // Cargar conversaciones existentes y convertirlas a chats activos
      await loadExistingConversations();

      console.log('✅ ChatProvider: Proveedor de chat inicializado');
    } catch (error) {
      console.error('❌ ChatProvider: Error inicializando proveedor de chat:', error);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  // Cargar conversaciones existentes
  const loadExistingConversations = async () => {
    try {
      // Cargar conversaciones desde el servidor
      const conversations = await optimizedChatService.getConversations({ limit: 50 });
      const newActiveChats = new Map<string, ActiveChat>();

      for (const conv of conversations.items) {
        const otherUserId = conv.participants?.find((p: string) => p !== user!.id);
        if (otherUserId) {
          // Obtener mensajes desde el caché mejorado
          const cachedMessages = await enhancedCacheService.getMessages(conv.conversationId);
          
          // Aplicar estado de lectura local a los mensajes
          const messagesWithReadStatus = cachedMessages.map(message => {
            const isRead = readStatusBatchService.isMessageRead(conv.conversationId, message.messageId);
            return { ...message, read: isRead || message.read };
          });
          
          // Obtener metadata de la conversación
          const metadata = await enhancedCacheService.getConversationMetadata(conv.conversationId);
          
          // Calcular contador de no leídos considerando el estado local
          let finalUnreadCount = conv.unreadCount || metadata?.unreadCount || 0;
          
          // Si hay mensajes marcados como leídos localmente, ajustar el contador
          const locallyReadMessages = readStatusBatchService.getReadMessages(conv.conversationId);
          if (locallyReadMessages.length > 0) {
            // Contar mensajes no leídos del otro usuario que NO están marcados como leídos localmente
            const unreadFromOtherUser = messagesWithReadStatus.filter(message => {
              const isFromOtherUser = message.senderId !== user!.id;
              const isNotReadLocally = !readStatusBatchService.isMessageRead(conv.conversationId, message.messageId);
              return isFromOtherUser && isNotReadLocally;
            });
            
            finalUnreadCount = unreadFromOtherUser.length;
            console.log(`📊 ChatProvider: Ajustando contador para ${conv.conversationId}: BD=${conv.unreadCount || 0} -> Local=${finalUnreadCount} (${locallyReadMessages.length} leídos localmente)`);
          }

          // Crear chat activo con información básica
          const activeChat: ActiveChat = {
            conversationId: conv.conversationId,
            otherUser: {
              id: otherUserId,
              name: conv.otherUser?.name || metadata?.otherUserInfo?.name || `Usuario ${otherUserId.slice(-4)}`,
              profileImage: conv.otherUser?.profileImage || metadata?.otherUserInfo?.profileImage,
              isOnline: conv.otherUser?.isOnline || metadata?.otherUserInfo?.isOnline || false,
              lastSeen: conv.otherUser?.lastSeen || metadata?.otherUserInfo?.lastSeen,
              age: conv.otherUser?.age || metadata?.otherUserInfo?.age,
              gender: (conv.otherUser?.gender || metadata?.otherUserInfo?.gender) as 'male' | 'female' | 'other' | undefined,
              country: conv.otherUser?.country || metadata?.otherUserInfo?.country,
              countryFlag: conv.otherUser?.countryFlag || metadata?.otherUserInfo?.countryFlag
            },
            messages: messagesWithReadStatus,
            isLoading: false,
            lastActivity: new Date(conv.lastMessageAt || conv.updatedAt || conv.createdAt),
            unreadCount: finalUnreadCount, // Usar el contador ajustado
            isTyping: false,
            lastMessagePreview: conv.lastMessagePreview || undefined, // Usar el preview desde DynamoDB
            metadata: metadata ? {
              accessCount: metadata.accessCount,
              priority: metadata.priority,
              lastAccessTime: metadata.lastAccessTime
            } : undefined
          };

          newActiveChats.set(conv.conversationId, activeChat);

          // Actualizar metadata en el caché si no existe
          if (!metadata) {
            await enhancedCacheService.updateConversationMetadata(conv.conversationId, {
              conversationId: conv.conversationId,
              lastAccessTime: Date.now(),
              accessCount: 1,
              lastMessageAt: conv.lastMessageAt || new Date().toISOString(),
              unreadCount: conv.unreadCount || 0,
              priority: 'low',
              participants: conv.participants || [],
              otherUserInfo: {
                id: otherUserId,
                name: conv.otherUser?.name || `Usuario ${otherUserId.slice(-4)}`,
                profileImage: conv.otherUser?.profileImage,
                isOnline: conv.otherUser?.isOnline || false,
                lastSeen: conv.otherUser?.lastSeen,
                age: conv.otherUser?.age,
                gender: conv.otherUser?.gender as 'male' | 'female' | 'other',
                country: conv.otherUser?.country,
                countryFlag: conv.otherUser?.countryFlag
              },
              createdAt: conv.createdAt,
              updatedAt: conv.updatedAt || conv.createdAt
            });
          }

          // Solo cargar información del usuario si realmente es necesario
          const hasIncompleteInfo = (!conv.otherUser?.name || conv.otherUser?.name?.includes('Usuario ')) && 
                                   !conv.otherUser?.profileImage;
          
          if (hasIncompleteInfo) {
            console.log(`🔄 ChatProvider: Información básica faltante para ${otherUserId}, cargando...`);
            loadUserInfoForChat(otherUserId, conv.conversationId).catch(error => {
              console.error(`❌ ChatProvider: Error cargando información del usuario ${otherUserId}:`, error);
            });
          } else {
            console.log(`✅ ChatProvider: Usuario ${otherUserId} ya tiene información completa, omitiendo carga`);
          }
        }
      }

      // Preservar estado local de chats existentes si es más reciente
      setActiveChats(prevChats => {
        const mergedChats = new Map(newActiveChats);
        
        // Para cada chat existente, verificar si tiene estado local más reciente
        for (const [conversationId, existingChat] of prevChats) {
          const newChat = mergedChats.get(conversationId);
          
          if (newChat && existingChat.unreadCount === 0 && newChat.unreadCount > 0) {
            // Si el chat local tiene contador 0 (marcado como leído) pero el de BD tiene contador > 0,
            // preservar el estado local ya que es más reciente
            console.log(`🔄 ChatProvider: Preservando estado local para ${conversationId} (local: 0, BD: ${newChat.unreadCount})`);
            mergedChats.set(conversationId, {
              ...newChat,
              unreadCount: 0, // Preservar contador local
              messages: existingChat.messages // Preservar mensajes con estado de lectura local
            });
          }
        }
        
        return mergedChats;
      });
      
      console.log(`📱 ChatProvider: Cargados ${newActiveChats.size} chats activos con caché mejorado`);
    } catch (error) {
      console.error('❌ ChatProvider: Error cargando conversaciones existentes:', error);
    }
  };

  // Manejar cambios en el estado de la app
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log(`📱 ChatProvider: Cambio de estado de app: ${appState} -> ${nextAppState}`);
    setAppState(nextAppState);
    
    if (nextAppState === 'active' && user) {
      // App vuelve al primer plano - sincronizar chats con debouncing
      const timeSinceLastSync = Date.now() - lastSyncTime.current.getTime();
      if (timeSinceLastSync > 300000) { // Solo sincronizar si han pasado más de 5 minutos
        debouncedRefreshChats();
      }
      
      // Sincronizar cola de mensajes leídos cuando la app vuelve al primer plano
      syncReadStatusQueue().catch(error => {
        console.error('❌ ChatProvider: Error sincronizando cola al volver al primer plano:', error);
      });
    }
  };

  // Manejar nuevos mensajes
  const handleNewMessage = useCallback(async (message: ChatMessage) => {
    console.log('📨 ChatProvider: Nuevo mensaje recibido:', {
      messageId: message.messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      currentChatId
    });

    // Añadir mensaje al caché mejorado
    if (message.conversationId) {
      await enhancedCacheService.addMessage(message.conversationId, message);
    }

    setActiveChats(prevChats => {
      const newChats = new Map(prevChats);
      const chat = newChats.get(message.conversationId!);
      
      if (chat) {
        // Actualizar chat existente
        const isFromMe = message.senderId === user!.id;
        const messageExists = chat.messages.some(m => m.messageId === message.messageId);
        
        if (!messageExists) {
          // Añadir mensaje y mantener orden descendente (más recientes primero)
          const allMessages = [...chat.messages, message];
          chat.messages = allMessages.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          chat.lastActivity = new Date(message.createdAt);
          chat.lastMessagePreview = message.content; // Actualizar preview del último mensaje
          
          // Incrementar contador de no leídos solo si no es nuestro mensaje y no es el chat actual
          if (!isFromMe && currentChatId !== message.conversationId) {
            chat.unreadCount += 1;
            console.log(`📊 ChatProvider: Incrementando contador no leídos para conversación ${message.conversationId} (actual: ${currentChatId})`);
          } else if (isFromMe) {
            console.log(`📤 ChatProvider: Mensaje propio, no incrementando contador`);
          } else if (currentChatId === message.conversationId) {
            console.log(`👁️ ChatProvider: Usuario está en la conversación activa, no incrementando contador`);
          }
          
          newChats.set(message.conversationId!, chat);
        } else {
          console.log(`⚠️ ChatProvider: Mensaje duplicado ignorado - ${message.messageId}`);
        }
      } else {
        // Chat no existe, necesitamos crearlo si el mensaje es para nosotros
        const isMessageForMe = message.receiverId === user!.id || message.senderId === user!.id;
        if (isMessageForMe && message.conversationId) {
          // Crear chat inmediatamente
          createChatFromMessage(message, newChats);
          // Forzar actualización de la UI para nueva conversación
          setLastUpdateTimestamp(Date.now());
        }
      }
      
      return newChats;
    });
  }, [user, currentChatId]);

  // Crear chat desde un mensaje
  const createChatFromMessage = (message: ChatMessage, chatsMap: Map<string, ActiveChat>) => {
    const otherUserId = message.senderId === user!.id ? message.receiverId : message.senderId;
    
    // Crear chat temporal con información básica
    const newChat: ActiveChat = {
      conversationId: message.conversationId!,
      otherUser: {
        id: otherUserId,
        name: `Usuario ${otherUserId.slice(-4)}`, // Nombre temporal
        isOnline: false
      },
      messages: [message],
      isLoading: false,
      lastActivity: new Date(message.createdAt),
      unreadCount: message.senderId !== user!.id ? 1 : 0,
      isTyping: false,
      lastMessagePreview: message.content // Usar el contenido del mensaje como preview
    };

    chatsMap.set(message.conversationId!, newChat);
    console.log(`➕ ChatProvider: Nuevo chat creado desde mensaje: ${message.conversationId}`);

    // Unirse a la conversación para recibir mensajes futuros
    optimizedChatService.joinConversationWhenReady(message.conversationId!, 5000).catch(error => {
      console.error(`❌ ChatProvider: Error uniéndose a conversación ${message.conversationId}:`, error);
    });

    // Obtener información completa del usuario en paralelo
    loadUserInfoForChat(otherUserId, message.conversationId!).catch(error => {
      console.error(`❌ ChatProvider: Error cargando información del usuario ${otherUserId}:`, error);
    });
  };

  // Cargar información completa del usuario para un chat
  const loadUserInfoForChat = async (userId: string, conversationId: string) => {
    try {
      console.log(`👤 ChatProvider: Cargando información del usuario ${userId} para conversación ${conversationId}`);
      
      const apiService = (await import('@/services/apiService')).default;
      const response = await apiService.getUserById(userId);
      
      if (response.success && response.data?.user) {
        const userData = response.data.user;
        
        // Actualizar el chat con la información completa del usuario
        setActiveChats(prev => {
          const newChats = new Map(prev);
          const chat = newChats.get(conversationId);
          
          if (chat) {
            // Solo actualizar si realmente hay cambios importantes para evitar re-renders innecesarios
            // Priorizar cambios que afecten la UI (imagen, nombre, estado online)
            const hasImportantChanges = 
              (chat.otherUser.profileImage !== userData.profileImage && userData.profileImage) ||
              (chat.otherUser.name !== userData.name && !userData.name?.includes('Usuario ')) ||
              chat.otherUser.isOnline !== userData.isOnline;
            
            if (hasImportantChanges) {
              // Crear un nuevo objeto solo si hay cambios reales
              const updatedChat: ActiveChat = {
                ...chat,
                otherUser: {
                  id: userData.id,
                  name: userData.name,
                  profileImage: userData.profileImage,
                  isOnline: userData.isOnline,
                  lastSeen: userData.lastSeen,
                  age: userData.age,
                  gender: userData.gender as 'male' | 'female' | 'other',
                  country: userData.country,
                  countryFlag: userData.countryFlag
                }
              };
              newChats.set(conversationId, updatedChat);
              console.log(`✅ ChatProvider: Información del usuario actualizada para ${userData.name}`);
            } else {
              console.log(`ℹ️ ChatProvider: No hay cambios en la información del usuario ${userData.name}, omitiendo actualización`);
            }
          }
          
          return newChats;
        });

        // Forzar re-renderización de la UI
        setLastUpdateTimestamp(Date.now());
      } else {
        console.log(`⚠️ ChatProvider: No se pudo obtener información del usuario ${userId}`);
      }
    } catch (error) {
      console.error(`❌ ChatProvider: Error obteniendo información del usuario ${userId}:`, error);
    }
  };

  // Abrir un chat (crear o recuperar existente)
  const openChat = async (userId: string, userInfo?: Partial<ChatUser>): Promise<string> => {
    try {
      console.log(`🔓 ChatProvider: Abriendo chat con usuario ${userId}`);
      
      // Buscar chat existente por userId
      let existingChat = getChatByUserId(userId);
      
      if (existingChat) {
        console.log(`✅ ChatProvider: Chat existente encontrado: ${existingChat.conversationId}`);
        
        // Asegurar que estamos unidos a la conversación
        await optimizedChatService.joinConversationWhenReady(existingChat.conversationId, 5000);
        
        // Precargar mensajes si están vacíos
        if (existingChat.messages.length === 0) {
          await loadChatMessages(existingChat.conversationId);
        }
        
        return existingChat.conversationId;
      }

      // Crear nueva conversación
      const conversation = await optimizedChatService.getOrCreateConversation(userId);
      
      if (!conversation?.conversationId) {
        throw new Error('No se pudo crear la conversación');
      }

      // Crear nuevo chat activo
      const newChat: ActiveChat = {
        conversationId: conversation.conversationId,
        otherUser: {
          id: userId,
          name: userInfo?.name || `Usuario ${userId.slice(-4)}`,
          profileImage: userInfo?.profileImage,
          isOnline: userInfo?.isOnline || false,
          lastSeen: userInfo?.lastSeen,
          age: userInfo?.age,
          gender: userInfo?.gender,
          country: userInfo?.country,
          countryFlag: userInfo?.countryFlag
        },
        messages: [],
        isLoading: false,
        lastActivity: new Date(),
        unreadCount: 0,
        isTyping: false,
        lastMessagePreview: conversation.lastMessagePreview || 'Iniciar conversación...'
      };

      // Agregar al estado y cargar mensajes
      setActiveChats(prev => new Map(prev).set(conversation.conversationId, newChat));
      
      // Unirse a la conversación para recibir mensajes en tiempo real
      await optimizedChatService.joinConversationWhenReady(conversation.conversationId, 5000);
      
      // Cargar mensajes en paralelo
      loadChatMessages(conversation.conversationId);
      
      console.log(`✅ ChatProvider: Nuevo chat creado: ${conversation.conversationId}`);
      return conversation.conversationId;
      
    } catch (error) {
      console.error('❌ ChatProvider: Error abriendo chat:', error);
      throw error;
    }
  };

  // Cargar mensajes de un chat
  const loadChatMessages = async (conversationId: string) => {
    try {
      console.log(`📥 ChatProvider: Cargando mensajes para ${conversationId}`);
      
      // Marcar como cargando
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat) {
          chat.isLoading = true;
          newChats.set(conversationId, chat);
        }
        return newChats;
      });

      // Obtener mensajes desde el caché mejorado primero
      let cachedMessages = await enhancedCacheService.getMessages(conversationId);
      
      // Si no hay mensajes en caché, cargar desde el servidor
      if (cachedMessages.length === 0) {
        console.log(`🔄 ChatProvider: No hay mensajes en caché, cargando desde servidor para ${conversationId}`);
        const messagesResult = await optimizedChatService.getMessages(conversationId, { limit: 50 });
        
        // Los mensajes del servidor vienen en orden descendente (más recientes primero)
        // Mantener ese orden para consistencia
        cachedMessages = messagesResult.items;
        
        // Guardar en caché mejorado
        if (cachedMessages.length > 0) {
          await enhancedCacheService.setMessages(conversationId, cachedMessages);
          console.log(`💾 ChatProvider: ${cachedMessages.length} mensajes guardados en caché mejorado`);
        }
      } else {
        console.log(`✅ ChatProvider: ${cachedMessages.length} mensajes encontrados en caché mejorado`);
      }
      
      // Aplicar estado de lectura local a los mensajes
      const messagesWithReadStatus = cachedMessages.map(message => {
        const isRead = readStatusBatchService.isMessageRead(conversationId, message.messageId);
        return { ...message, read: isRead || message.read };
      });
      
      // Actualizar mensajes en el chat activo
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat) {
          // Asegurar que los mensajes estén en orden descendente (más recientes primero)
          const sortedMessages = [...messagesWithReadStatus].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          chat.messages = sortedMessages;
          chat.isLoading = false;
          newChats.set(conversationId, chat);
        }
        return newChats;
      });

      console.log(`✅ ChatProvider: Mensajes cargados para ${conversationId}: ${cachedMessages.length}`);
    } catch (error) {
      console.error(`❌ ChatProvider: Error cargando mensajes para ${conversationId}:`, error);
      
      // Quitar estado de carga
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat) {
          chat.isLoading = false;
          newChats.set(conversationId, chat);
        }
        return newChats;
      });
    }
  };

  // Precargar un chat sin abrirlo
  const preloadChat = async (userId: string, userInfo?: Partial<ChatUser>) => {
    try {
      console.log(`⚡ ChatProvider: Precargando chat con usuario ${userId}`);
      await openChat(userId, userInfo);
    } catch (error) {
      console.error('❌ ChatProvider: Error precargando chat:', error);
    }
  };

  // Enviar mensaje
  const sendMessage = async (conversationId: string, content: string, replyTo?: ChatMessage, messageType: 'text' | 'image' = 'text') => {
    try {
      let messageContent = content.trim();
      
      // Solo procesar respuestas para mensajes de texto
      if (replyTo && messageType === 'text') {
        const originalMessage = replyTo.content.length > 50 
          ? `${replyTo.content.substring(0, 50)}...` 
          : replyTo.content;
        messageContent = `↳ ${originalMessage}\n\n${content}`;
      }

      const chat = activeChats.get(conversationId);
      if (!chat) {
        throw new Error('Chat no encontrado');
      }

      // No crear mensaje optimista - esperar a que llegue el mensaje real del servidor

      // Enviar al servidor
      await optimizedChatService.sendMessage(conversationId, {
        content: messageContent,
        receiverId: chat.otherUser.id,
        type: messageType
      });

      console.log(`✅ ChatProvider: Mensaje ${messageType} enviado en ${conversationId}`);
    } catch (error) {
      console.error('❌ ChatProvider: Error enviando mensaje:', error);
      throw error;
    }
  };

  // Obtener mensajes de un chat
  const getMessages = (conversationId: string): ChatMessage[] => {
    return activeChats.get(conversationId)?.messages || [];
  };

  // Marcar como leído
  const markAsRead = async (conversationId: string) => {
    try {
      console.log(`🔄 ChatProvider: Iniciando markAsRead para conversación ${conversationId}`);
      
      const chat = activeChats.get(conversationId);
      if (!chat) {
        console.log(`⚠️ ChatProvider: Chat ${conversationId} no encontrado para marcar como leído`);
        return;
      }

      console.log(`📊 ChatProvider: Chat encontrado con ${chat.messages.length} mensajes, contador actual: ${chat.unreadCount}`);

      // Obtener mensajes no leídos del otro usuario con verificación mejorada
      const unreadMessages = chat.messages.filter(message => {
        const isFromOtherUser = message.senderId !== user!.id;
        const isNotReadLocally = !message.read;
        const isNotReadInBatchService = !readStatusBatchService.isMessageRead(conversationId, message.messageId);
        
        // Log detallado para debugging
        const needsUpdate = isFromOtherUser && (isNotReadLocally || isNotReadInBatchService);
        if (needsUpdate) {
          console.log(`🔍 Mensaje ${message.messageId}:`, {
            isFromOtherUser,
            isNotReadLocally,
            isNotReadInBatchService,
            senderId: message.senderId,
            currentUserId: user!.id,
            read: message.read
          });
        }
        
        // Un mensaje se considera no leído si:
        // 1. Es del otro usuario Y
        // 2. No está marcado como leído localmente O no está marcado como leído en el servicio de lotes
        return isFromOtherUser && (isNotReadLocally || isNotReadInBatchService);
      });

      console.log(`📝 ChatProvider: ${unreadMessages.length} mensajes no leídos encontrados de ${chat.messages.length} total en conversación ${conversationId}`);

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.messageId);
        
        console.log(`👁️ ChatProvider: Marcando ${messageIds.length} mensajes como leídos en conversación ${conversationId}:`, messageIds);
        
        // Marcar como leídos localmente primero (inmediato)
        await readStatusBatchService.markAsRead(conversationId, messageIds);
        
        // Actualizar estado local de los mensajes inmediatamente
        setActiveChats(prev => {
          const newChats = new Map(prev);
          const updatedChat = newChats.get(conversationId);
          if (updatedChat) {
            // Actualizar estado de lectura de los mensajes
            updatedChat.messages = updatedChat.messages.map(message => {
              if (messageIds.includes(message.messageId)) {
                console.log(`✅ Mensaje ${message.messageId} marcado como leído localmente`);
                return { ...message, read: true };
              }
              return message;
            });
            
            // Resetear contador de no leídos
            const previousUnreadCount = updatedChat.unreadCount;
            updatedChat.unreadCount = 0;
            newChats.set(conversationId, updatedChat);
            
            console.log(`📊 ChatProvider: Contador de no leídos actualizado: ${previousUnreadCount} -> 0`);
            
            // Forzar re-renderización para actualizar la UI inmediatamente
            setLastUpdateTimestamp(Date.now());
          }
          return newChats;
        });
        
        console.log(`✅ ChatProvider: ${messageIds.length} mensajes marcados como leídos localmente en conversación ${conversationId}`);
        
        // Forzar sincronización inmediata para esta conversación (opcional, para mejor UX)
        readStatusBatchService.forceSyncConversation(conversationId).catch(error => {
          console.error(`❌ ChatProvider: Error en sincronización forzada para ${conversationId}:`, error);
        });
      } else {
        // Si no hay mensajes no leídos, solo resetear el contador si es necesario
        if (chat.unreadCount > 0) {
          console.log(`🔄 ChatProvider: No hay mensajes no leídos pero contador > 0, reseteando contador en conversación ${conversationId}`);
          setActiveChats(prev => {
            const newChats = new Map(prev);
            const updatedChat = newChats.get(conversationId);
            if (updatedChat && updatedChat.unreadCount > 0) {
              const previousUnreadCount = updatedChat.unreadCount;
              updatedChat.unreadCount = 0;
              newChats.set(conversationId, updatedChat);
              console.log(`📊 ChatProvider: Contador resetado: ${previousUnreadCount} -> 0`);
            }
            return newChats;
          });
        } else {
          console.log(`ℹ️ ChatProvider: No hay mensajes no leídos ni contador que resetear en conversación ${conversationId}`);
        }
      }
    } catch (error) {
      console.error('❌ ChatProvider: Error marcando mensajes como leídos:', error);
      
      // Aún así, actualizar el contador local para la UX
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat && chat.unreadCount > 0) {
          console.log(`🔄 ChatProvider: Error ocurrió pero reseteando contador para UX: ${chat.unreadCount} -> 0`);
          chat.unreadCount = 0;
          newChats.set(conversationId, chat);
        }
        return newChats;
      });
    }
  };

  // Cerrar chat (mantener en memoria pero marcar como inactivo)
  const closeChat = (conversationId: string) => {
    console.log(`🔒 ChatProvider: Cerrando chat ${conversationId}`);
    
    // Marcar como leído al cerrar (asíncrono, no esperar)
    markAsRead(conversationId).catch(error => {
      console.error('❌ ChatProvider: Error marcando como leído al cerrar chat:', error);
    });
    
    // Si es el chat actual, quitarlo
    if (currentChatId === conversationId) {
      setCurrentChatId(null);
    }
  };

  // Establecer chat actual
  const setCurrentChat = (conversationId: string | null) => {
    setCurrentChatId(conversationId);
    
    // Marcar como leído cuando se establece como actual (asíncrono, no esperar)
    if (conversationId) {
      markAsRead(conversationId).catch(error => {
        console.error('❌ ChatProvider: Error marcando como leído al establecer chat actual:', error);
      });
    }
  };

  // Obtener chat por userId
  const getChatByUserId = (userId: string): ActiveChat | null => {
    for (const [_, chat] of activeChats) {
      if (chat.otherUser.id === userId) {
        return chat;
      }
    }
    return null;
  };

  // Obtener chat por conversationId
  const getChatByConversationId = (conversationId: string): ActiveChat | null => {
    return activeChats.get(conversationId) || null;
  };

  // Obtener información del otro usuario en una conversación
  const getOtherUserInfo = useCallback(async (conversationId: string): Promise<ChatUser | null> => {
    try {
      const apiService = (await import('@/services/apiService')).default;
      const response = await apiService.getOtherUserInfo(conversationId);
      
      if (response.success && response.data?.otherUser) {
        const userData = response.data.otherUser;
        return {
          id: userData.id,
          name: userData.name,
          profileImage: userData.profileImage,
          isOnline: userData.isOnline,
          lastSeen: userData.lastSeen,
          age: userData.age,
          gender: userData.gender as 'male' | 'female' | 'other',
          country: userData.country,
          countryFlag: userData.countryFlag
        };
      }
      return null;
    } catch (error) {
      console.error('❌ ChatProvider: Error obteniendo información del usuario:', error);
      return null;
    }
  }, []);

  // Obtener contador total de no leídos
  const getUnreadCount = (): number => {
    let total = 0;
    for (const [_, chat] of activeChats) {
      total += chat.unreadCount;
    }
    return total;
  };

  // Obtener contador de no leídos desde la base de datos (función asíncrona)
  const getUnreadCountFromDatabase = async (): Promise<number> => {
    try {
      const conversations = await optimizedChatService.getConversations({ limit: 50 });
      let total = 0;
      
      for (const conv of conversations.items) {
        let convUnreadCount = conv.unreadCount || 0;
        
        // Ajustar contador considerando estado local de lectura
        const locallyReadMessages = readStatusBatchService.getReadMessages(conv.conversationId);
        if (locallyReadMessages.length > 0) {
          // Si hay mensajes marcados como leídos localmente, reducir el contador
          // Esto es una aproximación - en un caso ideal deberíamos contar mensajes reales
          convUnreadCount = Math.max(0, convUnreadCount - locallyReadMessages.length);
        }
        
        total += convUnreadCount;
      }
      
      console.log(`📊 ChatProvider: Total mensajes no leídos desde BD (ajustado): ${total}`);
      return total;
    } catch (error) {
      console.error('❌ ChatProvider: Error obteniendo contador desde BD:', error);
      // Fallback al contador local
      return getUnreadCount();
    }
  };

  // Refrescar chats con protección contra bucles
  const refreshChats = async () => {
    if (isRefreshing.current) {
      console.log('🔄 ChatProvider: Refresco ya en progreso, omitiendo...');
      return;
    }

    try {
      isRefreshing.current = true;
      console.log('🔄 ChatProvider: Refrescando chats');
      lastSyncTime.current = new Date();
      await loadExistingConversations();
    } catch (error) {
      console.error('❌ ChatProvider: Error refrescando chats:', error);
    } finally {
      isRefreshing.current = false;
    }
  };

  // Refrescar chats con debouncing
  const debouncedRefreshChats = useCallback(() => {
    // Cancelar timeout anterior si existe
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
    }

    // Establecer nuevo timeout
    refreshTimeout.current = setTimeout(() => {
      refreshChats();
    }, 1000); // Esperar 1 segundo antes de refrescar
  }, []);

  // Obtener estado de conexión
  const getConnectionStatus = () => {
    return optimizedChatService.getConnectionStatus();
  };

  // Sincronizar cola de mensajes leídos manualmente
  const syncReadStatusQueue = async () => {
    try {
      await readStatusBatchService.syncBatchQueue();
      console.log('✅ ChatProvider: Cola de mensajes leídos sincronizada');
    } catch (error) {
      console.error('❌ ChatProvider: Error sincronizando cola de mensajes leídos:', error);
    }
  };

  // Limpiar al desmontar
  const cleanup = async () => {
    console.log('🧹 ChatProvider: Limpiando proveedor de chat');
    
    // Cancelar timeouts pendientes
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
      refreshTimeout.current = null;
    }
    
    if (messageListenerAttached.current) {
      optimizedChatService.offNewMessage(handleNewMessage);
      messageListenerAttached.current = false;
    }
    
    // Sincronizar cola de mensajes leídos antes de limpiar
    try {
      await readStatusBatchService.syncBatchQueue();
    } catch (error) {
      console.error('Error sincronizando cola de mensajes leídos:', error);
    }
    
    // Ejecutar limpieza del caché mejorado
    try {
      await enhancedCacheService.performCleanup();
    } catch (error) {
      console.error('Error en limpieza del caché mejorado:', error);
    }
    
    // Destruir servicio de sincronización por lotes
    try {
      readStatusBatchService.destroy();
    } catch (error) {
      console.error('Error destruyendo servicio de sincronización por lotes:', error);
    }
    
    setActiveChats(new Map());
    setCurrentChatId(null);
    isInitialized.current = false;
    isRefreshing.current = false;
  };

  const value: ChatContextType = {
    // Estado
    activeChats,
    currentChatId,
    isGlobalLoading,
    lastUpdateTimestamp,
    
    // Gestión
    openChat,
    closeChat,
    setCurrentChat,
    preloadChat,
    
    // Mensajes
    sendMessage,
    getMessages,
    markAsRead,
    
    // Utilidades
    getChatByUserId,
    getChatByConversationId,
    getUnreadCount,
    getUnreadCountFromDatabase,
    getOtherUserInfo,
    getConnectionStatus,
    refreshChats,
    syncReadStatusQueue
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat debe ser usado dentro de un ChatProvider');
  }
  return context;
};
