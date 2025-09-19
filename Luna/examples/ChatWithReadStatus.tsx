import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import { useChat } from '@/contexts/ChatProvider';
import { useReadStatusSync } from '@/hooks/useReadStatusSync';
import { ChatMessage } from '@/services/optimizedChatService';

interface ChatWithReadStatusProps {
  conversationId: string;
}

/**
 * Ejemplo de componente de chat que demuestra el uso del sistema de sincronización por lotes
 * para mensajes leídos
 */
export const ChatWithReadStatus: React.FC<ChatWithReadStatusProps> = ({ conversationId }) => {
  const { getMessages, markAsRead, getChatByConversationId } = useChat();
  const { syncReadStatusQueue, getReadStatusStats, isMessageRead } = useReadStatusSync();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Cargar mensajes cuando cambie la conversación
  useEffect(() => {
    const chatMessages = getMessages(conversationId);
    setMessages(chatMessages);
  }, [conversationId, getMessages]);

  // Actualizar estadísticas cada 3 segundos
  useEffect(() => {
    const updateStats = () => {
      const currentStats = getReadStatusStats();
      setStats(currentStats);
    };

    updateStats();
    const interval = setInterval(updateStats, 3000);

    return () => clearInterval(interval);
  }, [getReadStatusStats]);

  // Marcar todos los mensajes como leídos
  const handleMarkAllAsRead = async () => {
    try {
      await markAsRead(conversationId);
      console.log('✅ Todos los mensajes marcados como leídos');
    } catch (error) {
      console.error('❌ Error marcando mensajes como leídos:', error);
      Alert.alert('Error', 'No se pudieron marcar los mensajes como leídos');
    }
  };

  // Sincronizar manualmente
  const handleSyncNow = async () => {
    try {
      await syncReadStatusQueue();
      Alert.alert('Éxito', 'Cola de sincronización procesada');
    } catch (error) {
      console.error('❌ Error sincronizando:', error);
      Alert.alert('Error', 'No se pudo sincronizar con el servidor');
    }
  };

  // Renderizar un mensaje individual
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isRead = isMessageRead(conversationId, item.messageId);
    const isFromMe = item.senderId === 'current-user-id'; // Reemplazar con ID real del usuario

    return (
      <View style={[
        styles.messageContainer,
        isFromMe ? styles.myMessage : styles.otherMessage
      ]}>
        <Text style={styles.messageContent}>{item.content}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {new Date(item.createdAt).toLocaleTimeString()}
          </Text>
          {isFromMe && (
            <Text style={[
              styles.readStatus,
              isRead ? styles.readStatusRead : styles.readStatusUnread
            ]}>
              {isRead ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header con controles */}
      <View style={styles.header}>
        <Text style={styles.title}>Chat con Sincronización por Lotes</Text>
        <TouchableOpacity 
          style={styles.debugButton}
          onPress={() => setShowDebugInfo(!showDebugInfo)}
        >
          <Text style={styles.debugButtonText}>Debug</Text>
        </TouchableOpacity>
      </View>

      {/* Información de debug */}
      {showDebugInfo && stats && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugTitle}>Estado de Sincronización</Text>
          <Text style={styles.debugText}>
            Cola de lotes: {stats.queueLength} | 
            Procesando: {stats.isProcessing ? 'Sí' : 'No'} | 
            Mensajes leídos: {stats.totalReadMessages}
          </Text>
        </View>
      )}

      {/* Lista de mensajes */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.messageId}
        style={styles.messagesList}
        inverted
      />

      {/* Controles */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={handleMarkAllAsRead}
        >
          <Text style={styles.controlButtonText}>Marcar como Leído</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.syncButton]}
          onPress={handleSyncNow}
        >
          <Text style={styles.controlButtonText}>Sincronizar Ahora</Text>
        </TouchableOpacity>
      </View>

      {/* Información del sistema */}
      <View style={styles.systemInfo}>
        <Text style={styles.systemInfoText}>
          💡 Los mensajes se marcan como leídos instantáneamente y se sincronizan automáticamente
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  debugButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugInfo: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#1976d2',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2196F3',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
  },
  messageContent: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
  },
  readStatus: {
    fontSize: 12,
    marginLeft: 8,
  },
  readStatusRead: {
    color: '#4CAF50',
  },
  readStatusUnread: {
    color: '#FF9800',
  },
  controls: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 6,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  syncButton: {
    backgroundColor: '#FF9800',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  systemInfo: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  systemInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ChatWithReadStatus;
