import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '@/services/apiService';
import socketService from '@/services/socketService';
import cacheService from '@/services/cacheService';
import chatService from '@/services/chatService';
import scrollPositionService from '@/services/scrollPositionService';
import { useAuth } from '@/contexts/AuthContext';
import { useChatCache } from '@/hooks/useChatCache';

interface ChatMessage {
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image';
  createdAt: string;
  conversationId?: string; // Opcional para compatibilidad con mensajes existentes
}

const ChatScreen = React.memo(() => {
  const { 
    userId: otherUserId,
    userName,
    userImage,
    userAge,
    userGender,
    userCountry,
    userCountryFlag,
    isOnline
  } = useLocalSearchParams();
  const { user, token } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [otherUserInfo, setOtherUserInfo] = useState<{name: string, profileImage?: string} | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);
  const [hasRestoredScroll, setHasRestoredScroll] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [shouldPreventAutoScroll, setShouldPreventAutoScroll] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Estados locales para mensajes (más rápido que el hook)
  const [rawMessages, setRawMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);

  // Invertir el orden de los mensajes para mostrar del más nuevo al más viejo
  // y eliminar duplicados por messageId
  const messages = useMemo(() => {
    // Crear un Map para eliminar duplicados por messageId
    const uniqueMessages = new Map();
    
    // Procesar mensajes en orden cronológico (más antiguos primero)
    rawMessages.forEach(message => {
      uniqueMessages.set(message.messageId, message);
    });
    
    // Convertir a array y invertir para mostrar del más nuevo al más viejo
    return Array.from(uniqueMessages.values()).reverse();
  }, [rawMessages]);

  const currentUserId = useMemo(() => {
    // Ahora el ID de DynamoDB es el mismo que el amplifySub
    return user?.id || user?.amplifySub || '';
  }, [user]);

  // Función para hacer scroll al final (útil para nuevos mensajes)
  // En lista invertida, el "final" visual es el offset 0
  const scrollToEnd = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);

  // Función optimizada para cargar mensajes desde caché (instantáneo)
  const loadMessagesFromCache = useCallback(async (convId: string) => {
    try {
      // NUEVA FUNCIONALIDAD: Intentar cargar mensajes prerenderizados primero
      try {
        const prerenderedMessages = await chatService.getPrerenderedMessages(convId);
        if (prerenderedMessages && prerenderedMessages.length > 0) {
          console.log(`🎭 Chat: Cargados ${prerenderedMessages.length} mensajes prerenderizados (instantáneo)`);
          setRawMessages(prerenderedMessages);
          setIsLoaded(true);
          return true; // Mensajes prerenderizados cargados exitosamente
        }
      } catch (prerenderError) {
        console.log('ℹ️ Chat: No hay mensajes prerenderizados disponibles, cargando desde caché normal');
      }

      // Fallback: Cargar mensajes desde caché de forma síncrona (más rápido)
      const cachedMessages = await cacheService.getCachedMessagesSync(convId);
      
      if (cachedMessages.length > 0) {
        console.log(`⚡ Chat: Cargados ${cachedMessages.length} mensajes desde caché (instantáneo)`);
        
        // NUEVA FUNCIONALIDAD: Cargar renders precargados si están disponibles
        try {
          const renderCache = await chatService.getCachedMessageRenders(convId);
          if (renderCache.size > 0) {
            console.log(`🎨 Chat: Cargados ${renderCache.size} renders precargados desde caché`);
            // Los renders precargados se usarán automáticamente en el componente SwipeableMessage
          }
        } catch (renderError) {
          console.log('ℹ️ Chat: No hay renders precargados disponibles, se generarán dinámicamente');
        }
        
        setRawMessages(cachedMessages);
        setIsLoaded(true);
        return true; // Indica que se cargaron mensajes
      }
      
      return false; // No hay mensajes en caché
    } catch (error) {
      console.error('Error cargando mensajes desde caché:', error);
      return false;
    }
  }, []);

  // Función para cargar mensajes desde caché de forma síncrona (más rápida)
  const loadMessagesFromCacheSync = useCallback((convId: string) => {
    try {
      // Mostrar skeleton solo si la carga toma más de 100ms
      const skeletonTimeout = setTimeout(() => {
        if (!isInitialLoadComplete) {
          setShowSkeleton(true);
        }
      }, 100);

      // Intentar cargar desde AsyncStorage directamente (más rápido)
      cacheService.getCachedMessagesSync(convId).then((cachedMessages) => {
        // Cancelar el skeleton si los mensajes se cargan rápido
        clearTimeout(skeletonTimeout);
        setShowSkeleton(false);
        
        if (cachedMessages.length > 0) {
          console.log(`⚡ Chat: Cargados ${cachedMessages.length} mensajes desde caché (síncrono)`);
          // Mostrar mensajes inmediatamente
          setRawMessages(cachedMessages);
          setIsLoaded(true);
          // Marcar carga inicial como completa inmediatamente
          setIsInitialLoadComplete(true);
        }
      }).catch((error) => {
        clearTimeout(skeletonTimeout);
        setShowSkeleton(false);
        console.error('Error cargando mensajes desde caché síncrono:', error);
      });
    } catch (error) {
      console.error('Error en carga síncrona:', error);
    }
  }, [isInitialLoadComplete]);

  // Función para añadir mensaje al estado local
  const addMessageToState = useCallback(async (message: ChatMessage) => {
    try {
      // Verificar si el mensaje ya existe para evitar duplicados
      const messageExists = rawMessages.some(m => m.messageId === message.messageId);
      
      if (!messageExists) {
        // Añadir al caché
        await cacheService.addMessageToCache(conversationId!, message);
        
        // Añadir al estado local
        setRawMessages(prev => [...prev, message]);
        
        console.log(`➕ Chat: Añadido mensaje ${message.messageId} al estado local`);
      }
    } catch (error) {
      console.error('Error añadiendo mensaje al estado:', error);
    }
  }, [rawMessages, conversationId]);

  // Función para cargar mensajes anteriores desde el caché
  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || isLoadingOlderMessages || !hasMoreOlderMessages) return;
    
    setIsLoadingOlderMessages(true);
    
    try {
      console.log(`📜 Chat: Cargando mensajes anteriores para conversación ${conversationId}`);
      
      // Obtener mensajes más antiguos del servidor
      const oldestMessage = rawMessages[rawMessages.length - 1]; // El más antiguo en la lista
      const oldestMessageDate = oldestMessage ? oldestMessage.createdAt : undefined;
      
      // Cargar mensajes anteriores desde el servidor
      const res = await ApiService.listMessages(conversationId, { 
        limit: 20,
        // TODO: Implementar paginación con fecha si el backend lo soporta
      });
      
      const serverMessages = (res.data?.items || []) as ChatMessage[];
      
      if (serverMessages.length > 0) {
        // Obtener mensajes actuales del caché
        const cachedMessages = await cacheService.getCachedMessages(conversationId);
        const cachedMessageIds = new Set(cachedMessages.map(m => m.messageId));
        
        // Filtrar solo mensajes nuevos del servidor
        const newMessages = serverMessages.filter(msg => !cachedMessageIds.has(msg.messageId));
        
        if (newMessages.length > 0) {
          console.log(`📜 Chat: Cargados ${newMessages.length} mensajes anteriores`);
          
          // Ordenar mensajes nuevos por fecha (más antiguos primero para el caché)
          const sortedNewMessages = newMessages.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          
          // Actualizar caché con mensajes anteriores
          await cacheService.updateCachedMessages(conversationId, [...cachedMessages, ...sortedNewMessages]);
          
          // Actualizar estado local
          setRawMessages([...cachedMessages, ...sortedNewMessages]);
        } else {
          console.log(`📜 Chat: No hay mensajes anteriores nuevos`);
        }
        
        // Si recibimos menos mensajes de los esperados, no hay más mensajes
        if (serverMessages.length < 20) {
          setHasMoreOlderMessages(false);
          console.log(`📜 Chat: No hay más mensajes anteriores`);
        }
      } else {
        setHasMoreOlderMessages(false);
        console.log(`📜 Chat: No hay más mensajes anteriores`);
      }
      
    } catch (error) {
      console.error('Error cargando mensajes anteriores:', error);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [conversationId, rawMessages, isLoadingOlderMessages, hasMoreOlderMessages]);

  // Listener para nuevos mensajes en tiempo real
  const handleNewMessage = useCallback(async (message: ChatMessage) => {
    console.log('📨 Nuevo mensaje recibido en chat:', {
      messageId: message.messageId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content?.substring(0, 30) + '...',
      conversationId: message.conversationId
    });
    
    // Verificar si el mensaje es para esta conversación
    if (message.conversationId === conversationId) {
      // Usar la función local para añadir mensaje
      await addMessageToState(message);
      
      // Solo hacer scroll automático si:
      // 1. La carga inicial está completa
      // 2. No estamos en medio de restaurar una posición guardada
      // 3. No se ha deshabilitado el auto-scroll
      if (isInitialLoadComplete && !shouldPreventAutoScroll && hasRestoredScroll) {
        setTimeout(() => {
          scrollToEnd();
        }, 50);
      }
      
      console.log('✅ Mensaje añadido a la conversación actual');
    } else {
      console.log('ℹ️ Mensaje recibido para otra conversación, ignorando');
    }
  }, [addMessageToState, conversationId, scrollToEnd, isInitialLoadComplete, shouldPreventAutoScroll, hasRestoredScroll]);

  useEffect(() => {
    const init = async () => {
      if (!otherUserId || !currentUserId) return;
      
      try {
        // Verificar y establecer el token de autenticación
        if (!token) {
          console.log('⚠️ Chat: No hay token disponible en AuthContext');
          throw new Error('Token de autenticación no disponible');
        }
        
        // Asegurar que el token esté en ApiService
        if (!ApiService.getAuthToken()) {
          console.log('🔄 Chat: Estableciendo token en ApiService...');
          ApiService.setAuthToken(token);
        }
        
        console.log('✅ Chat: Token de autenticación verificado y sincronizado');
        
        // Conectar WebSocket
        await socketService.connect(currentUserId);
        
        // Obtener/crear conversación
        const conv = await ApiService.getOrCreateConversationWith(String(otherUserId));
        const convId = conv?.data?.conversationId;
        
        if (convId) {
          setConversationId(convId);
          
          // Marcar conversación como activa para sincronización prioritaria
          chatService.markConversationActive(convId, true);
          
          // Registrar acceso a la conversación para mejorar la precarga futura
          await chatService.recordConversationAccess(convId);
          
          // 1. Cargar posición del scroll guardada
          const savedPosition = await scrollPositionService.getScrollPosition(convId);
          setSavedScrollPosition(savedPosition);
          
          // 2. Marcar carga inicial como completa
          setIsInitialLoadComplete(true);
          
          // NUEVO FLUJO OPTIMIZADO: Los mensajes ya se cargaron en useLayoutEffect
          console.log(`📱 Chat: Inicializando conversación ${convId}...`);
          
          // PASO 1: Sincronizar solo mensajes nuevos en segundo plano (sin bloquear UI)
          console.log(`🔄 Chat: Sincronizando mensajes nuevos en segundo plano...`);
          
          // Ejecutar sincronización en segundo plano sin bloquear la UI
          setTimeout(async () => {
            try {
              // Usar la función de sincronización incremental del chatService
              const syncResult = await chatService.syncConversationIncremental(convId);
              
              if (syncResult.newMessagesCount > 0) {
                console.log(`📨 Chat: Sincronizados ${syncResult.newMessagesCount} mensajes nuevos`);
                // Actualizar mensajes en el estado local
                setRawMessages(syncResult.updatedMessages);
              } else {
                console.log(`✅ Chat: No hay mensajes nuevos, caché está actualizado`);
              }
            } catch (syncError) {
              console.error('Error sincronizando mensajes nuevos en segundo plano:', syncError);
            }
          }, 100); // Pequeño delay para no bloquear la UI
          
          // 4. Configurar WebSocket para mensajes en tiempo real
          chatService.joinConversation(convId);
          chatService.onNewMessage(handleNewMessage);
        }
      } catch (error) {
        console.error('Error inicializando chat:', error);
        // Marcar como completa incluso si hay error para evitar bloqueos
        setIsInitialLoadComplete(true);
      }
    };
    
    init();

    // Cleanup al desmontar
    return () => {
      if (conversationId) {
        // Marcar conversación como inactiva
        chatService.markConversationActive(conversationId, false);
        chatService.leaveConversation(conversationId);
      }
      chatService.offNewMessage(handleNewMessage);
    };
  }, [otherUserId, currentUserId, token]); // Incluir token en las dependencias

  // Efecto para restaurar posición del scroll o ir al final
  useEffect(() => {
    // Solo restaurar scroll cuando:
    // 1. Hay mensajes cargados
    // 2. La carga inicial está completa
    // 3. No se ha restaurado ya el scroll
    // 4. No se está sincronizando (para evitar interrupciones)
    if (messages.length > 0 && isInitialLoadComplete && !hasRestoredScroll && !isSyncing) {
      // Prevenir auto-scroll durante la restauración
      setShouldPreventAutoScroll(true);
      
      setTimeout(() => {
        if (savedScrollPosition !== null && savedScrollPosition > 0) {
          // Restaurar posición guardada
          listRef.current?.scrollToOffset({ 
            offset: savedScrollPosition, 
            animated: false 
          });
          console.log(`📍 Restaurada posición del scroll: ${savedScrollPosition}px`);
        } else {
          // Si no hay posición guardada, ir al inicio (que es el final visual en lista invertida)
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
          console.log('📍 Scroll al inicio (final visual en lista invertida)');
        }
        
        setHasRestoredScroll(true);
        // Re-habilitar auto-scroll después de un breve delay
        setTimeout(() => {
          setShouldPreventAutoScroll(false);
        }, 200);
      }, 150);
    }
  }, [messages.length, isInitialLoadComplete, savedScrollPosition, hasRestoredScroll, isSyncing]);

  // Función para guardar posición del scroll y detectar scroll hacia arriba
  const handleScroll = useCallback((event: any) => {
    if (conversationId && hasRestoredScroll && !shouldPreventAutoScroll) {
      const offset = event.nativeEvent.contentOffset.y;
      const contentHeight = event.nativeEvent.contentSize.height;
      const layoutHeight = event.nativeEvent.layoutMeasurement.height;
      
      // Guardar posición cada 50px de scroll para mejor precisión
      if (Math.abs(offset % 50) < 10) {
        scrollPositionService.saveScrollPosition(conversationId, offset);
      }
      
      // Detectar si el usuario está cerca del final de la lista (mensajes más antiguos)
      // En lista invertida, el "final" es donde están los mensajes más antiguos
      const distanceFromEnd = contentHeight - layoutHeight - offset;
      
      // Si está cerca del final (menos de 200px) y hay más mensajes, cargar anteriores
      if (distanceFromEnd < 200 && hasMoreOlderMessages && !isLoadingOlderMessages) {
        console.log(`📜 Chat: Usuario cerca del final, cargando mensajes anteriores...`);
        loadOlderMessages();
      }
    }
  }, [conversationId, hasRestoredScroll, shouldPreventAutoScroll, hasMoreOlderMessages, isLoadingOlderMessages, loadOlderMessages]);

  // Efecto para obtener información del otro usuario
  useEffect(() => {
    const fetchOtherUserInfo = async () => {
      if (!otherUserId) return;
      
      try {
        // Usar la información recibida de la pantalla de mensajes
        setOtherUserInfo({
          name: String(userName || `Usuario ${String(otherUserId).slice(-4)}`),
          profileImage: userImage ? String(userImage) : undefined
        });
      } catch (error) {
        console.error('Error obteniendo información del usuario:', error);
        setOtherUserInfo({
          name: String(userName || `Usuario ${String(otherUserId).slice(-4)}`),
          profileImage: userImage ? String(userImage) : undefined
        });
      }
    };

    fetchOtherUserInfo();
  }, [otherUserId, userName, userImage]);

  // Sincronizar token con ApiService cuando esté disponible
  useEffect(() => {
    if (token && !ApiService.getAuthToken()) {
      console.log('🔄 Chat: Sincronizando token con ApiService...');
      ApiService.setAuthToken(token);
    }
  }, [token]);

  // Cargar mensajes inmediatamente cuando se establece conversationId (useLayoutEffect para ser más rápido)
  useLayoutEffect(() => {
    if (conversationId) {
      // Cargar mensajes desde caché inmediatamente (síncrono para máxima velocidad)
      loadMessagesFromCacheSync(conversationId);
    }
  }, [conversationId, loadMessagesFromCacheSync]);

  // Resetear estados cuando cambie la conversación
  useEffect(() => {
    if (conversationId) {
      setHasRestoredScroll(false);
      setShouldPreventAutoScroll(false);
      setIsLoadingOlderMessages(false);
      setHasMoreOlderMessages(true);
      setIsPreloading(false);
      setIsSyncing(false);
      setShowSkeleton(false);
      // OPTIMIZACIÓN: Solo resetear isInitialLoadComplete si no hay mensajes
      // para evitar parpadeos cuando ya hay mensajes cargados
      if (messages.length === 0) {
        setIsInitialLoadComplete(false);
      }
    } else {
      // Limpiar estados cuando no hay conversación
      setRawMessages([]);
      setIsLoaded(false);
      setIsPreloading(false);
      setIsSyncing(false);
      setShowSkeleton(false);
    }
  }, [conversationId, messages.length]);

  const handleSend = async () => {
    if (!conversationId || !input.trim() || !otherUserId) return;
    const text = input.trim();
    setInput('');
    setIsSending(true);
    
    try {
      // Preparar el contenido del mensaje
      let messageContent = text;
      if (replyingTo) {
        // Si es una respuesta, incluir información del mensaje original con formato moderno
        const originalMessage = replyingTo.content.length > 50 
          ? `${replyingTo.content.substring(0, 50)}...` 
          : replyingTo.content;
        messageContent = `↳ ${originalMessage}\n\n${text}`;
      }
      
      // Enviar mensaje via API (que también emite via WebSocket)
      const response = await ApiService.sendMessage(conversationId, {
        content: messageContent,
        receiverId: String(otherUserId),
        type: 'text'
      });
      
      // Limpiar la respuesta después de enviar
      setReplyingTo(null);
      
      // El mensaje se añadirá automáticamente via WebSocket y se guardará en caché
      // en el handleNewMessage callback
      console.log('✅ Mensaje enviado exitosamente');
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      // Restaurar input en caso de error
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  // Función para detectar si un mensaje es una respuesta
  const isReplyMessage = (content: string) => {
    return content.startsWith('↳');
  };

  // Función para extraer el mensaje original y la respuesta
  const parseReplyMessage = (content: string) => {
    if (!isReplyMessage(content)) return { originalMessage: '', replyText: content };
    
    const parts = content.split('\n\n');
    if (parts.length >= 2) {
      const originalMessage = parts[0].replace('↳ ', '');
      const replyText = parts.slice(1).join('\n\n');
      return { originalMessage, replyText };
    }
    return { originalMessage: '', replyText: content };
  };

  // Función para formatear el tiempo de un mensaje
  const formatMessageTime = (createdAt: string): string => {
    try {
      const now = new Date();
      const messageTime = new Date(createdAt);
      const diffMs = now.getTime() - messageTime.getTime();
      
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMinutes < 1) {
        return 'Ahora';
      } else if (diffMinutes < 60) {
        return `Hace ${diffMinutes} min`;
      } else if (diffHours < 24) {
        return `Hace ${diffHours}h`;
      } else if (diffDays < 7) {
        return `Hace ${diffDays}d`;
      } else {
        return messageTime.toLocaleDateString('es-ES', { 
          day: '2-digit', 
          month: '2-digit' 
        });
      }
    } catch (error) {
      return 'Hace un momento';
    }
  };

  // Componente de mensaje optimizado (memoizado para mejor rendimiento)
  const SwipeableMessage = React.memo(({ item }: { item: ChatMessage }) => {
    const translateX = useSharedValue(0);
    const isMine = String(item.senderId) === String(currentUserId);
    
    // NUEVA FUNCIONALIDAD: Usar renders precargados si están disponibles
    const [cachedRenderData, setCachedRenderData] = useState<any>(null);
    const [isLoadingRender, setIsLoadingRender] = useState(true);
    
    // Cargar render precargado si está disponible
    useEffect(() => {
      const loadCachedRender = async () => {
        if (conversationId) {
          try {
            const renderData = await chatService.getCachedMessageRender(conversationId, item.messageId);
            if (renderData) {
              setCachedRenderData(renderData);
              console.log(`🎨 Chat: Usando render precargado para mensaje ${item.messageId}`);
            }
          } catch (error) {
            console.log(`ℹ️ Chat: No hay render precargado para mensaje ${item.messageId}, generando dinámicamente`);
          } finally {
            setIsLoadingRender(false);
          }
        } else {
          setIsLoadingRender(false);
        }
      };
      
      loadCachedRender();
    }, [conversationId, item.messageId]);
    
    // Usar datos precargados o calcular dinámicamente
    const isReply = cachedRenderData?.isReply ?? isReplyMessage(item.content);
    const { originalMessage, replyText } = cachedRenderData?.replyData ?? parseReplyMessage(item.content);
    const formattedTime = cachedRenderData?.formattedTime ?? formatMessageTime(item.createdAt);

    const panGesture = Gesture.Pan()
      .onUpdate((event) => {
        translateX.value = event.translationX;
      })
      .onEnd((event) => {
        const { translationX, velocityX } = event;
        
        // Si se desliza hacia la derecha más de 50px o con velocidad alta hacia la derecha
        if (translationX > 50 || velocityX > 500) {
          // Establecer como mensaje a responder usando runOnJS
          runOnJS(setReplyingTo)(item);
        }
        
        // Animar de vuelta a la posición original
        translateX.value = withSpring(0);
      })
      .activeOffsetX([-10, 10])
      .failOffsetY([-5, 5])
      .minPointers(1)
      .maxPointers(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ translateX: translateX.value }],
      };
    });

    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.messageContainer, 
            isMine ? styles.messageContainerMine : styles.messageContainerOther,
            animatedStyle,
          ]}
        >
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            {isReply ? (
              <View style={styles.replyMessageContainer}>
                <View style={[styles.originalMessagePreview, isMine ? styles.originalMessagePreviewMine : styles.originalMessagePreviewOther]}>
                  <View style={styles.replyIndicator} />
                  <Text style={[styles.originalMessageText, isMine ? styles.originalMessageTextMine : styles.originalMessageTextOther]} numberOfLines={1}>
                    {originalMessage}
                  </Text>
                </View>
                <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
                  {replyText}
                </Text>
              </View>
            ) : (
              <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
                {item.content}
              </Text>
            )}
            
            {/* Indicador de render precargado (solo en desarrollo) */}
            {__DEV__ && cachedRenderData && (
              <View style={styles.preloadedIndicator}>
                <Text style={styles.preloadedText}>🎨</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  });

  // Función de renderizado optimizada (memoizada)
  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    return <SwipeableMessage item={item} />;
  }, []);

  // Función de extracción de clave optimizada (memoizada)
  const keyExtractor = useCallback((item: ChatMessage, index: number) => {
    // Usar messageId como clave principal, con índice como fallback para garantizar unicidad
    return `${item.messageId}-${index}`;
  }, []);

  // Componente de skeleton optimizado
  const SkeletonMessage = React.memo(() => (
    <View style={styles.skeletonMessage}>
      <View style={[styles.skeletonBubble, styles.skeletonBubbleOther]} />
    </View>
  ));

  // Componente de skeleton para múltiples mensajes
  const SkeletonLoader = React.memo(() => (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: 5 }).map((_, index) => (
        <SkeletonMessage key={index} />
      ))}
    </View>
  ));

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header optimizado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#F9C80E" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.userInfo}>
            <View style={styles.profileImageContainer}>
              {otherUserInfo?.profileImage ? (
                <Image 
                  source={{ uri: otherUserInfo.profileImage }} 
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.defaultProfileImage}>
                  <Text style={styles.defaultProfileText}>
                    {otherUserInfo?.name ? otherUserInfo.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {otherUserInfo?.name || 'Usuario'}
            </Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        inverted={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        // Optimizaciones de rendimiento
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        getItemLayout={undefined} // No usar getItemLayout para mensajes de altura variable
        ListEmptyComponent={
          messages.length === 0 ? (
            showSkeleton ? (
              <SkeletonLoader />
            ) : isInitialLoadComplete && !isSyncing ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>No hay mensajes aún</Text>
                <Text style={styles.emptySubtext}>Envía el primer mensaje para comenzar la conversación</Text>
              </View>
            ) : null
          ) : null
        }
        ListFooterComponent={
          isLoadingOlderMessages ? (
            <View style={styles.loadingOlderContainer}>
              <Ionicons name="hourglass-outline" size={24} color="#666" />
              <Text style={styles.loadingOlderText}>Cargando mensajes anteriores...</Text>
            </View>
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {replyingTo && (
          <View style={styles.replyContainer}>
            <View style={styles.replyContent}>
              <View style={styles.replyHeader}>
                <View style={styles.replyHeaderLeft}>
                  <View style={styles.replyIconContainer}>
                    <Ionicons name="return-up-back" size={14} color="#F9C80E" />
                  </View>
                  <Text style={styles.replyLabel}>Respondiendo a:</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyCloseBtn}>
                  <Ionicons name="close" size={16} color="#F9C80E" />
                </TouchableOpacity>
              </View>
              <View style={styles.replyMessagePreview}>
                <View style={styles.replyIndicatorSmall} />
                <Text style={styles.replyText} numberOfLines={2}>
                  {replyingTo.content}
                </Text>
              </View>
            </View>
          </View>
        )}
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
            placeholderTextColor="#888"
            style={styles.textInput}
            multiline
            maxLength={1000}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity 
            onPress={handleSend} 
            disabled={isSending || !input.trim()} 
            style={[styles.sendBtn, { opacity: input.trim() ? 1 : 0.5 }]}
          >
            <Ionicons name="send" size={20} color={input.trim() ? '#000' : '#666'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
});

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  defaultProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultProfileText: {
    color: '#F9C80E',
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  skeletonContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  skeletonMessage: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  skeletonBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
  },
  skeletonBubbleOther: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    width: 200,
  },
  skeletonBubbleMine: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    width: 150,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageContainerMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageContainerOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleMine: {
    backgroundColor: '#F9C80E',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#2A2A2A',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: '#000000',
    fontWeight: '500',
  },
  bubbleTextOther: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  time: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  timeMine: {
    color: '#F9C80E',
    textAlign: 'right',
  },
  timeOther: {
    color: '#999999',
    textAlign: 'left',
  },
  senderInfo: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
    textAlign: 'left',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  textInput: {
    color: '#fff',
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    fontSize: 16,
  },
  sendBtn: {
    marginLeft: 12,
    backgroundColor: '#F9C80E',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F9C80E',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  replyContainer: {
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F9C80E',
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(249, 200, 14, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  replyLabel: {
    color: '#F9C80E',
    fontSize: 12,
    fontWeight: '600',
  },
  replyCloseBtn: {
    padding: 4,
  },
  replyMessagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  replyIndicatorSmall: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#F9C80E',
    marginRight: 8,
  },
  replyText: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
    flex: 1,
  },
  replyMessageContainer: {
    width: '100%',
  },
  originalMessagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  originalMessagePreviewMine: {
    backgroundColor: 'rgba(249, 200, 14, 0.1)',
    borderLeftColor: '#F9C80E',
  },
  originalMessagePreviewOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderLeftColor: '#666666',
  },
  replyIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  originalMessageText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
  },
  originalMessageTextMine: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  originalMessageTextOther: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  loadingOlderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  loadingOlderText: {
    color: '#666',
    fontSize: 14,
    marginLeft: 8,
  },
  preloadedIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F9C80E',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },
  preloadedText: {
    fontSize: 8,
    color: '#000000',
  }
});


