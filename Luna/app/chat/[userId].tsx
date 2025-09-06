import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '@/services/apiService';
import socketService from '@/services/socketService';
import cacheService from '@/services/cacheService';
import chatService from '@/services/chatService';
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

export default function ChatScreen() {
  const { userId: otherUserId } = useLocalSearchParams();
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Usar el hook de caché optimizado
  const {
    messages,
    isLoading,
    isSyncing,
    isLoaded,
    cacheVersion,
    syncStatus,
    loadFromCache,
    syncWithServer,
    addMessage,
    needsSync,
    markAsLoaded
  } = useChatCache({ 
    conversationId, 
    autoSync: false // Desactivamos auto-sync para control manual
  });

  const currentUserId = useMemo(() => {
    // Ahora el ID de DynamoDB es el mismo que el amplifySub
    return user?.id || user?.amplifySub || '';
  }, [user]);

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
      // Usar el método del hook para añadir mensaje
      await addMessage(message);
      
      // Scroll automático al final
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      
      console.log('✅ Mensaje añadido a la conversación actual');
    } else {
      console.log('ℹ️ Mensaje recibido para otra conversación, ignorando');
    }
  }, [addMessage, conversationId]);

  useEffect(() => {
    const init = async () => {
      if (!otherUserId || !currentUserId) return;
      
      try {
        // Conectar WebSocket
        await socketService.connect(currentUserId);
        
        // Obtener/crear conversación
        const conv = await ApiService.getOrCreateConversationWith(String(otherUserId));
        const convId = conv?.data?.conversationId;
        
        if (convId) {
          setConversationId(convId);
          
          // Marcar conversación como activa para sincronización prioritaria
          chatService.markConversationActive(convId, true);
          
          // 1. Verificar si la conversación ya está cargada para evitar recargas
          const isAlreadyLoaded = await cacheService.isConversationLoaded(convId);
          
          if (isAlreadyLoaded) {
            console.log(`✅ Conversación ${convId} ya está cargada, evitando recarga`);
            // Solo cargar desde caché sin sincronizar
            await loadFromCache();
            await markAsLoaded();
          } else {
            // 2. Cargar mensajes desde caché primero (carga instantánea)
            await loadFromCache();
            
            // 3. Verificar si necesitamos sincronizar con el servidor
            const shouldSync = await needsSync();
            
            if (shouldSync) {
              console.log('🔄 Sincronizando mensajes con el servidor...');
              
              try {
                // Cargar mensajes desde el servidor
                const res = await ApiService.listMessages(convId, { limit: 40 });
                const serverMessages = (res.data?.items || []) as ChatMessage[];
                
                // Sincronizar usando el hook
                await syncWithServer(serverMessages);
                
                console.log(`🔄 Sincronizados ${serverMessages.length} mensajes desde el servidor`);
              } catch (syncError) {
                console.error('Error sincronizando mensajes:', syncError);
                // Si hay error de sincronización, marcar como cargada para evitar reintentos
                await markAsLoaded();
              }
            } else {
              console.log('✅ Caché actualizado, no se necesita sincronización');
              await markAsLoaded();
            }
          }
          
          // 4. Configurar WebSocket usando chatService (que maneja caché automáticamente)
          chatService.joinConversation(convId);
          chatService.onNewMessage(handleNewMessage);
          
          // 5. Scroll al final después de cargar
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
        }
      } catch (error) {
        console.error('Error inicializando chat:', error);
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
  }, [otherUserId, currentUserId, handleNewMessage, loadFromCache, needsSync, syncWithServer, markAsLoaded]);

  const handleSend = async () => {
    if (!conversationId || !input.trim() || !otherUserId) return;
    const text = input.trim();
    setInput('');
    setIsSending(true);
    
    try {
      // Enviar mensaje via API (que también emite via WebSocket)
      const response = await ApiService.sendMessage(conversationId, {
        content: text,
        receiverId: String(otherUserId),
        type: 'text'
      });
      
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

  const renderItem = ({ item }: { item: ChatMessage }) => {
    // Lógica simplificada: ahora el ID de DynamoDB es el mismo que el amplifySub
    const isMine = String(item.senderId) === String(currentUserId);
    
    return (
      <View style={[styles.messageContainer, isMine ? styles.messageContainerMine : styles.messageContainerOther]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>{item.content}</Text>
        </View>
        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
          {new Date(item.createdAt).toLocaleTimeString().slice(0,5)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#F9C80E" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Chat</Text>
          {isSyncing && (
            <View style={styles.syncIndicator}>
              <Ionicons name="sync" size={12} color="#F9C80E" />
              <Text style={styles.syncText}>Sincronizando...</Text>
            </View>
          )}
          {isLoaded && !isSyncing && (
            <View style={styles.cacheIndicator}>
              <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
              <Text style={styles.cacheText}>Caché v{cacheVersion}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {isLoading && messages.length === 0 && !isSyncing ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color="#666" />
          <Text style={styles.loadingText}>Cargando conversación...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.messageId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#888"
            style={styles.textInput}
            multiline
          />
          <TouchableOpacity onPress={handleSend} disabled={isSending || !input.trim()} style={styles.sendBtn}>
            <Ionicons name="send" size={20} color={input.trim() ? '#000' : '#666'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

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
  headerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  syncText: {
    color: '#F9C80E',
    fontSize: 10,
    marginLeft: 4,
  },
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cacheText: {
    color: '#4CAF50',
    fontSize: 10,
    marginLeft: 4,
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
  listContent: {
    padding: 16,
    paddingBottom: 8,
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
  }
});


