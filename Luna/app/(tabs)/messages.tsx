import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Animated } from 'react-native';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatProvider';

interface ConversationItem {
  conversationId: string;
  otherUser: {
    id: string;
    name: string;
    profileImage?: string;
    isOnline?: boolean;
    lastSeen?: string;
    age?: number;
    gender?: 'male' | 'female' | 'other';
    country?: string;
    countryFlag?: string;
  };
  lastMessagePreview?: string;
  lastActivity: Date;
  unreadCount: number;
  isTyping: boolean;
}

export default function GlobalMessagesScreen() {
  const { user } = useAuth();
  const { 
    activeChats, 
    isGlobalLoading, 
    refreshChats, 
    preloadChat, 
    getUnreadCount,
    openChat
  } = useChat();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenConversations, setHiddenConversations] = useState<Set<string>>(new Set());
  const [localLoading, setLocalLoading] = useState(true);

  // Convertir chats activos a formato de conversaciones para la UI
  const conversations: ConversationItem[] = React.useMemo(() => {
    const convArray: ConversationItem[] = [];
    
    for (const [conversationId, chat] of activeChats) {
      if (!hiddenConversations.has(conversationId)) {
        // Obtener último mensaje
        const lastMessage = chat.messages[0]; // Los mensajes están ordenados más recientes primero
        
        convArray.push({
          conversationId,
          otherUser: chat.otherUser,
          lastMessagePreview: lastMessage?.content || 'Iniciar conversación...',
          lastActivity: chat.lastActivity,
          unreadCount: chat.unreadCount,
          isTyping: chat.isTyping
        });
      }
    }
    
    // Ordenar por actividad más reciente
    return convArray.sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [activeChats, hiddenConversations]);

  // Filtrar conversaciones por búsqueda
  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.otherUser.name.toLowerCase().includes(query) ||
      (conv.lastMessagePreview?.toLowerCase().includes(query))
    );
  }, [conversations, searchQuery]);

  // Cargar inicial
  useEffect(() => {
    const loadInitial = async () => {
      try {
        if (!user?.id) return;
        
        setLocalLoading(true);
        console.log('🚀 GlobalMessages: Cargando mensajes globales');
        
        // El ChatProvider ya maneja la carga inicial
        // Solo esperamos un momento para que se inicialice
        setTimeout(() => {
          setLocalLoading(false);
        }, 1000);
        
      } catch (error) {
        console.error('❌ GlobalMessages: Error en carga inicial:', error);
        setLocalLoading(false);
      }
    };

    loadInitial();
  }, [user?.id]);

  // Refrescar cuando la pantalla recibe foco (con restricciones)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('🔄 GlobalMessages: Foco recibido');
        // Solo refrescar si han pasado más de 30 segundos desde la última carga
        // El ChatProvider ya maneja su propio refresco automático
      }
    }, [user?.id])
  );

  // Navegar a chat
  const handleConversationPress = async (conversation: ConversationItem) => {
    try {
      console.log(`🚀 GlobalMessages: Navegando a chat con ${conversation.otherUser.id}`);
      
      // Precargar en paralelo con la navegación
      preloadChat(conversation.otherUser.id, conversation.otherUser).catch((error) => {
        console.error(`❌ Error en precarga para ${conversation.otherUser.id}:`, error);
      });
      
      // Navegar inmediatamente
      router.push({ 
        pathname: '/chat/[userId]', 
        params: { 
          userId: conversation.otherUser.id,
          userName: conversation.otherUser.name,
          userImage: conversation.otherUser.profileImage || '',
          userAge: conversation.otherUser.age?.toString() || '',
          userGender: conversation.otherUser.gender || 'other',
          userCountry: conversation.otherUser.country || 'Unknown',
          userCountryFlag: conversation.otherUser.countryFlag || '🌍',
          isOnline: conversation.otherUser.isOnline?.toString() || 'false'
        } 
      });
    } catch (error) {
      console.error('❌ GlobalMessages: Error navegando a chat:', error);
    }
  };

  // Ocultar conversación
  const handleHideConversation = (conversationId: string) => {
    setHiddenConversations(prev => new Set([...prev, conversationId]));
  };

  // Funciones auxiliares
  const getGenderIcon = (gender?: string) => {
    switch (gender) {
      case 'male': return '♂';
      case 'female': return '♀';
      default: return '⚧';
    }
  };

  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case 'male': return '#4A90E2';
      case 'female': return '#E24A90';
      default: return '#FFD700';
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

  const getTimeAgo = (date: Date) => {
    try {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
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
      return 'Ahora';
    }
  };

  // Componente de conversación con gesto deslizable
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
        
        if (translationX < -100 || velocityX < -500) {
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
            { transform: [{ translateX }], opacity },
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
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.initialsText}>
                    {getInitials(item.otherUser.name)}
                  </Text>
                </View>
                
                {/* Online Status Indicator */}
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: item.otherUser.isOnline ? '#4CAF50' : '#666666' }
                ]} />
              </View>

              {/* User Info */}
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{item.otherUser.name}</Text>
                  <View style={styles.genderAgeContainer}>
                    <Text style={[styles.genderIcon, { color: getGenderColor(item.otherUser.gender) }]}>
                      {getGenderIcon(item.otherUser.gender)}
                    </Text>
                    <Text style={styles.age}>{item.otherUser.age || '?'}</Text>
                    <Text style={styles.countryFlag}>{item.otherUser.countryFlag || '🌍'}</Text>
                  </View>
                </View>
                
                <View style={styles.messageRow}>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessagePreview}
                  </Text>
                  {item.isTyping && (
                    <Text style={styles.typingIndicator}>escribiendo...</Text>
                  )}
                </View>
              </View>

              {/* Status and Unread */}
              <View style={styles.statusContainer}>
                <Text style={[styles.statusText, { color: item.otherUser.isOnline ? '#4CAF50' : '#ADB5BD' }]}>
                  {item.otherUser.isOnline ? 'Online' : getTimeAgo(item.lastActivity)}
                </Text>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount.toString()}
                    </Text>
                  </View>
                )}
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

  if (localLoading || isGlobalLoading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F9C80E" />
          <Text style={styles.loadingText}>Cargando chats...</Text>
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
          
          {/* Mostrar primeros usuarios de chats activos */}
          {Array.from(activeChats.values()).slice(0, 4).map((chat, index) => (
            <TouchableOpacity 
              key={chat.conversationId}
              style={styles.avatarCircle}
              onPress={() => handleConversationPress({
                conversationId: chat.conversationId,
                otherUser: chat.otherUser,
                lastMessagePreview: chat.messages[0]?.content,
                lastActivity: chat.lastActivity,
                unreadCount: chat.unreadCount,
                isTyping: chat.isTyping
              })}
            >
              <Text style={styles.avatarInitialsText}>
                {getInitials(chat.otherUser.name)}
              </Text>
              {chat.unreadCount > 0 && (
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>
                    {chat.unreadCount > 9 ? '9+' : chat.unreadCount.toString()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversación..."
          placeholderTextColor="#888888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Ionicons name="search" size={20} color="#F9C80E" style={styles.searchIcon} />
      </View>

      {/* Contador de mensajes no leídos */}
      {getUnreadCount() > 0 && (
        <View style={styles.unreadCountContainer}>
          <Text style={styles.unreadCountText}>
            {getUnreadCount()} mensaje{getUnreadCount() > 1 ? 's' : ''} sin leer
          </Text>
        </View>
      )}

      {/* Lista de conversaciones */}
      {filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery 
              ? 'Intenta con otros términos de búsqueda'
              : 'Ve a un perfil y toca el ícono de mensaje para iniciar un chat'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.conversationId}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={8}
          initialNumToRender={15}
          getItemLayout={(data, index) => ({
            length: 80,
            offset: 80 * index,
            index,
          })}
          refreshing={isGlobalLoading}
          onRefresh={refreshChats}
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
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarInitialsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  avatarBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  avatarBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
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
  unreadCountContainer: {
    backgroundColor: '#F9C80E',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  unreadCountText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
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
    textAlign: 'center',
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
  profilePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 12,
    color: '#CCCCCC',
    lineHeight: 16,
    flex: 1,
  },
  typingIndicator: {
    fontSize: 12,
    color: '#F9C80E',
    fontStyle: 'italic',
    marginLeft: 8,
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