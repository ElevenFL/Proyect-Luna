import ApiService from './apiService';
import { socketService } from './socketService';
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
   * Nota: La conexión WebSocket se maneja automáticamente por useWebSocketManager
   */
  async initializeChat(userId: string) {
    try {
      // Inicializar sincronización en segundo plano
      await backgroundSyncService.initialize(userId);
      
      console.log('✅ Chat inicializado para usuario:', userId);
    } catch (error) {
      console.error('❌ Error inicializando chat:', error);
      throw error;
    }
  }

  /**
   * Finaliza el chat
   * Nota: El WebSocket se maneja automáticamente por useWebSocketManager
   */
  disconnectChat() {
    backgroundSyncService.stop();
    console.log('🔌 Chat desconectado');
  }

  /**
   * Obtiene o crea una conversación con otro usuario
   */
  async getOrCreateConversation(otherUserId: string) {
    try {
      // Verificar si ya tenemos esta conversación en caché
      const existingConversations = await this.getConversations();
      const existingConv = existingConversations?.items?.find((conv: any) => 
        conv.participants?.includes(otherUserId)
      );
      
      if (existingConv) {
        return existingConv;
      }
      
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
      // Solo loggear en desarrollo o si hay errores
      if (__DEV__) {
        console.log('🔄 ChatService: Obteniendo conversaciones con opciones:', options);
      }
      
      const response = await ApiService.listConversations(options);
      
      if (!response.success) {
        console.error('❌ ChatService: Error en la respuesta del backend:', response.error);
        throw new Error(response.error || 'Error obteniendo conversaciones');
      }
      
      // Solo loggear respuesta detallada en desarrollo
      if (__DEV__) {
        console.log('📡 ChatService: Respuesta de ApiService:', {
          success: response.success,
          data: response.data,
          message: response.message,
          error: response.error
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ ChatService: Error obteniendo conversaciones:', error);
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

  /**
   * Registra el acceso a una conversación para mejorar la precarga
   */
  async recordConversationAccess(conversationId: string) {
    return cacheService.recordConversationAccess(conversationId);
  }

  /**
   * Obtiene conversaciones ordenadas por prioridad para precarga
   */
  async getConversationsByPriority() {
    return cacheService.getConversationsByPriority();
  }

  /**
   * Obtiene conversaciones de alta prioridad para precarga inmediata
   */
  async getHighPriorityConversations() {
    return cacheService.getHighPriorityConversations();
  }

  /**
   * Precarga conversaciones basada en prioridad de uso
   */
  async preloadHighPriorityConversations() {
    try {
      const highPriorityConversations = await this.getHighPriorityConversations();
      
      if (highPriorityConversations.length === 0) {
        return;
      }
      
      // Limitar a máximo 3 conversaciones para evitar sobrecarga
      const limitedConversations = highPriorityConversations.slice(0, 3);
      
      // Solo loggear en desarrollo
      if (__DEV__) {
        console.log('🚀 Precargando', limitedConversations.length, 'conversaciones recientes');
      }
      
      // Precargar mensajes de conversaciones de alta prioridad
      const preloadPromises = limitedConversations.map(async (conversationId) => {
        try {
          const isLoaded = await this.isConversationLoaded(conversationId);
          if (!isLoaded) {
            // Usar caché primero, luego sincronizar si es necesario
            const cachedMessages = await this.getCachedMessages(conversationId);
            if (cachedMessages.length === 0) {
              await this.getMessages(conversationId, { limit: 15 }); // Reducido de 20 a 15
            }
          }
        } catch (error) {
          console.error(`❌ Error precargando conversación de alta prioridad ${conversationId}:`, error);
        }
      });
      
      await Promise.allSettled(preloadPromises);
      
    } catch (error) {
      console.error('❌ Error en precarga de conversaciones de alta prioridad:', error);
    }
  }

  /**
   * Sincroniza incrementalmente una conversación (solo mensajes nuevos)
   */
  async syncConversationIncremental(conversationId: string): Promise<{
    newMessagesCount: number;
    updatedMessages: ChatMessage[];
  }> {
    try {
      // Verificar si necesita sincronización
      const needsSync = await this.needsSync(conversationId);
      
      if (!needsSync) {
        return { newMessagesCount: 0, updatedMessages: [] };
      }

      // Obtener mensajes del servidor
      const serverResult = await ApiService.listMessages(conversationId, { limit: 50 });
      const serverMessages = serverResult.data?.items || [];
      
      // Sincronizar incrementalmente usando el servicio de caché
      const syncResult = await cacheService.syncConversationIncremental(conversationId, serverMessages);
      
      // Marcar como cargada si hay mensajes nuevos
      if (syncResult.newMessagesCount > 0) {
        await this.markConversationAsLoaded(conversationId);
      }
      
      return syncResult;
    } catch (error) {
      console.error(`❌ Error sincronizando incrementalmente conversación ${conversationId}:`, error);
      return { newMessagesCount: 0, updatedMessages: [] };
    }
  }

  /**
   * Precarga los call renders de los mensajes para mejorar el rendimiento
   * Esto pre-renderiza los componentes de mensajes antes de que el usuario entre al chat
   */
  async preloadMessageRenders(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      if (!messages || messages.length === 0) {
        return;
      }

      console.log(`🎨 Iniciando precarga de renders para ${messages.length} mensajes de conversación ${conversationId}`);

      // Crear un caché de renders para esta conversación
      const renderCache = new Map<string, any>();
      
      console.log(`📋 Mensajes a procesar:`, messages.map(m => ({ id: m.messageId, content: m.content?.substring(0, 30) + '...' })));
      
      // Procesar mensajes en lotes para evitar sobrecarga
      const batchSize = 5;
      const batches = [];
      
      for (let i = 0; i < messages.length; i += batchSize) {
        batches.push(messages.slice(i, i + batchSize));
      }

      // Procesar cada lote de mensajes
      for (const batch of batches) {
        const batchPromises = batch.map(async (message) => {
          try {
            console.log(`🔄 Procesando render para mensaje ${message.messageId}...`);
            
            // Crear un objeto de render pre-calculado
            const renderData = {
              messageId: message.messageId,
              content: message.content,
              type: message.type,
              senderId: message.senderId,
              receiverId: message.receiverId,
              createdAt: message.createdAt,
              conversationId: message.conversationId,
              // Pre-calcular propiedades que se usan en el render
              isReply: message.content.startsWith('↳'),
              hasContent: message.content && message.content.trim().length > 0,
              contentLength: message.content?.length || 0,
              // Pre-calcular timestamp formateado
              formattedTime: this.formatMessageTime(message.createdAt),
              // Pre-calcular si es una respuesta
              replyData: this.parseReplyMessage(message.content)
            };

            // Almacenar en caché de renders
            renderCache.set(message.messageId, renderData);
            console.log(`✅ Render calculado para mensaje ${message.messageId}:`, {
              isReply: renderData.isReply,
              hasContent: renderData.hasContent,
              formattedTime: renderData.formattedTime
            });
            
            // También almacenar en el caché del servicio de caché para persistencia
            await cacheService.cacheMessageRender(conversationId, message.messageId, renderData);
            console.log(`💾 Render almacenado en caché para mensaje ${message.messageId}`);
            
          } catch (error) {
            console.error(`❌ Error precargando render para mensaje ${message.messageId}:`, error);
          }
        });

        // Esperar a que termine el lote actual
        await Promise.allSettled(batchPromises);
        
        // Pequeña pausa entre lotes para no bloquear la UI
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Almacenar el caché de renders en memoria para acceso rápido
      await cacheService.setRenderCache(conversationId, renderCache);
      
      console.log(`✅ Precarga de renders completada para conversación ${conversationId}: ${renderCache.size} renders cacheados`);
      
    } catch (error) {
      console.error(`❌ Error en precarga de renders para conversación ${conversationId}:`, error);
    }
  }

  /**
   * Formatea el tiempo de un mensaje para mostrar en la UI
   */
  private formatMessageTime(createdAt: string): string {
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
  }

  /**
   * Parsea un mensaje de respuesta para extraer el mensaje original y la respuesta
   */
  private parseReplyMessage(content: string): { originalMessage: string; replyText: string; isReply: boolean } {
    if (!content.startsWith('↳')) {
      return { originalMessage: '', replyText: content, isReply: false };
    }
    
    const parts = content.split('\n\n');
    if (parts.length >= 2) {
      const originalMessage = parts[0].replace('↳ ', '');
      const replyText = parts.slice(1).join('\n\n');
      return { originalMessage, replyText, isReply: true };
    }
    
    return { originalMessage: '', replyText: content, isReply: false };
  }

  /**
   * Obtiene un render pre-calculado de un mensaje desde el caché
   */
  async getCachedMessageRender(conversationId: string, messageId: string): Promise<any | null> {
    try {
      return await cacheService.getCachedMessageRender(conversationId, messageId);
    } catch (error) {
      console.error(`❌ Error obteniendo render cacheados para mensaje ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene todos los renders cacheados de una conversación
   */
  async getCachedMessageRenders(conversationId: string): Promise<Map<string, any>> {
    try {
      return await cacheService.getRenderCache(conversationId);
    } catch (error) {
      console.error(`❌ Error obteniendo renders cacheados para conversación ${conversationId}:`, error);
      return new Map();
    }
  }

  /**
   * Obtiene mensajes prerenderizados de una conversación
   */
  async getPrerenderedMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      // Intentar obtener mensajes prerenderizados desde el caché
      const prerenderedMessages = await cacheService.getPrerenderedMessages(conversationId);
      
      if (prerenderedMessages && prerenderedMessages.length > 0) {
        console.log(`🎭 ChatService: Obtenidos ${prerenderedMessages.length} mensajes prerenderizados para conversación ${conversationId}`);
        return prerenderedMessages;
      }
      
      return [];
    } catch (error) {
      console.error(`❌ Error obteniendo mensajes prerenderizados para conversación ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Almacena mensajes prerenderizados para una conversación
   */
  async setPrerenderedMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      await cacheService.setPrerenderedMessages(conversationId, messages);
      console.log(`🎭 ChatService: Almacenados ${messages.length} mensajes prerenderizados para conversación ${conversationId}`);
    } catch (error) {
      console.error(`❌ Error almacenando mensajes prerenderizados para conversación ${conversationId}:`, error);
    }
  }
}

// Singleton
export const chatService = new ChatService();
export default chatService;

