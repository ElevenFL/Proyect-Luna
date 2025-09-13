import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import { useAuth } from './AuthContext';
import optimizedChatService, { ChatMessage } from '@/services/optimizedChatService';
import { socketService } from '@/services/socketService';

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
}

interface ChatContextType {
  // Estado global de chats
  activeChats: Map<string, ActiveChat>;
  currentChatId: string | null;
  isGlobalLoading: boolean;
  
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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [activeChats, setActiveChats] = useState<Map<string, ActiveChat>>(new Map());
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
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
      const conversations = await optimizedChatService.getConversations({ limit: 50 });
      const newActiveChats = new Map<string, ActiveChat>();

      for (const conv of conversations.items) {
        const otherUserId = conv.participants?.find((p: string) => p !== user!.id);
        if (otherUserId) {
          // Crear chat activo con información básica
          const activeChat: ActiveChat = {
            conversationId: conv.conversationId,
            otherUser: {
              id: otherUserId,
              name: conv.otherUser?.name || `Usuario ${otherUserId.slice(-4)}`,
              profileImage: conv.otherUser?.profileImage,
              isOnline: conv.otherUser?.isOnline || false,
              lastSeen: conv.otherUser?.lastSeen,
              age: conv.otherUser?.age,
              gender: conv.otherUser?.gender as 'male' | 'female' | 'other' | undefined,
              country: conv.otherUser?.country,
              countryFlag: conv.otherUser?.countryFlag
            },
            messages: [],
            isLoading: false,
            lastActivity: new Date(conv.updatedAt || conv.createdAt),
            unreadCount: conv.unreadCount || 0, // Ahora viene de la base de datos
            isTyping: false
          };

          newActiveChats.set(conv.conversationId, activeChat);
        }
      }

      setActiveChats(newActiveChats);
      console.log(`📱 ChatProvider: Cargados ${newActiveChats.size} chats activos con unreadCount desde BD`);
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
    }
  };

  // Manejar nuevos mensajes
  const handleNewMessage = useCallback((message: ChatMessage) => {
    console.log('📨 ChatProvider: Nuevo mensaje recibido:', {
      messageId: message.messageId,
      conversationId: message.conversationId,
      senderId: message.senderId
    });

    setActiveChats(prevChats => {
      const newChats = new Map(prevChats);
      const chat = newChats.get(message.conversationId!);
      
      if (chat) {
        // Actualizar chat existente
        const isFromMe = message.senderId === user!.id;
        const messageExists = chat.messages.some(m => m.messageId === message.messageId);
        
        if (!messageExists) {
          // Si es un mensaje nuestro, reemplazar el mensaje optimista
          if (isFromMe) {
            // Buscar y remover mensaje optimista con el mismo contenido
            chat.messages = chat.messages.filter(m => 
              !(m.isOptimistic && m.content === message.content && m.senderId === message.senderId)
            );
          }
          
          chat.messages = [message, ...chat.messages];
          chat.lastActivity = new Date(message.createdAt);
          
          // Incrementar contador de no leídos solo si no es nuestro mensaje y no es el chat actual
          if (!isFromMe && currentChatId !== message.conversationId) {
            chat.unreadCount += 1;
          }
          
          newChats.set(message.conversationId!, chat);
        }
      } else {
        // Chat no existe, necesitamos crearlo si el mensaje es para nosotros
        const isMessageForMe = message.receiverId === user!.id || message.senderId === user!.id;
        if (isMessageForMe && message.conversationId) {
          createChatFromMessage(message, newChats);
        }
      }
      
      return newChats;
    });
  }, [user, currentChatId]);

  // Crear chat desde un mensaje
  const createChatFromMessage = (message: ChatMessage, chatsMap: Map<string, ActiveChat>) => {
    const otherUserId = message.senderId === user!.id ? message.receiverId : message.senderId;
    
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
      isTyping: false
    };

    chatsMap.set(message.conversationId!, newChat);
    console.log(`➕ ChatProvider: Nuevo chat creado desde mensaje: ${message.conversationId}`);
  };

  // Abrir un chat (crear o recuperar existente)
  const openChat = async (userId: string, userInfo?: Partial<ChatUser>): Promise<string> => {
    try {
      console.log(`🔓 ChatProvider: Abriendo chat con usuario ${userId}`);
      
      // Buscar chat existente por userId
      let existingChat = getChatByUserId(userId);
      
      if (existingChat) {
        console.log(`✅ ChatProvider: Chat existente encontrado: ${existingChat.conversationId}`);
        
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
        isTyping: false
      };

      // Agregar al estado y cargar mensajes
      setActiveChats(prev => new Map(prev).set(conversation.conversationId, newChat));
      
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

      const messagesResult = await optimizedChatService.getMessages(conversationId, { limit: 50 });
      
      // Actualizar mensajes
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat) {
          chat.messages = messagesResult.items.reverse(); // Más recientes primero
          chat.isLoading = false;
          newChats.set(conversationId, chat);
        }
        return newChats;
      });

      console.log(`✅ ChatProvider: Mensajes cargados para ${conversationId}: ${messagesResult.items.length}`);
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

      // Crear mensaje optimista inmediatamente para mostrar en la UI
      const optimisticMessage: ChatMessage = {
        messageId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: user!.id,
        receiverId: chat.otherUser.id,
        content: messageContent,
        type: messageType,
        createdAt: new Date().toISOString(),
        conversationId,
        isOptimistic: true
      };

      // Actualizar estado local inmediatamente
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const updatedChat = newChats.get(conversationId);
        if (updatedChat) {
          updatedChat.messages = [optimisticMessage, ...updatedChat.messages];
          updatedChat.lastActivity = new Date();
          newChats.set(conversationId, updatedChat);
        }
        return newChats;
      });

      // Enviar al servidor
      await optimizedChatService.sendMessage(conversationId, {
        content: messageContent,
        receiverId: chat.otherUser.id,
        type: messageType
      });

      console.log(`✅ ChatProvider: Mensaje ${messageType} enviado en ${conversationId}`);
    } catch (error) {
      console.error('❌ ChatProvider: Error enviando mensaje:', error);
      
      // Remover mensaje optimista en caso de error
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const updatedChat = newChats.get(conversationId);
        if (updatedChat) {
          updatedChat.messages = updatedChat.messages.filter(m => !m.isOptimistic);
          newChats.set(conversationId, updatedChat);
        }
        return newChats;
      });
      
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
      const chat = activeChats.get(conversationId);
      if (!chat) return;

      // Obtener mensajes no leídos del otro usuario
      const unreadMessages = chat.messages.filter(message => 
        message.senderId !== user!.id && !message.read
      );

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.messageId);
        
        // Marcar como leídos en el servidor
        await optimizedChatService.markMessagesAsRead(conversationId, messageIds);
        
        console.log(`👁️ ChatProvider: ${messageIds.length} mensajes marcados como leídos en conversación ${conversationId}`);
      }

      // Actualizar contador local
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const updatedChat = newChats.get(conversationId);
        if (updatedChat && updatedChat.unreadCount > 0) {
          updatedChat.unreadCount = 0;
          newChats.set(conversationId, updatedChat);
        }
        return newChats;
      });
    } catch (error) {
      console.error('❌ ChatProvider: Error marcando mensajes como leídos:', error);
      
      // Aún así, actualizar el contador local para la UX
      setActiveChats(prev => {
        const newChats = new Map(prev);
        const chat = newChats.get(conversationId);
        if (chat && chat.unreadCount > 0) {
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
        total += conv.unreadCount || 0;
      }
      
      console.log(`📊 ChatProvider: Total mensajes no leídos desde BD: ${total}`);
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

  // Limpiar al desmontar
  const cleanup = () => {
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
    refreshChats
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
