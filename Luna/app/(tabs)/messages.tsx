import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import chatService, { Conversation } from '@/services/chatService';

interface ConversationItem extends Conversation {
  otherUserId: string;
  otherUserName?: string;
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConversations = async () => {
      if (!user?.id) return;
      
      try {
        // Inicializar chat si no está conectado
        const status = chatService.getConnectionStatus();
        if (!status.isConnected) {
          await chatService.initializeChat(user.id);
        }

        // Cargar conversaciones
        const result = await chatService.getConversations({ limit: 20 });
        const items = result?.items || [];
        
        // Procesar conversaciones para mostrar info del otro usuario
        const processedConversations: ConversationItem[] = items.map((conv: any) => ({
          ...conv,
          otherUserId: conv.otherUserId || 'unknown',
          otherUserName: conv.otherUserName || 'Usuario'
        }));
        
        setConversations(processedConversations);
      } catch (error) {
        console.error('Error cargando conversaciones:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [user]);

  const handleConversationPress = (conversation: ConversationItem) => {
    router.push({ 
      pathname: '/chat/[userId]', 
      params: { userId: conversation.otherUserId } 
    });
  };

  const renderConversation = ({ item }: { item: ConversationItem }) => {
    const timeAgo = new Date(item.lastMessageAt).toLocaleTimeString().slice(0, 5);
    
    return (
      <TouchableOpacity 
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.otherUserName ? item.otherUserName.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.userName}>{item.otherUserName || 'Usuario'}</Text>
            <Text style={styles.time}>{timeAgo}</Text>
          </View>
          
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessagePreview || 'Iniciar conversación...'}
          </Text>
        </View>
        
        <Ionicons name="chevron-forward" size={16} color="#666" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.header}>
          <Text style={styles.title}>Mensajes</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F9C80E" />
          <Text style={styles.loadingText}>Cargando conversaciones...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Mensajes</Text>
        <TouchableOpacity style={styles.newChatButton}>
          <Ionicons name="create-outline" size={24} color="#F9C80E" />
        </TouchableOpacity>
      </View>

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
          data={conversations}
          keyExtractor={(item) => item.conversationId}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  newChatButton: {
    padding: 8,
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
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  time: {
    fontSize: 12,
    color: '#888888',
  },
  lastMessage: {
    fontSize: 14,
    color: '#CCCCCC',
  },
});