import ApiService from './apiService';
import { socketService } from './socketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image';
  createdAt: string;
  conversationId?: string;
  read?: boolean;
  entityType?: string;
  isOptimistic?: boolean;
}

export interface Conversation {
  conversationId: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  lastMessageAt: string;
}

interface CachedConversation {
  conversationId: string;
  messages: ChatMessage[];
  lastUpdated: string;
  lastMessageId?: string;
  isLoaded: boolean;
  version: number;
}

/**
 * Servicio de chat optimizado que unifica todas las funcionalidades
 * Elimina redundancias y mejora el rendimiento
 */
class OptimizedChatService {
  private conversations: Map<string, CachedConversation> = new Map();
  private listeners: Set<(message: ChatMessage) => void> = new Set();
  private conversationListeners: Set<(data: any) => void> = new Set();
  private currentUserId: string | null = null;
  private syncInProgress: Set<string> = new Set();
  
  // Configuración optimizada mejorada
  private readonly MAX_CACHED_MESSAGES = 50;
  private readonly MAX_CONVERSATIONS_CACHED = 10; // Nuevo límite
  private readonly CACHE_KEY = 'optimized_chat_cache';
  private readonly SYNC_DEBOUNCE_MS = 500;
  private readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos
  private readonly TEMP_MESSAGE_AGE_LIMIT = 30000; // 30 segundos
  
  private syncTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Verifica si el servicio está inicializado
   */
  isInitialized(): boolean {
    return this.currentUserId !== null;
  }

  /**
   * Inicializa el servicio de chat
   */
  async initialize(userId: string): Promise<void> {
    if (this.currentUserId === userId) {
      return; // Ya inicializado para este usuario
    }

    this.currentUserId = userId;
    
    try {
      // Asegurarse de que el socketService tenga el token de autenticación
      const currentToken = ApiService.getAuthToken();
      if (currentToken) {
        socketService.setAuthToken(currentToken);
        console.log('🔑 OptimizedChat: Token de autenticación configurado en socketService');
      } else {
        console.warn('⚠️ OptimizedChat: No hay token disponible durante la inicialización');
      }
      
      // Cargar caché desde AsyncStorage
      await this.loadCacheFromStorage();
      
      // Configurar listeners de WebSocket
      this.setupSocketListeners();
      
      // Iniciar limpieza automática del caché
      this.startCacheCleanup();
      
      console.log('✅ OptimizedChat: Inicializado para usuario:', userId);
    } catch (error) {
      console.error('❌ OptimizedChat: Error inicializando:', error);
      throw error;
    }
  }

  /**
   * Desconecta y limpia el servicio
   */
  disconnect(): void {
    // Detener limpieza automática
    this.stopCacheCleanup();
    
    this.conversations.clear();
    this.listeners.clear();
    this.conversationListeners.clear();
    this.syncInProgress.clear();
    this.syncTimeouts.forEach(timeout => clearTimeout(timeout));
    this.syncTimeouts.clear();
    this.currentUserId = null;
    
    console.log('🔌 OptimizedChat: Desconectado');
  }

  /**
   * Obtiene mensajes solo del caché local (sincrónico, para renderizado inmediato)
   */
  getCachedMessages(conversationId: string): ChatMessage[] {
    const cachedConv = this.conversations.get(conversationId);
    return cachedConv ? [...cachedConv.messages] : [];
  }

  /**
   * Obtiene mensajes de una conversación con caché inteligente
   */
  async getMessages(conversationId: string, options: { limit?: number; before?: string } = {}): Promise<{
    items: ChatMessage[];
    fromCache: boolean;
  }> {
    try {
      const cachedConv = this.conversations.get(conversationId);
      
      // Si es una solicitud de paginación (before), llamar al servidor directamente
      if (options.before) {
        console.log('📄 OptimizedChat: Cargando mensajes anteriores desde servidor:', options.before);
        
        // Verificar si options.before es un objeto de DynamoDB válido o un messageId
        let nextKeyParam = undefined;
        if (typeof options.before === 'string') {
          // Si es un string que parece un UUID (messageId), no enviar nextKey
          // El backend manejará la paginación sin nextKey
          if (options.before.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            console.log('📄 OptimizedChat: before es un messageId, no enviando nextKey');
            nextKeyParam = undefined;
          } else {
            // Si es un string JSON válido, intentar parsearlo
            try {
              nextKeyParam = JSON.parse(options.before);
            } catch {
              nextKeyParam = undefined;
            }
          }
        } else if (typeof options.before === 'object') {
          nextKeyParam = options.before;
        }
        
        const response = await ApiService.listMessages(conversationId, {
          limit: options.limit || 20,
          ...(nextKeyParam && { nextKey: nextKeyParam })
        });
        
        if (response.success && response.data) {
          // Actualizar caché con los mensajes antiguos
          if (cachedConv) {
            const existingIds = new Set(cachedConv.messages.map(m => m.messageId));
            const newMessages = response.data.items.filter((msg: ChatMessage) => 
              !existingIds.has(msg.messageId)
            );
            
            if (newMessages.length > 0) {
              cachedConv.messages.push(...newMessages);
              // Mantener orden cronológico en caché
              cachedConv.messages.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              // Limitar caché para no usar demasiada memoria
              if (cachedConv.messages.length > this.MAX_CACHED_MESSAGES * 2) {
                cachedConv.messages = cachedConv.messages.slice(-this.MAX_CACHED_MESSAGES);
              }
            }
          }
          
          return {
            items: response.data.items || [],
            fromCache: false
          };
        }
        
        return { items: [], fromCache: false };
      }
      
      // Verificar si necesita sincronización (carga inicial)
      const needsSync = !cachedConv || 
        !cachedConv.isLoaded || 
        this.shouldSyncConversation(cachedConv);

      if (needsSync && !this.syncInProgress.has(conversationId)) {
        // Sincronizar en segundo plano con debouncing
        this.debouncedSyncConversation(conversationId, options.limit || 30);
      }

      // Devolver mensajes del caché inmediatamente
      if (cachedConv) {
        return {
          items: [...cachedConv.messages], // Copia para evitar mutaciones
          fromCache: true
        };
      }

      // Si no hay caché, esperar a la sincronización
      await this.waitForSync(conversationId);
      const updatedConv = this.conversations.get(conversationId);
      
      return {
        items: updatedConv?.messages || [],
        fromCache: false
      };
    } catch (error) {
      console.error('❌ OptimizedChat: Error obteniendo mensajes:', error);
      return { items: [], fromCache: false };
    }
  }

  /**
   * Lista conversaciones del usuario
   */
  async getConversations(options: { limit?: number } = {}): Promise<any> {
    try {
      const response = await ApiService.listConversations(options);
      if (!response.success) {
        throw new Error(response.error || 'Error obteniendo conversaciones');
      }
      return response.data;
    } catch (error) {
      console.error('❌ OptimizedChat: Error obteniendo conversaciones:', error);
      throw error;
    }
  }

  /**
   * Obtiene o crea una conversación
   */
  async getOrCreateConversation(otherUserId: string): Promise<any> {
    try {
      const response = await ApiService.getOrCreateConversationWith(otherUserId);
      return response.data;
    } catch (error) {
      console.error('❌ OptimizedChat: Error obteniendo conversación:', error);
      throw error;
    }
  }

  /**
   * Envía un mensaje
   */
  async sendMessage(conversationId: string, data: {
    content: string;
    receiverId: string;
    type?: 'text' | 'image';
  }): Promise<any> {
    try {
      // Añadir mensaje optimista al caché inmediatamente
      const optimisticMessage: ChatMessage = {
        messageId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: this.currentUserId!,
        receiverId: data.receiverId,
        content: data.content,
        type: data.type || 'text',
        createdAt: new Date().toISOString(),
        conversationId,
        isOptimistic: true
      };

      this.addMessageToCache(conversationId, optimisticMessage);

      // Enviar al servidor
      const response = await ApiService.sendMessage(conversationId, data);
      
      // Remover mensaje optimista y añadir el real cuando llegue por WebSocket
      return response.data;
    } catch (error) {
      console.error('❌ OptimizedChat: Error enviando mensaje:', error);
      // Remover mensaje optimista en caso de error
      this.removeOptimisticMessage(conversationId, data.content);
      throw error;
    }
  }

  /**
   * Se une a una conversación para recibir mensajes en tiempo real
   */
  joinConversation(conversationId: string): void {
    socketService.joinConversation(conversationId);
  }

  /**
   * Se une a una conversación esperando a que el WebSocket esté conectado
   */
  async joinConversationWhenReady(conversationId: string, maxWaitTime?: number): Promise<boolean> {
    return await socketService.joinConversationWhenReady(conversationId, maxWaitTime);
  }

  /**
   * Sale de una conversación
   */
  leaveConversation(conversationId: string): void {
    socketService.leaveConversation(conversationId);
  }

  /**
   * Añade listener para nuevos mensajes
   */
  onNewMessage(callback: (message: ChatMessage) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remueve listener de mensajes
   */
  offNewMessage(callback: (message: ChatMessage) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Añade listener para actualizaciones de conversaciones
   */
  onConversationUpdate(callback: (data: any) => void): void {
    this.conversationListeners.add(callback);
  }

  /**
   * Remueve listener de conversaciones
   */
  offConversationUpdate(callback: (data: any) => void): void {
    this.conversationListeners.delete(callback);
  }

  /**
   * Obtiene estado de conexión
   */
  getConnectionStatus() {
    return socketService.getConnectionStatus();
  }

  /**
   * Limpia el caché de una conversación
   */
  async clearConversationCache(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
    await this.saveCacheToStorage();
  }

  /**
   * Limpia todo el caché
   */
  async clearAllCache(): Promise<void> {
    console.log('🧹 OptimizedChat: Limpiando todo el caché');
    this.conversations.clear();
    await AsyncStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * Obtiene estadísticas del caché para debugging
   */
  getCacheStats() {
    const stats = {
      totalConversations: this.conversations.size,
      maxConversations: this.MAX_CONVERSATIONS_CACHED,
      totalMessages: 0,
      optimisticMessages: 0,
      oldestConversation: null as string | null,
      newestConversation: null as string | null,
      memoryUsageEstimate: 0
    };

    let oldestTime = Date.now();
    let newestTime = 0;

    this.conversations.forEach((conv, id) => {
      stats.totalMessages += conv.messages.length;
      stats.optimisticMessages += conv.messages.filter(m => m.isOptimistic).length;
      
      const convTime = new Date(conv.lastUpdated).getTime();
      if (convTime < oldestTime) {
        oldestTime = convTime;
        stats.oldestConversation = id;
      }
      if (convTime > newestTime) {
        newestTime = convTime;
        stats.newestConversation = id;
      }
      
      // Estimación aproximada de uso de memoria (en KB)
      stats.memoryUsageEstimate += JSON.stringify(conv).length / 1024;
    });

    return stats;
  }

  /**
   * Sincronización incremental optimizada con manejo de memoria
   */
  async syncConversationIncremental(conversationId: string): Promise<{
    newMessagesCount: number;
    updatedMessages: ChatMessage[];
  }> {
    try {
      if (this.syncInProgress.has(conversationId)) {
        return { newMessagesCount: 0, updatedMessages: [] };
      }

      this.syncInProgress.add(conversationId);

      // Obtener mensajes del servidor
      const response = await ApiService.listMessages(conversationId, { limit: 30 });
      const serverMessages = response.data?.items || [];
      
      const cachedConv = this.conversations.get(conversationId);
      
      // Limpiar mensajes optimistas expirados antes de sincronizar
      if (cachedConv) {
        this.cleanupExpiredOptimisticMessagesForConversation(conversationId);
      }
      
      const cachedMessageIds = new Set(
        cachedConv?.messages.filter(m => !m.isOptimistic).map(m => m.messageId) || []
      );

      // Filtrar solo mensajes nuevos (excluir optimistas)
      const newMessages = serverMessages.filter(
        (msg: ChatMessage) => !cachedMessageIds.has(msg.messageId)
      );

      if (newMessages.length > 0) {
        // Combinar mensajes existentes no optimistas con nuevos
        const existingRealMessages = cachedConv?.messages.filter(m => !m.isOptimistic) || [];
        const existingOptimisticMessages = cachedConv?.messages.filter(m => m.isOptimistic) || [];
        
        const allMessages = [...existingRealMessages, ...newMessages, ...existingOptimisticMessages]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(-this.MAX_CACHED_MESSAGES);

        this.updateConversationCache(conversationId, allMessages);
        this.debounceSaveToStorage();

        console.log(`🔄 OptimizedChat: Sincronizados ${newMessages.length} mensajes nuevos para conversación ${conversationId}`);

        return {
          newMessagesCount: newMessages.length,
          updatedMessages: allMessages
        };
      }

      return { newMessagesCount: 0, updatedMessages: [] };
    } catch (error) {
      console.error(`❌ OptimizedChat: Error en sincronización incremental:`, error);
      return { newMessagesCount: 0, updatedMessages: [] };
    } finally {
      this.syncInProgress.delete(conversationId);
    }
  }

  /**
   * Limpia mensajes optimistas expirados para una conversación específica
   */
  private cleanupExpiredOptimisticMessagesForConversation(conversationId: string): void {
    const cachedConv = this.conversations.get(conversationId);
    if (!cachedConv) return;
    
    const now = Date.now();
    const originalLength = cachedConv.messages.length;
    
    cachedConv.messages = cachedConv.messages.filter(m => {
      if (!m.isOptimistic) return true;
      
      const messageAge = now - new Date(m.createdAt).getTime();
      return messageAge <= this.TEMP_MESSAGE_AGE_LIMIT;
    });
    
    const cleaned = originalLength - cachedConv.messages.length;
    if (cleaned > 0) {
      console.log(`🧹 OptimizedChat: ${cleaned} mensajes optimistas expirados limpiados en conversación ${conversationId}`);
      this.conversations.set(conversationId, cachedConv);
    }
  }

  // Métodos privados

  private async loadCacheFromStorage(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        Object.entries(data).forEach(([conversationId, conv]: [string, any]) => {
          if (this.isCacheValid(conv)) {
            this.conversations.set(conversationId, conv);
          }
        });
      }
    } catch (error) {
      console.error('❌ OptimizedChat: Error cargando caché:', error);
    }
  }

  private async saveCacheToStorage(): Promise<void> {
    try {
      const data: { [key: string]: CachedConversation } = {};
      this.conversations.forEach((conv, id) => {
        data[id] = conv;
      });
      
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('❌ OptimizedChat: Error guardando caché:', error);
    }
  }

  private setupSocketListeners(): void {
    socketService.addMessageListener((message: ChatMessage) => {
      this.handleNewMessage(message);
    });

    socketService.addConversationListener((data: any) => {
      this.conversationListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('❌ OptimizedChat: Error en listener de conversación:', error);
        }
      });
    });
  }

  private handleNewMessage(message: ChatMessage): void {
    if (!message.conversationId) return;

    console.log('📨 OptimizedChat: Procesando nuevo mensaje:', {
      messageId: message.messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content?.substring(0, 50) + '...'
    });

    // Remover mensaje optimista si existe (mejorar lógica)
    this.removeOptimisticMessage(message.conversationId, message.content, message.senderId);

    // Añadir mensaje real al caché
    this.addMessageToCache(message.conversationId, message);

    // Notificar a listeners inmediatamente
    this.listeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('❌ OptimizedChat: Error en listener de mensaje:', error);
      }
    });

    console.log('✅ OptimizedChat: Mensaje procesado y notificado a', this.listeners.size, 'listeners');
  }

  private addMessageToCache(conversationId: string, message: ChatMessage): void {
    const cachedConv = this.conversations.get(conversationId) || {
      conversationId,
      messages: [],
      lastUpdated: new Date().toISOString(),
      isLoaded: true,
      version: 1
    };

    // Verificar duplicados
    const exists = cachedConv.messages.some(m => m.messageId === message.messageId);
    if (!exists) {
      cachedConv.messages.push(message);
      cachedConv.messages = cachedConv.messages
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-this.MAX_CACHED_MESSAGES);
      
      cachedConv.lastUpdated = new Date().toISOString();
      cachedConv.lastMessageId = message.messageId;
      cachedConv.version++;

      this.conversations.set(conversationId, cachedConv);
      
      console.log(`💾 OptimizedChat: Mensaje añadido al caché - conversación ${conversationId}, total mensajes: ${cachedConv.messages.length}`);
      
      // Guardar en storage de forma asíncrona
      this.debounceSaveToStorage();
    } else {
      console.log(`⚠️ OptimizedChat: Mensaje duplicado ignorado - ${message.messageId}`);
    }
  }

  private removeOptimisticMessage(conversationId: string, content: string, senderId?: string): void {
    const cachedConv = this.conversations.get(conversationId);
    if (cachedConv) {
      const originalLength = cachedConv.messages.length;
      const now = Date.now();
      
      // Mejorar lógica de eliminación con timestamp
      cachedConv.messages = cachedConv.messages.filter(m => {
        if (!m.isOptimistic) return true;
        
        // Remover mensajes temporales antiguos automáticamente
        const messageAge = now - new Date(m.createdAt).getTime();
        if (messageAge > this.TEMP_MESSAGE_AGE_LIMIT) {
          console.log(`🗑️ OptimizedChat: Removiendo mensaje optimista expirado: ${m.messageId}`);
          return false;
        }
        
        // Lógica de coincidencia mejorada
        if (senderId && m.senderId === senderId && m.content === content) {
          console.log(`🔄 OptimizedChat: Removiendo mensaje optimista específico: ${m.messageId}`);
          return false;
        }
        
        // Fallback a comparación por contenido solo
        if (!senderId && m.content === content) {
          return false;
        }
        
        return true;
      });
      
      const removedCount = originalLength - cachedConv.messages.length;
      if (removedCount > 0) {
        console.log(`🗑️ OptimizedChat: Removidos ${removedCount} mensajes optimistas de conversación ${conversationId}`);
        this.conversations.set(conversationId, cachedConv);
      }
    }
  }

  private updateConversationCache(conversationId: string, messages: ChatMessage[]): void {
    const cachedConv = this.conversations.get(conversationId) || {
      conversationId,
      messages: [],
      lastUpdated: new Date().toISOString(),
      isLoaded: true,
      version: 1
    };

    cachedConv.messages = messages;
    cachedConv.lastUpdated = new Date().toISOString();
    cachedConv.lastMessageId = messages[messages.length - 1]?.messageId;
    cachedConv.isLoaded = true;
    cachedConv.version++;

    this.conversations.set(conversationId, cachedConv);
  }

  private shouldSyncConversation(conv: CachedConversation): boolean {
    const now = Date.now();
    const lastUpdate = new Date(conv.lastUpdated).getTime();
    const timeSinceUpdate = now - lastUpdate;
    
    // Sincronizar si han pasado más de 5 minutos o si hay mensajes optimistas antiguos
    const hasOldOptimisticMessages = conv.messages.some(m => 
      m.isOptimistic && (now - new Date(m.createdAt).getTime()) > this.TEMP_MESSAGE_AGE_LIMIT
    );
    
    return timeSinceUpdate > 5 * 60 * 1000 || hasOldOptimisticMessages;
  }

  private isCacheValid(conv: CachedConversation): boolean {
    const now = Date.now();
    const lastUpdate = new Date(conv.lastUpdated).getTime();
    const timeSinceUpdate = now - lastUpdate;
    
    // Caché válido por 24 horas
    return timeSinceUpdate < 24 * 60 * 60 * 1000;
  }

  private async syncConversationAsync(conversationId: string, limit: number): Promise<void> {
    if (this.syncInProgress.has(conversationId)) return;

    try {
      this.syncInProgress.add(conversationId);
      
      const response = await ApiService.listMessages(conversationId, { limit });
      const serverMessages = response.data?.items || [];
      
      if (serverMessages.length > 0) {
        this.updateConversationCache(conversationId, serverMessages);
        await this.saveCacheToStorage();
      }
    } catch (error) {
      console.error(`❌ OptimizedChat: Error en sincronización async:`, error);
    } finally {
      this.syncInProgress.delete(conversationId);
    }
  }

  private async waitForSync(conversationId: string): Promise<void> {
    let attempts = 0;
    const maxAttempts = 20; // 2 segundos máximo

    while (this.syncInProgress.has(conversationId) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
  }

  /**
   * Inicia la limpieza automática del caché
   */
  private startCacheCleanup(): void {
    this.stopCacheCleanup();
    
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupOldConversations();
      this.cleanupExpiredOptimisticMessages();
    }, this.CACHE_CLEANUP_INTERVAL);
    
    console.log('🧹 OptimizedChat: Limpieza automática de caché iniciada');
  }

  /**
   * Detiene la limpieza automática del caché
   */
  private stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
      console.log('🛑 OptimizedChat: Limpieza automática de caché detenida');
    }
  }

  /**
   * Limpia conversaciones antiguas para gestión de memoria
   */
  private cleanupOldConversations(): void {
    if (this.conversations.size > this.MAX_CONVERSATIONS_CACHED) {
      console.log(`🧹 OptimizedChat: Limpiando conversaciones antiguas (${this.conversations.size}/${this.MAX_CONVERSATIONS_CACHED})`);
      
      // Ordenar por última actualización y remover las más antiguas
      const sortedConversations = Array.from(this.conversations.entries())
        .sort((a, b) => new Date(a[1].lastUpdated).getTime() - new Date(b[1].lastUpdated).getTime());
      
      const toRemove = sortedConversations.slice(0, this.conversations.size - this.MAX_CONVERSATIONS_CACHED);
      toRemove.forEach(([id]) => {
        this.conversations.delete(id);
        console.log(`🗑️ OptimizedChat: Conversación ${id} removida del caché`);
      });
      
      // Guardar cambios
      this.debounceSaveToStorage();
    }
  }

  /**
   * Limpia mensajes optimistas expirados
   */
  private cleanupExpiredOptimisticMessages(): void {
    const now = Date.now();
    let totalCleaned = 0;
    
    this.conversations.forEach((conv, conversationId) => {
      const originalLength = conv.messages.length;
      
      conv.messages = conv.messages.filter(m => {
        if (!m.isOptimistic) return true;
        
        const messageAge = now - new Date(m.createdAt).getTime();
        if (messageAge > this.TEMP_MESSAGE_AGE_LIMIT) {
          console.log(`🕐 OptimizedChat: Mensaje optimista expirado removido: ${m.messageId}`);
          return false;
        }
        
        return true;
      });
      
      const cleaned = originalLength - conv.messages.length;
      if (cleaned > 0) {
        totalCleaned += cleaned;
        this.conversations.set(conversationId, conv);
      }
    });
    
    if (totalCleaned > 0) {
      console.log(`🧹 OptimizedChat: ${totalCleaned} mensajes optimistas expirados limpiados`);
      this.debounceSaveToStorage();
    }
  }

  private debounceSaveToStorage(): void {
    // Debounce para evitar múltiples escrituras
    if (this.syncTimeouts.has('save')) {
      clearTimeout(this.syncTimeouts.get('save')!);
    }

    this.syncTimeouts.set('save', setTimeout(async () => {
      await this.saveCacheToStorage();
      this.syncTimeouts.delete('save');
    }, this.SYNC_DEBOUNCE_MS));
  }

  private debouncedSyncConversation(conversationId: string, limit: number): void {
    // Debounce para evitar múltiples sincronizaciones
    const timeoutKey = `sync_${conversationId}`;
    if (this.syncTimeouts.has(timeoutKey)) {
      clearTimeout(this.syncTimeouts.get(timeoutKey)!);
    }

    this.syncTimeouts.set(timeoutKey, setTimeout(async () => {
      await this.syncConversationAsync(conversationId, limit);
      this.syncTimeouts.delete(timeoutKey);
    }, this.SYNC_DEBOUNCE_MS));
  }
}

// Singleton
export const optimizedChatService = new OptimizedChatService();
export default optimizedChatService;
