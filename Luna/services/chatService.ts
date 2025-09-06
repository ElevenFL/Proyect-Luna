import ApiService from './apiService';
import socketService from './socketService';
import cacheService from './cacheService';
import backgroundSyncService from './backgroundSyncService';
import conversationStateService from './conversationStateService';

export interface ChatMessage {
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image';
  createdAt: string;
  conversationId?: string; // Opcional para compatibilidad con mensajes existentes
}

export interface Conversation {
  conversationId: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  lastMessageAt: string;
}

/**
 * Servicio centralizado para manejo de chat (HTTP + WebSocket)
 */
class ChatService {
  /**
   * Inicializa el chat para un usuario con sincronización en segundo plano
   */
  async initializeChat(userId: string) {
    try {
      // Conectar WebSocket
      await socketService.connect(userId);
      
      // Inicializar sincronización en segundo plano
      await backgroundSyncService.initialize(userId);
      
      console.log('✅ Chat inicializado para usuario:', userId);
    } catch (error) {
      console.error('❌ Error inicializando chat:', error);
      throw error;
    }
  }

  /**
   * Finaliza el chat y desconecta WebSocket
   */
  disconnectChat() {
    socketService.disconnect();
    backgroundSyncService.stop();
    console.log('🔌 Chat desconectado');
  }

  /**
   * Obtiene o crea una conversación con otro usuario
   */
  async getOrCreateConversation(otherUserId: string) {
    try {
      const response = await ApiService.getOrCreateConversationWith(otherUserId);
      const conversation = response.data;
      
      // Añadir conversación al servicio de sincronización en segundo plano
      if (conversation?.conversationId) {
        backgroundSyncService.addConversation(
          conversation.conversationId, 
          conversation.participants || []
        );
        
        // Actualizar estado de la conversación
        await conversationStateService.updateConversationState(
          conversation.conversationId,
          {
            participants: conversation.participants || [],
            isInitialized: false,
            isActive: false
          }
        );
      }
      
      return conversation;
    } catch (error) {
      console.error('Error obteniendo conversación:', error);
      throw error;
    }
  }

  /**
   * Lista mensajes de una conversación con caché optimizado
   */
  async getMessages(conversationId: string, options: { limit?: number; nextKey?: any } = {}) {
    try {
      // 1. Verificar si la conversación ya está inicializada para evitar reinicializaciones
      const isInitialized = await conversationStateService.isConversationInitialized(conversationId);
      const isAlreadyLoaded = await cacheService.isConversationLoaded(conversationId);
      
      if (isInitialized && isAlreadyLoaded) {
        console.log(`✅ Conversación ${conversationId} ya está inicializada y cargada, devolviendo desde caché`);
        const cachedMessages = await cacheService.getCachedMessages(conversationId);
        return { items: cachedMessages, fromCache: true, alreadyInitialized: true };
      }
      
      // 2. Cargar desde caché primero
      const cachedMessages = await cacheService.getCachedMessages(conversationId);
      
      // 3. Verificar si necesitamos sincronizar
      const needsSync = await cacheService.needsSync(conversationId);
      
      if (needsSync) {
        // 4. Actualizar estado de sincronización
        await cacheService.updateSyncStatus(conversationId, 'syncing');
        
        try {
          // 5. Sincronizar con el servidor
          const response = await ApiService.listMessages(conversationId, options);
          const serverMessages = response.data?.items || [];
          
          // 6. Actualizar caché
          await cacheService.updateCachedMessages(conversationId, serverMessages);
          
          // 7. Marcar como cargada e inicializada
          await cacheService.markConversationAsLoaded(conversationId);
          await conversationStateService.markConversationAsInitialized(
            conversationId, 
            response.data?.participants || []
          );
          
          return { items: serverMessages, ...response.data, fromCache: false };
        } catch (syncError) {
          // 8. En caso de error de sincronización, marcar como cargada para evitar reintentos
          await cacheService.updateSyncStatus(conversationId, 'error');
          await cacheService.markConversationAsLoaded(conversationId);
          throw syncError;
        }
      } else {
        // 9. Devolver mensajes del caché y marcar como cargada e inicializada
        await cacheService.markConversationAsLoaded(conversationId);
        if (!isInitialized) {
          await conversationStateService.markConversationAsInitialized(conversationId, []);
        }
        return { items: cachedMessages, fromCache: true };
      }
    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
      
      // En caso de error, intentar devolver mensajes del caché
      try {
        const cachedMessages = await cacheService.getCachedMessages(conversationId);
        return { items: cachedMessages, fromCache: true, error: true };
      } catch (cacheError) {
        console.error('Error obteniendo mensajes del caché:', cacheError);
        throw error;
      }
    }
  }

  /**
   * Lista conversaciones del usuario
   */
  async getConversations(options: { limit?: number; nextKey?: any } = {}) {
    try {
      const response = await ApiService.listConversations(options);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo conversaciones:', error);
      throw error;
    }
  }

  /**
   * Envía un mensaje
   */
  async sendMessage(conversationId: string, content: string, receiverId: string, type: 'text' | 'image' = 'text') {
    try {
      const response = await ApiService.sendMessage(conversationId, {
        content,
        receiverId,
        type
      });
      return response.data;
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      throw error;
    }
  }

  /**
   * Se une a una conversación para recibir mensajes en tiempo real
   */
  joinConversation(conversationId: string) {
    socketService.joinConversation(conversationId);
  }

  /**
   * Sale de una conversación
   */
  leaveConversation(conversationId: string) {
    socketService.leaveConversation(conversationId);
  }

  /**
   * Añade listener para nuevos mensajes con manejo automático de caché
   */
  onNewMessage(callback: (message: ChatMessage) => void) {
    const enhancedCallback = async (message: ChatMessage) => {
      try {
        // Actualizar caché automáticamente cuando llega un nuevo mensaje
        if (message.conversationId) {
          await cacheService.addMessageToCache(message.conversationId, message);
          console.log(`✅ Mensaje añadido automáticamente al caché: ${message.messageId}`);
        } else {
          console.warn('⚠️ Mensaje sin conversationId, no se puede actualizar caché');
        }
        
        // Llamar al callback original
        callback(message);
      } catch (error) {
        console.error('Error actualizando caché con nuevo mensaje:', error);
        // Aún así llamar al callback para que la UI se actualice
        callback(message);
      }
    };
    
    socketService.addMessageListener(enhancedCallback);
  }

  /**
   * Remueve listener de mensajes
   */
  offNewMessage(callback: (message: ChatMessage) => void) {
    socketService.removeMessageListener(callback);
  }

  /**
   * Añade listener para actualizaciones de conversaciones
   */
  onConversationUpdate(callback: (data: { conversationId: string; lastMessage: ChatMessage; updatedAt: string }) => void) {
    socketService.addConversationListener(callback);
  }

  /**
   * Remueve listener de conversaciones
   */
  offConversationUpdate(callback: (data: { conversationId: string; lastMessage: ChatMessage; updatedAt: string }) => void) {
    socketService.removeConversationListener(callback);
  }

  /**
   * Obtiene estado de conexión
   */
  getConnectionStatus() {
    return socketService.getConnectionStatus();
  }

  /**
   * Asegura que la conexión esté activa
   */
  async ensureConnection() {
    return socketService.ensureConnection();
  }

  /**
   * Obtiene mensajes desde caché únicamente (para carga rápida)
   */
  async getCachedMessages(conversationId: string) {
    return cacheService.getCachedMessages(conversationId);
  }

  /**
   * Obtiene mensajes desde caché con información de estado
   */
  async getCachedMessagesWithState(conversationId: string) {
    return cacheService.getCachedMessagesWithState(conversationId);
  }

  /**
   * Verifica si una conversación necesita sincronización
   */
  async needsSync(conversationId: string, serverLastMessageId?: string) {
    return cacheService.needsSync(conversationId, serverLastMessageId);
  }

  /**
   * Limpia el caché de una conversación
   */
  async clearConversationCache(conversationId: string) {
    return cacheService.clearConversationCache(conversationId);
  }

  /**
   * Limpia todo el caché
   */
  async clearAllCache() {
    return cacheService.clearAllCache();
  }

  /**
   * Obtiene información del caché para debugging
   */
  async getCacheInfo() {
    return cacheService.getCacheInfo();
  }

  /**
   * Verifica si una conversación ya está cargada
   */
  async isConversationLoaded(conversationId: string) {
    return cacheService.isConversationLoaded(conversationId);
  }

  /**
   * Marca una conversación como cargada
   */
  async markConversationAsLoaded(conversationId: string) {
    return cacheService.markConversationAsLoaded(conversationId);
  }

  /**
   * Obtiene la versión actual del caché de una conversación
   */
  async getCacheVersion(conversationId: string) {
    return cacheService.getCacheVersion(conversationId);
  }

  /**
   * Actualiza el estado de sincronización de una conversación
   */
  async updateSyncStatus(conversationId: string, status: 'idle' | 'syncing' | 'error' | 'success') {
    return cacheService.updateSyncStatus(conversationId, status);
  }

  /**
   * Marca una conversación como activa para sincronización prioritaria
   */
  markConversationActive(conversationId: string, isActive: boolean) {
    backgroundSyncService.setConversationActive(conversationId, isActive);
    conversationStateService.setConversationActive(conversationId, isActive);
  }

  /**
   * Añade una conversación al servicio de sincronización en segundo plano
   */
  addConversationToSync(conversationId: string, participants: string[]) {
    backgroundSyncService.addConversation(conversationId, participants);
  }

  /**
   * Remueve una conversación del servicio de sincronización
   */
  removeConversationFromSync(conversationId: string) {
    backgroundSyncService.removeConversation(conversationId);
  }

  /**
   * Obtiene el estado de sincronización de todas las conversaciones
   */
  getBackgroundSyncStatus() {
    return backgroundSyncService.getSyncStatus();
  }

  /**
   * Obtiene estadísticas del servicio de sincronización en segundo plano
   */
  getBackgroundSyncStats() {
    return backgroundSyncService.getStats();
  }

  /**
   * Configura los parámetros de sincronización en segundo plano
   */
  configureBackgroundSync(config: { syncInterval?: number; maxConcurrentSyncs?: number; retryAttempts?: number; retryDelay?: number }) {
    backgroundSyncService.configure(config);
  }

  /**
   * Verifica si una conversación ya está inicializada
   */
  async isConversationInitialized(conversationId: string) {
    return conversationStateService.isConversationInitialized(conversationId);
  }

  /**
   * Obtiene todas las conversaciones activas
   */
  async getActiveConversations() {
    return conversationStateService.getActiveConversations();
  }

  /**
   * Obtiene todas las conversaciones inicializadas
   */
  async getInitializedConversations() {
    return conversationStateService.getInitializedConversations();
  }

  /**
   * Obtiene información de todos los estados de conversaciones
   */
  async getConversationStatesInfo() {
    return conversationStateService.getStatesInfo();
  }

  /**
   * Limpia el estado de una conversación
   */
  async clearConversationState(conversationId: string) {
    return conversationStateService.clearConversationState(conversationId);
  }

  /**
   * Limpia todos los estados de conversaciones
   */
  async clearAllConversationStates() {
    return conversationStateService.clearAllStates();
  }
}

// Singleton
export const chatService = new ChatService();
export default chatService;

