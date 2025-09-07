import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Animated } from 'react-native';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import chatService, { Conversation } from '@/services/chatService';

interface ConversationItem extends Conversation {
  otherUserId: string;
  otherUser?: any;
  otherUserName?: string;
  isOnline?: boolean;
  lastSeen?: string;
  avatarUrl?: string;
  age?: number | null;
  gender?: 'male' | 'female' | 'other';
  country?: string;
  countryFlag?: string;
  description?: string;
  lastConnection?: string;
  unreadCount?: number;
  // Información adicional del usuario
  username?: string;
  email?: string;
  profileCompleted?: boolean;
  birthDate?: string;
  location?: any;
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenConversations, setHiddenConversations] = useState<Set<string>>(new Set());
  const [hasPreloaded, setHasPreloaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Función para precargar mensajes de conversaciones importantes (solo una vez)
  const preloadConversationMessages = useCallback(async (conversations: ConversationItem[]) => {
    if (!user?.id || conversations.length === 0 || hasPreloaded) return;
    
    try {
      // Marcar como precargado para evitar ejecuciones repetitivas
      setHasPreloaded(true);
      
      // 1. Primero precargar conversaciones de alta prioridad (basadas en uso histórico)
      await chatService.preloadHighPriorityConversations();
      
      // 2. Luego precargar las 5 conversaciones más recientes (reducido para mejor rendimiento)
      const conversationsToPreload = conversations
        .sort((a, b) => new Date(b.lastMessageAt || b.updatedAt).getTime() - new Date(a.lastMessageAt || a.updatedAt).getTime())
        .slice(0, 5);
      
      if (conversationsToPreload.length > 0) {
        console.log(`🚀 Precargando ${conversationsToPreload.length} conversaciones recientes`);
      }
      
      // Precargar mensajes en paralelo para las conversaciones más importantes
      const preloadPromises = conversationsToPreload.map(async (conversation) => {
        try {
          // Verificar si ya está en caché
          const isLoaded = await chatService.isConversationLoaded(conversation.conversationId);
          if (isLoaded) {
            console.log(`✅ Conversación ${conversation.conversationId} ya está precargada`);
            return; // Ya está precargada, no hacer nada
          }
          
          console.log(`🔄 Precargando mensajes para conversación ${conversation.conversationId}`);
          
          // OPTIMIZACIÓN: Precargar solo los últimos 20 mensajes para mejor rendimiento
          const result = await chatService.getMessages(conversation.conversationId, { limit: 20 });
          
          // Marcar explícitamente como cargada para asegurar que se detecte
          await chatService.markConversationAsLoaded(conversation.conversationId);
          
          console.log(`✅ Precargados ${result.items?.length || 0} mensajes para conversación ${conversation.conversationId}`);
        } catch (error) {
          console.error(`❌ Error precargando conversación ${conversation.conversationId}:`, error);
        }
      });
      
      // Ejecutar precarga en paralelo
      await Promise.allSettled(preloadPromises);
      
      console.log('🎉 Precarga de conversaciones completada');
      
    } catch (error) {
      console.error('❌ Error en precarga de conversaciones:', error);
    }
  }, [user?.id, hasPreloaded]);

  // Función para cargar conversaciones desde el servidor
  const loadConversationsFromServer = useCallback(async (): Promise<ConversationItem[]> => {
    if (!user?.id) return [];
    
    try {
      const result = await chatService.getConversations({ limit: 20 });
      const items = result?.items || [];
      
      if (items.length === 0) {
        return [];
      }
      
      // Procesar conversaciones reales - el backend ya incluye otherUserId y otherUser
      const processedConversations: ConversationItem[] = items
        .filter((conv: any) => {
          const conversationId = conv.conversationId?.S || conv.conversationId;
          const otherUserId = conv.otherUserId?.S || conv.otherUserId;
          
          // Verificar que la conversación tenga un otherUserId válido
          if (!otherUserId) {
            return false;
          }
          
          // Verificar que el otherUserId no sea el usuario actual
          if (user?.id && String(otherUserId) === String(user.id)) {
            return false;
          }
          
          return true;
        })
        .map((conv: any) => {
          const conversationId = conv.conversationId?.S || conv.conversationId;
          const lastMessagePreview = conv.lastMessagePreview?.S || conv.lastMessagePreview;
          const lastMessageAt = conv.lastMessageAt?.S || conv.lastMessageAt;
          const createdAt = conv.createdAt?.S || conv.createdAt;
          const updatedAt = conv.updatedAt?.S || conv.updatedAt;
          const otherUserId = conv.otherUserId?.S || conv.otherUserId;
          
          return {
            conversationId: conversationId,
            participants: [user?.id || '', otherUserId], // Reconstruir participantes
            createdAt: createdAt,
            updatedAt: updatedAt,
            lastMessagePreview: lastMessagePreview,
            lastMessageAt: lastMessageAt,
            otherUserId: otherUserId,
            otherUserName: conv.otherUser?.name || conv.otherUser?.username || generateFriendlyName(otherUserId, conv.otherUser),
            isOnline: conv.otherUser?.isOnline || false,
            lastSeen: conv.otherUser?.lastSeen || conv.otherUser?.lastConnection || 'unknown',
            avatarUrl: conv.otherUser?.profileImage,
            age: conv.otherUser?.age || null,
            gender: conv.otherUser?.gender || 'other',
            country: conv.otherUser?.country || 'Unknown',
            countryFlag: conv.otherUser?.countryFlag || '🌍',
            description: conv.otherUser?.description || 'Usuario de Luna',
            lastConnection: conv.otherUser?.lastConnection || lastMessageAt,
            unreadCount: conv.unreadCount || 0,
            // Información adicional del usuario
            username: conv.otherUser?.username,
            email: conv.otherUser?.email,
            profileCompleted: conv.otherUser?.profileCompleted || false,
            birthDate: conv.otherUser?.birthDate,
            location: conv.otherUser?.location
          };
        });
      
      return processedConversations;
    } catch (error) {
      console.error('❌ Error cargando conversaciones desde servidor:', error);
      return [];
    }
  }, []);

  // Función para cargar conversaciones desde caché
  const loadConversationsFromCache = useCallback(async (): Promise<ConversationItem[]> => {
    try {
      // Intentar cargar conversaciones desde caché local primero
      const cacheInfo = await chatService.getCacheInfo();
      const cachedConversationIds = Object.keys(cacheInfo);
      
      if (cachedConversationIds.length === 0) {
        console.log('📭 No hay conversaciones en caché, cargando desde servidor...');
        return await loadConversationsFromServer();
      }

      // Si hay conversaciones en caché, intentar cargar desde servidor para obtener datos actualizados
      // pero mostrar las del caché inmediatamente
      const serverConversations = await loadConversationsFromServer();
      return serverConversations;
      
    } catch (error) {
      console.error('❌ Error cargando conversaciones desde caché:', error);
      // Fallback: cargar desde servidor
      return await loadConversationsFromServer();
    }
  }, [loadConversationsFromServer]);

  // Función para precargar los últimos 10 mensajes de cada conversación desde caché
  const preloadLastMessagesFromCache = useCallback(async (conversations: ConversationItem[]) => {
    try {
      const preloadPromises = conversations.map(async (conversation) => {
        try {
          // Verificar si ya tiene mensajes en caché
          const hasCachedMessages = await chatService.getCachedMessagesWithState(conversation.conversationId);
          
          if (hasCachedMessages.messages.length === 0) {
            // Si no hay mensajes en caché, cargar los últimos 10 desde el servidor
            console.log(`📥 Cargando últimos 10 mensajes para conversación ${conversation.conversationId}`);
            await chatService.getMessages(conversation.conversationId, { limit: 10 });
          } else {
            console.log(`✅ Conversación ${conversation.conversationId} ya tiene ${hasCachedMessages.messages.length} mensajes en caché`);
          }
        } catch (error) {
          console.error(`❌ Error precargando mensajes para conversación ${conversation.conversationId}:`, error);
        }
      });
      
      await Promise.allSettled(preloadPromises);
      console.log('✅ Precarga de mensajes desde caché completada');
      
    } catch (error) {
      console.error('❌ Error en precarga de mensajes desde caché:', error);
    }
  }, []);

  // Función para sincronizar con el servidor en segundo plano (solo nuevos mensajes)
  const syncWithServerInBackground = useCallback(async (conversations: ConversationItem[]) => {
    try {
      // Sincronizar cada conversación para obtener solo mensajes nuevos
      const syncPromises = conversations.map(async (conversation) => {
        try {
          console.log(`🔄 Sincronizando incrementalmente conversación ${conversation.conversationId}...`);
          
          // Usar la nueva función de sincronización incremental
          const syncResult = await chatService.syncConversationIncremental(conversation.conversationId);
          
          if (syncResult.newMessagesCount > 0) {
            console.log(`📨 Sincronizados ${syncResult.newMessagesCount} mensajes nuevos para conversación ${conversation.conversationId}`);
          } else {
            console.log(`✅ Conversación ${conversation.conversationId} ya está sincronizada`);
          }
        } catch (error) {
          console.error(`❌ Error sincronizando conversación ${conversation.conversationId}:`, error);
        }
      });
      
      await Promise.allSettled(syncPromises);
      console.log('✅ Sincronización incremental en segundo plano completada');
      
    } catch (error) {
      console.error('❌ Error en sincronización en segundo plano:', error);
    }
  }, []);

  // Función para cargar conversaciones desde caché primero, luego sincronizar
  const loadConversations = useCallback(async (forceSync = false) => {
    if (!user?.id) return;
    
    setIsInitializing(true);
    try {
      // Solo inicializar chat si no está conectado
      const status = chatService.getConnectionStatus();
      if (!status.isConnected) {
        await chatService.initializeChat(user.id);
      }

      // PASO 1: Cargar conversaciones desde caché (instantáneo)
      console.log('🚀 Cargando conversaciones desde caché...');
      const cachedConversations = await loadConversationsFromCache();
      
      if (cachedConversations.length > 0) {
        console.log(`✅ Cargadas ${cachedConversations.length} conversaciones desde caché`);
        setConversations(cachedConversations);
      }

      // PASO 2: Cargar los 10 últimos mensajes de cada conversación activa desde caché
      if (cachedConversations.length > 0) {
        console.log('📱 Precargando últimos 10 mensajes de cada conversación desde caché...');
        await preloadLastMessagesFromCache(cachedConversations);
      }

      // PASO 3: Sincronizar con el servidor en segundo plano (solo nuevos mensajes)
      console.log('🔄 Iniciando sincronización con servidor en segundo plano...');
      syncWithServerInBackground(cachedConversations);
      
    } catch (error) {
      console.error('❌ Error cargando conversaciones:', error);
      console.error('📋 Detalles del error:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        user: user?.id
      });
    } finally {
      setIsInitializing(false);
    }
  }, [user?.id, loadConversationsFromCache, preloadLastMessagesFromCache, syncWithServerInBackground]);

  // Función para sincronizar conversaciones cuando la pantalla recibe foco
  const syncConversationsOnFocus = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Solo sincronizar en segundo plano, no recargar toda la pantalla
      console.log('🔄 Sincronización rápida al recibir foco...');
      
      // Obtener conversaciones actuales usando una función de estado
      setConversations(currentConversations => {
        if (currentConversations.length > 0) {
          // Sincronizar solo mensajes nuevos en segundo plano
          syncWithServerInBackground(currentConversations);
        } else {
          // Si no hay conversaciones, cargar desde servidor
          loadConversations(true);
        }
        return currentConversations; // No cambiar el estado, solo leerlo
      });
    } catch (error) {
      console.error('❌ Error sincronizando conversaciones:', error);
    }
  }, [user?.id, syncWithServerInBackground, loadConversations]);

  // Listener para cuando la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      // Throttle para evitar ejecuciones excesivas
      const timeoutId = setTimeout(() => {
        syncConversationsOnFocus();
      }, 500); // 500ms de delay
      
      return () => clearTimeout(timeoutId);
    }, [syncConversationsOnFocus])
  );

  // Carga inicial de conversaciones
  useEffect(() => {
    const loadInitialConversations = async () => {
      if (!user?.id) return;
      
      // Reset del flag de precarga cuando cambia el usuario
      setHasPreloaded(false);
      
      setLoading(true);
      try {
        await loadConversations(false);
      } finally {
        setLoading(false);
      }
    };

    loadInitialConversations();
  }, [user?.id]); // Removemos loadConversations de las dependencias

  // Escuchar nuevos mensajes para mostrar conversaciones ocultas
  useEffect(() => {
    if (!user?.id) return;

    const handleNewMessage = (message: any) => {
      // Verificar si el mensaje es relevante para el usuario actual
      // (ya sea que lo recibió O lo envió)
      const isRelevantMessage = message.receiverId === user.id || message.senderId === user.id;
      
      if (!isRelevantMessage) {
        return;
      }
      
      // Si el mensaje es de una conversación oculta, la mostramos de nuevo
      // Usamos una función callback para acceder al estado más reciente
      if (message.conversationId) {
        setHiddenConversations(prev => {
          if (prev.has(message.conversationId)) {
            const newSet = new Set(prev);
            newSet.delete(message.conversationId);
            return newSet;
          }
          return prev;
        });
      }
    };

    // Agregar listener para nuevos mensajes
    chatService.onNewMessage(handleNewMessage);

    // Cleanup al desmontar el componente
    return () => {
      chatService.offNewMessage(handleNewMessage);
    };
  }, [user?.id]); // Removemos hiddenConversations de las dependencias

  const handleConversationPress = async (conversation: ConversationItem) => {
    try {
      // Registrar acceso a la conversación para mejorar la precarga
      await chatService.recordConversationAccess(conversation.conversationId);
      
      // Verificar si ya está precargada
      const isLoaded = await chatService.isConversationLoaded(conversation.conversationId);
      
      if (!isLoaded) {
        // Precargar mensajes en paralelo con la navegación (solo los últimos 20)
        console.log(`🚀 Precargando últimos 20 mensajes para conversación ${conversation.conversationId} antes de navegar`);
        const preloadPromise = chatService.getMessages(conversation.conversationId, { limit: 20 });
        
        // Navegar inmediatamente, la precarga continuará en segundo plano
        router.push({ 
          pathname: '/chat/[userId]', 
          params: { 
            userId: conversation.otherUserId,
            userName: conversation.otherUserName || 'Usuario',
            userImage: conversation.avatarUrl || '',
            userAge: conversation.age?.toString() || '',
            userGender: conversation.gender || 'other',
            userCountry: conversation.country || 'Unknown',
            userCountryFlag: conversation.countryFlag || '🌍',
            isOnline: conversation.isOnline?.toString() || 'false'
          } 
        });
        
        // Esperar a que termine la precarga y marcar como cargada
        preloadPromise.then(async (result) => {
          console.log(`✅ Precarga completada para conversación ${conversation.conversationId}: ${result.items?.length || 0} mensajes`);
          // Marcar explícitamente como cargada para asegurar detección
          await chatService.markConversationAsLoaded(conversation.conversationId);
        }).catch((error) => {
          console.error(`❌ Error en precarga para conversación ${conversation.conversationId}:`, error);
        });
      } else {
        // Ya está precargada, navegar directamente
        console.log(`✅ Conversación ${conversation.conversationId} ya está precargada, navegando directamente`);
        router.push({ 
          pathname: '/chat/[userId]', 
          params: { 
            userId: conversation.otherUserId,
            userName: conversation.otherUserName || 'Usuario',
            userImage: conversation.avatarUrl || '',
            userAge: conversation.age?.toString() || '',
            userGender: conversation.gender || 'other',
            userCountry: conversation.country || 'Unknown',
            userCountryFlag: conversation.countryFlag || '🌍',
            isOnline: conversation.isOnline?.toString() || 'false'
          } 
        });
      }
    } catch (error) {
      console.error('Error precargando mensajes antes de navegar:', error);
      // Navegar de todas formas en caso de error
      router.push({ 
        pathname: '/chat/[userId]', 
        params: { 
          userId: conversation.otherUserId,
          userName: conversation.otherUserName || 'Usuario',
          userImage: conversation.avatarUrl || '',
          userAge: conversation.age?.toString() || '',
          userGender: conversation.gender || 'other',
          userCountry: conversation.country || 'Unknown',
          userCountryFlag: conversation.countryFlag || '🌍',
          isOnline: conversation.isOnline?.toString() || 'false'
        } 
      });
    }
  };

  const handleHideConversation = (conversationId: string) => {
    setHiddenConversations(prev => new Set([...prev, conversationId]));
  };

  const getGenderIcon = (gender?: string) => {
    switch (gender) {
      case 'male':
        return '♂';
      case 'female':
        return '♀';
      default:
        return '⚧';
    }
  };

  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case 'male':
        return '#4A90E2';
      case 'female':
        return '#E24A90';
      default:
        return '#FFD700';
    }
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'U';
    const initials = name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return initials || 'U';
  };

  const generateFriendlyName = (userId: string, userData?: any) => {
    if (!userId) return 'Usuario';
    
    // Si tenemos información del usuario, usar su nombre real
    if (userData?.name && userData.name !== `Usuario ${userId.slice(-4)}`) {
      return userData.name;
    }
    
    if (userData?.username && userData.username !== `user_${userId.slice(-4)}`) {
      return userData.username;
    }
    
    // Si no hay información real, generar un nombre amigable
    const lastFour = userId.slice(-4);
    const names = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Avery', 'Quinn', 'Blake'];
    const index = parseInt(lastFour, 16) % names.length;
    
    return `${names[index]} ${lastFour}`;
  };

  const getTimeAgo = (dateString: string) => {
    if (!dateString) return 'Offline';
    try {
      const now = new Date();
      const lastSeen = new Date(dateString);
      const diffMs = now.getTime() - lastSeen.getTime();
      
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMinutes < 60) {
        return diffMinutes <= 1 ? 'Hace 1 min' : `Hace ${diffMinutes} min`;
      } else if (diffHours < 24) {
        return diffHours === 1 ? 'Hace 1 hora' : `Hace ${diffHours} horas`;
      } else {
        return diffDays === 1 ? 'Hace 1 día' : `Hace ${diffDays} días`;
      }
    } catch (error) {
      return 'Offline';
    }
  };

  const SwipeableConversationItem = ({ item }: { item: ConversationItem }) => {
    const translateX = new Animated.Value(0);
    const opacity = new Animated.Value(1);

    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationX: translateX } }],
      { useNativeDriver: true }
    );

    const onHandlerStateChange = (event: any) => {
      if (event.nativeEvent.state === State.END) {
        const { translationX, velocityX } = event.nativeEvent;
        
        // Si se desliza más de 100px hacia la izquierda o con velocidad alta hacia la izquierda
        if (translationX < -100 || velocityX < -500) {
          // Animar hacia la izquierda y desvanecer
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -300,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            handleHideConversation(item.conversationId);
          });
        } else {
          // Volver a la posición original
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      }
    };

    return (
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-5, 5]}
        minPointers={1}
        maxPointers={1}
      >
        <Animated.View
          style={[
            styles.swipeableContainer,
            {
              transform: [{ translateX }],
              opacity,
            },
          ]}
        >
          <TouchableOpacity 
            style={styles.conversationItem}
            onPress={() => handleConversationPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.content}>
              {/* Profile Picture */}
              <View style={styles.profileContainer}>
                {item.avatarUrl ? (
                  <View style={styles.profileImage}>
                    <Text style={styles.avatarText}>
                      {item.otherUserName && typeof item.otherUserName === 'string' ? item.otherUserName.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Text style={styles.initialsText}>
                      {item.otherUserName && typeof item.otherUserName === 'string' ? getInitials(item.otherUserName) : 'U'}
                    </Text>
                  </View>
                )}
                
                {/* Online Status Indicator */}
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: item.isOnline ? '#4CAF50' : '#666666' }
                ]} />
              </View>

              {/* User Info */}
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{String(item.otherUserName || 'Usuario')}</Text>
                  <View style={styles.genderAgeContainer}>
                    <Text style={[styles.genderIcon, { color: getGenderColor(item.gender) }]}>
                      {String(getGenderIcon(item.gender) || '⚧')}
                    </Text>
                    <Text style={styles.age}>{item.age ? String(item.age) : '?'}</Text>
                    <Text style={styles.countryFlag}>{String(item.countryFlag || '🌍')}</Text>
                  </View>
                </View>
                
                <Text style={styles.description} numberOfLines={2}>
                  {String(item.lastMessagePreview || 'Iniciar conversación...')}
                </Text>
              </View>

              {/* Online Status and Unread Messages */}
              <View style={styles.statusContainer}>
                <Text style={[styles.statusText, { color: item.isOnline ? '#4CAF50' : '#ADB5BD' }]}>
                  {String(item.isOnline ? 'Online' : (item.lastConnection ? getTimeAgo(item.lastConnection) : 'Offline'))}
                </Text>
                {(item.unreadCount && item.unreadCount > 0) ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  const renderConversation = ({ item }: { item: ConversationItem }) => {
    return <SwipeableConversationItem item={item} />;
  };

  if (loading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.statusBar}>
          <Text style={styles.timeText}>Loading...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F9C80E" />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      

      {/* Sección de avatares */}
      <View style={styles.avatarsSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarsContainer}>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={20} color="#000000" />
          </TouchableOpacity>
          
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarCircleText}>👩</Text>
          </View>
          
          <View style={styles.avatarWithInitials}>
            <Text style={styles.avatarInitialsText}>SA</Text>
          </View>
          
          <TouchableOpacity style={styles.groupButton}>
            <Ionicons name="people" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a chat..."
          placeholderTextColor="#888888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Ionicons name="search" size={20} color="#F9C80E" style={styles.searchIcon} />
      </View>

      {/* Lista de conversaciones */}
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>No hay conversaciones</Text>
          <Text style={styles.emptySubtitle}>
            Ve a un perfil y toca el ícono de mensaje para iniciar un chat
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations.filter(conv => !hiddenConversations.has(conv.conversationId))}
          keyExtractor={(item) => item.conversationId || `conversation-${Math.random()}`}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginLeft: 4,
  },
  avatarsSection: {
    marginTop: 50,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  avatarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarCircleText: {
    fontSize: 20,
  },
  avatarWithInitials: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitialsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  groupButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F9C80E',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 3,
    backgroundColor: '#1a1a1a',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  searchIcon: {
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#CCCCCC',
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 0,
  },
  swipeableContainer: {
    backgroundColor: '#1a1a1a',
  },
  conversationItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 38,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  genderAgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  age: {
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 6,
  },
  countryFlag: {
    fontSize: 16,
  },
  description: {
    fontSize: 12,
    color: '#CCCCCC',
    lineHeight: 16,
  },
  statusContainer: {
    alignItems: 'flex-end',
    marginTop: -35,
  },
  statusText: {
    fontSize: 12,
    color: '#ADB5BD',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#F9C80E',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
});