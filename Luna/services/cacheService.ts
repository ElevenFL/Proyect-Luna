import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from './optimizedChatService';

interface CachedConversation {
  conversationId: string;
  messages: ChatMessage[];
  lastUpdated: string;
  lastMessageId?: string;
  hasMoreMessages: boolean;
  version: number; // Versión del caché para control de cambios
  isLoaded: boolean; // Indica si los mensajes ya fueron cargados
  lastSyncAttempt?: string; // Último intento de sincronización
  syncStatus: 'idle' | 'syncing' | 'error' | 'success'; // Estado de sincronización
  accessCount: number; // Número de veces que se ha accedido a esta conversación
  lastAccess: string; // Última vez que se accedió a esta conversación
  priority: 'high' | 'medium' | 'low'; // Prioridad de precarga basada en uso
}

interface CachedConversations {
  [conversationId: string]: CachedConversation;
}

/**
 * Servicio de caché para conversaciones y mensajes
 * Mejora la fluidez de carga del chat guardando datos localmente
 */
class CacheService {
  private readonly CACHE_KEY = 'chat_conversations_cache';
  private readonly CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días (más persistente)
  private readonly MAX_CACHED_MESSAGES = 100; // Reducido de 200 a 100 para mejor rendimiento
  private readonly CACHE_UPDATE_THROTTLE = 1000; // Throttle de 1 segundo para actualizaciones
  private updateThrottles: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_CACHE_SIZE = 50; // Máximo 50 conversaciones en caché

  /**
   * Obtiene mensajes de una conversación desde el caché
   */
  async getCachedMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      if (cached && this.isCacheValid(cached)) {
        return cached.messages;
      }
      return [];
    } catch (error) {
      console.error('Error obteniendo mensajes del caché:', error);
      return [];
    }
  }

  /**
   * Obtiene mensajes de una conversación desde el caché con información de estado
   */
  async getCachedMessagesWithState(conversationId: string): Promise<{
    messages: ChatMessage[];
    isLoaded: boolean;
    version: number;
    syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  }> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      if (cached && this.isCacheValid(cached)) {
        return {
          messages: cached.messages,
          isLoaded: cached.isLoaded,
          version: cached.version,
          syncStatus: cached.syncStatus
        };
      }
      return {
        messages: [],
        isLoaded: false,
        version: 0,
        syncStatus: 'idle'
      };
    } catch (error) {
      console.error('Error obteniendo mensajes del caché con estado:', error);
      return {
        messages: [],
        isLoaded: false,
        version: 0,
        syncStatus: 'idle'
      };
    }
  }

  /**
   * Obtiene mensajes de una conversación desde el caché de forma síncrona (más rápido)
   */
  async getCachedMessagesSync(conversationId: string): Promise<ChatMessage[]> {
    try {
      // Intentar obtener directamente desde AsyncStorage de forma más rápida
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const conversation = parsedCache[conversationId];
        if (conversation && this.isCacheValid(conversation)) {
          return conversation.messages;
        }
      }
      return [];
    } catch (error) {
      console.error('Error obteniendo mensajes del caché (sync):', error);
      return [];
    }
  }

  /**
   * Guarda mensajes en el caché
   */
  async cacheMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const cached = await this.getCachedConversations();
      
      // Limitar el número de mensajes en caché
      const limitedMessages = messages.slice(-this.MAX_CACHED_MESSAGES);
      
      // Obtener versión actual o inicializar en 1
      const currentVersion = cached[conversationId]?.version || 0;
      
      cached[conversationId] = {
        conversationId,
        messages: limitedMessages,
        lastUpdated: new Date().toISOString(),
        lastMessageId: limitedMessages[limitedMessages.length - 1]?.messageId,
        hasMoreMessages: messages.length > this.MAX_CACHED_MESSAGES,
        version: currentVersion + 1,
        isLoaded: true,
        syncStatus: 'success',
        accessCount: cached[conversationId]?.accessCount || 0,
        lastAccess: cached[conversationId]?.lastAccess || new Date().toISOString(),
        priority: this.calculatePriority(cached[conversationId]?.accessCount || 0, cached[conversationId]?.lastAccess)
      };

      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error guardando mensajes en caché:', error);
    }
  }

  /**
   * Añade un nuevo mensaje al caché
   */
  async addMessageToCache(conversationId: string, message: ChatMessage): Promise<void> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      
      if (cached && this.isCacheValid(cached)) {
        // Verificar si el mensaje ya existe para evitar duplicados
        const messageExists = cached.messages.some(m => m.messageId === message.messageId);
        if (!messageExists) {
          cached.messages.push(message);
          
          // Limitar el número de mensajes
          if (cached.messages.length > this.MAX_CACHED_MESSAGES) {
            cached.messages = cached.messages.slice(-this.MAX_CACHED_MESSAGES);
            cached.hasMoreMessages = true;
          }
          
          cached.lastUpdated = new Date().toISOString();
          cached.lastMessageId = message.messageId;
          cached.version = cached.version + 1;
          cached.isLoaded = true;
          cached.syncStatus = 'success';
          
          await this.updateCachedConversation(conversationId, cached);
        }
      } else {
        // Si no hay caché válido, crear uno nuevo con este mensaje
        await this.cacheMessages(conversationId, [message]);
      }
    } catch (error) {
      console.error('Error añadiendo mensaje al caché:', error);
    }
  }

  /**
   * Actualiza mensajes existentes en el caché (para sincronización)
   */
  async updateCachedMessages(conversationId: string, newMessages: ChatMessage[]): Promise<void> {
    try {
      // Throttle las actualizaciones para evitar escrituras excesivas
      if (this.updateThrottles.has(conversationId)) {
        clearTimeout(this.updateThrottles.get(conversationId)!);
      }
      
      this.updateThrottles.set(conversationId, setTimeout(async () => {
        await this.performCacheUpdate(conversationId, newMessages);
        this.updateThrottles.delete(conversationId);
      }, this.CACHE_UPDATE_THROTTLE) as any);
    } catch (error) {
      console.error('Error actualizando mensajes en caché:', error);
    }
  }

  private async performCacheUpdate(conversationId: string, newMessages: ChatMessage[]): Promise<void> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      
      if (cached && this.isCacheValid(cached)) {
        // Crear un mapa de mensajes existentes para evitar duplicados
        const existingMessagesMap = new Map(cached.messages.map(m => [m.messageId, m]));
        
        // Contar mensajes nuevos añadidos
        let newMessagesCount = 0;
        
        // Añadir o actualizar mensajes
        newMessages.forEach(message => {
          if (!existingMessagesMap.has(message.messageId)) {
            newMessagesCount++;
          }
          existingMessagesMap.set(message.messageId, message);
        });
        
        // Convertir de vuelta a array y ordenar por fecha
        const updatedMessages = Array.from(existingMessagesMap.values())
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        // Limitar el número de mensajes
        const limitedMessages = updatedMessages.slice(-this.MAX_CACHED_MESSAGES);
        
        cached.messages = limitedMessages;
        cached.lastUpdated = new Date().toISOString();
        cached.lastMessageId = limitedMessages[limitedMessages.length - 1]?.messageId;
        cached.hasMoreMessages = updatedMessages.length > this.MAX_CACHED_MESSAGES;
        cached.version = cached.version + 1;
        cached.isLoaded = true;
        cached.syncStatus = 'success';
        
        await this.updateCachedConversation(conversationId, cached);
      }
    } catch (error) {
      console.error('Error en actualización de caché:', error);
    }
  }

  /**
   * Verifica si hay mensajes más recientes en el servidor
   */
  async needsSync(conversationId: string, serverLastMessageId?: string): Promise<boolean> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      
      if (!cached || !this.isCacheValid(cached)) {
        return true; // Necesita sincronización si no hay caché válido
      }
      
      // Si ya está sincronizando, no iniciar otra sincronización
      if (cached.syncStatus === 'syncing') {
        return false;
      }
      
      // Si la conversación ya está marcada como cargada, no sincronizar a menos que sea muy antiguo
      if (cached.isLoaded) {
        const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
        // Solo sincronizar si el caché es muy antiguo (más de 2 horas)
        return cacheAge > 2 * 60 * 60 * 1000; // 2 horas
      }
      
      // Si el servidor tiene un mensaje más reciente que el último en caché
      if (serverLastMessageId && cached.lastMessageId) {
        return serverLastMessageId !== cached.lastMessageId;
      }
      
      // Sincronizar si el caché es muy antiguo (más de 1 hora)
      const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
      return cacheAge > 60 * 60 * 1000; // 1 hora
    } catch (error) {
      console.error('Error verificando necesidad de sincronización:', error);
      return true;
    }
  }

  /**
   * Marca una conversación como cargada para evitar recargas innecesarias
   */
  async markConversationAsLoaded(conversationId: string): Promise<void> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      if (cached && this.isCacheValid(cached)) {
        cached.isLoaded = true;
        cached.lastUpdated = new Date().toISOString();
        await this.updateCachedConversation(conversationId, cached);
      }
    } catch (error) {
      console.error('Error marcando conversación como cargada:', error);
    }
  }

  /**
   * Verifica si una conversación ya fue cargada
   */
  async isConversationLoaded(conversationId: string): Promise<boolean> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      return cached ? cached.isLoaded && this.isCacheValid(cached) : false;
    } catch (error) {
      console.error('Error verificando si conversación está cargada:', error);
      return false;
    }
  }

  /**
   * Actualiza el estado de sincronización de una conversación
   */
  async updateSyncStatus(conversationId: string, status: 'idle' | 'syncing' | 'error' | 'success'): Promise<void> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      if (cached && this.isCacheValid(cached)) {
        cached.syncStatus = status;
        cached.lastSyncAttempt = new Date().toISOString();
        await this.updateCachedConversation(conversationId, cached);
      }
    } catch (error) {
      console.error('Error actualizando estado de sincronización:', error);
    }
  }

  /**
   * Obtiene la versión actual del caché de una conversación
   */
  async getCacheVersion(conversationId: string): Promise<number> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      return cached ? cached.version : 0;
    } catch (error) {
      console.error('Error obteniendo versión del caché:', error);
      return 0;
    }
  }

  /**
   * Limpia el caché de una conversación específica
   */
  async clearConversationCache(conversationId: string): Promise<void> {
    try {
      const cached = await this.getCachedConversations();
      delete cached[conversationId];
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error limpiando caché de conversación:', error);
    }
  }

  /**
   * Limpia todo el caché
   */
  async clearAllCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      console.error('Error limpiando todo el caché:', error);
    }
  }

  /**
   * Obtiene información del caché para debugging
   */
  async getCacheInfo(): Promise<{ 
    [conversationId: string]: { 
      messageCount: number; 
      lastUpdated: string; 
      isValid: boolean;
      version: number;
      isLoaded: boolean;
      syncStatus: 'idle' | 'syncing' | 'error' | 'success';
      lastSyncAttempt?: string;
    } 
  }> {
    try {
      const cached = await this.getCachedConversations();
      const info: { 
        [conversationId: string]: { 
          messageCount: number; 
          lastUpdated: string; 
          isValid: boolean;
          version: number;
          isLoaded: boolean;
          syncStatus: 'idle' | 'syncing' | 'error' | 'success';
          lastSyncAttempt?: string;
        } 
      } = {};
      
      Object.keys(cached).forEach(conversationId => {
        const conversation = cached[conversationId];
        info[conversationId] = {
          messageCount: conversation.messages.length,
          lastUpdated: conversation.lastUpdated,
          isValid: this.isCacheValid(conversation),
          version: conversation.version,
          isLoaded: conversation.isLoaded,
          syncStatus: conversation.syncStatus,
          lastSyncAttempt: conversation.lastSyncAttempt
        };
      });
      
      return info;
    } catch (error) {
      console.error('Error obteniendo información del caché:', error);
      return {};
    }
  }

  // Métodos privados

  private async getCachedConversations(): Promise<CachedConversations> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.error('Error obteniendo conversaciones del caché:', error);
      return {};
    }
  }

  private async getCachedConversation(conversationId: string): Promise<CachedConversation | null> {
    try {
      const cached = await this.getCachedConversations();
      return cached[conversationId] || null;
    } catch (error) {
      console.error('Error obteniendo conversación del caché:', error);
      return null;
    }
  }

  private async updateCachedConversation(conversationId: string, conversation: CachedConversation): Promise<void> {
    try {
      const cached = await this.getCachedConversations();
      cached[conversationId] = conversation;
      
      // Limpiar caché si excede el tamaño máximo
      await this.cleanupCacheIfNeeded(cached);
      
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error actualizando conversación en caché:', error);
    }
  }

  private async cleanupCacheIfNeeded(cached: CachedConversations): Promise<void> {
    const conversationIds = Object.keys(cached);
    
    if (conversationIds.length > this.MAX_CACHE_SIZE) {
      // Ordenar por prioridad y último acceso
      const sortedConversations = conversationIds
        .map(id => ({
          id,
          priority: cached[id].priority || 'low',
          lastAccess: cached[id].lastAccess || cached[id].lastUpdated,
          accessCount: cached[id].accessCount || 0
        }))
        .sort((a, b) => {
          // Prioridad: high > medium > low
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          
          if (priorityDiff !== 0) return priorityDiff;
          
          // Si tienen la misma prioridad, ordenar por acceso más reciente
          return new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime();
        });
      
      // Mantener solo las conversaciones más importantes
      const toKeep = sortedConversations.slice(0, this.MAX_CACHE_SIZE);
      const toRemove = sortedConversations.slice(this.MAX_CACHE_SIZE);
      
      // Eliminar conversaciones menos importantes
      toRemove.forEach(conv => {
        delete cached[conv.id];
      });
    }
  }

  private isCacheValid(cached: CachedConversation): boolean {
    const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
    
    // Si la conversación ya está marcada como cargada, ser más permisivo con la expiración
    if (cached.isLoaded) {
      // Para conversaciones cargadas, permitir hasta 3 días sin expirar
      return cacheAge < (3 * 24 * 60 * 60 * 1000);
    }
    
    // Para conversaciones no cargadas, usar el tiempo de expiración normal
    return cacheAge < this.CACHE_EXPIRY_MS;
  }

  /**
   * Calcula la prioridad de una conversación basada en su uso
   */
  private calculatePriority(accessCount: number, lastAccess?: string): 'high' | 'medium' | 'low' {
    if (!lastAccess) return 'low';
    
    const daysSinceLastAccess = (Date.now() - new Date(lastAccess).getTime()) / (1000 * 60 * 60 * 24);
    
    // Alta prioridad: accedida más de 5 veces y en los últimos 3 días
    if (accessCount >= 5 && daysSinceLastAccess <= 3) {
      return 'high';
    }
    
    // Media prioridad: accedida más de 2 veces y en los últimos 7 días
    if (accessCount >= 2 && daysSinceLastAccess <= 7) {
      return 'medium';
    }
    
    // Baja prioridad: resto de casos
    return 'low';
  }

  /**
   * Registra el acceso a una conversación para mejorar la precarga
   */
  async recordConversationAccess(conversationId: string): Promise<void> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      if (cached && this.isCacheValid(cached)) {
        cached.accessCount = (cached.accessCount || 0) + 1;
        cached.lastAccess = new Date().toISOString();
        cached.priority = this.calculatePriority(cached.accessCount, cached.lastAccess);
        
        await this.updateCachedConversation(conversationId, cached);
      }
    } catch (error) {
      console.error('Error registrando acceso a conversación:', error);
    }
  }

  /**
   * Obtiene conversaciones ordenadas por prioridad para precarga
   */
  async getConversationsByPriority(): Promise<{ conversationId: string; priority: 'high' | 'medium' | 'low'; accessCount: number }[]> {
    try {
      const cached = await this.getCachedConversations();
      const conversations = Object.entries(cached)
        .map(([conversationId, conversation]) => ({
          conversationId,
          priority: conversation.priority || 'low',
          accessCount: conversation.accessCount || 0,
          lastAccess: conversation.lastAccess
        }))
        .sort((a, b) => {
          // Ordenar por prioridad (high > medium > low)
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
          
          if (priorityDiff !== 0) return priorityDiff;
          
          // Si tienen la misma prioridad, ordenar por número de accesos
          return b.accessCount - a.accessCount;
        });
      
      return conversations;
    } catch (error) {
      console.error('Error obteniendo conversaciones por prioridad:', error);
      return [];
    }
  }

  /**
   * Obtiene conversaciones de alta prioridad para precarga inmediata
   */
  async getHighPriorityConversations(): Promise<string[]> {
    try {
      const conversations = await this.getConversationsByPriority();
      return conversations
        .filter(conv => conv.priority === 'high')
        .map(conv => conv.conversationId);
    } catch (error) {
      console.error('Error obteniendo conversaciones de alta prioridad:', error);
      return [];
    }
  }

  /**
   * Obtiene el último mensaje ID de una conversación para sincronización incremental
   */
  async getLastMessageId(conversationId: string): Promise<string | null> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      return cached?.lastMessageId || null;
    } catch (error) {
      console.error('Error obteniendo último mensaje ID:', error);
      return null;
    }
  }

  /**
   * Verifica si una conversación tiene mensajes en caché
   */
  async hasCachedMessages(conversationId: string): Promise<boolean> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      return cached ? cached.messages.length > 0 && this.isCacheValid(cached) : false;
    } catch (error) {
      console.error('Error verificando si hay mensajes en caché:', error);
      return false;
    }
  }

  /**
   * Obtiene solo mensajes nuevos desde el servidor (para sincronización incremental)
   */
  async getNewMessagesFromServer(conversationId: string, serverMessages: ChatMessage[]): Promise<ChatMessage[]> {
    try {
      const cachedMessages = await this.getCachedMessages(conversationId);
      const cachedMessageIds = new Set(cachedMessages.map(m => m.messageId));
      
      // Filtrar solo mensajes nuevos del servidor
      const newMessages = serverMessages.filter(msg => !cachedMessageIds.has(msg.messageId));
      
      console.log(`🔄 CacheService: De ${serverMessages.length} mensajes del servidor, ${newMessages.length} son nuevos`);
      
      return newMessages;
    } catch (error) {
      console.error('Error obteniendo mensajes nuevos del servidor:', error);
      return [];
    }
  }

  /**
   * Sincroniza incrementalmente una conversación (solo mensajes nuevos)
   */
  async syncConversationIncremental(conversationId: string, serverMessages: ChatMessage[]): Promise<{
    newMessagesCount: number;
    updatedMessages: ChatMessage[];
  }> {
    try {
      // Obtener mensajes nuevos
      const newMessages = await this.getNewMessagesFromServer(conversationId, serverMessages);
      
      if (newMessages.length === 0) {
        return { newMessagesCount: 0, updatedMessages: [] };
      }

      // Obtener mensajes existentes del caché
      const cachedMessages = await this.getCachedMessages(conversationId);
      
      // Combinar mensajes existentes con los nuevos
      const allMessages = [...cachedMessages, ...newMessages];
      
      // Ordenar por fecha (más antiguos primero)
      const sortedMessages = allMessages.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      // Actualizar caché
      await this.updateCachedMessages(conversationId, sortedMessages);
      
      console.log(`✅ CacheService: Sincronizados ${newMessages.length} mensajes nuevos para conversación ${conversationId}`);
      
      return {
        newMessagesCount: newMessages.length,
        updatedMessages: sortedMessages
      };
    } catch (error) {
      console.error('Error en sincronización incremental:', error);
      return { newMessagesCount: 0, updatedMessages: [] };
    }
  }

  /**
   * Sincroniza solo mensajes nuevos con el caché existente
   */
  async syncNewMessagesOnly(conversationId: string, newMessages: ChatMessage[]): Promise<void> {
    try {
      if (newMessages.length === 0) {
        console.log('✅ CacheService: No hay mensajes nuevos para sincronizar');
        return;
      }

      const cachedMessages = await this.getCachedMessages(conversationId);
      
      // Combinar mensajes existentes con los nuevos
      const allMessages = [...cachedMessages, ...newMessages];
      
      // Ordenar por fecha (más antiguos primero para el caché)
      const sortedMessages = allMessages.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      // Actualizar caché con todos los mensajes
      await this.updateCachedMessages(conversationId, sortedMessages);
      
      console.log(`✅ CacheService: Sincronizados ${newMessages.length} mensajes nuevos`);
    } catch (error) {
      console.error('Error sincronizando solo mensajes nuevos:', error);
    }
  }

  // ===== MÉTODOS PARA CACHÉ DE RENDERS =====

  private readonly RENDER_CACHE_KEY = 'chat_message_renders_cache';
  private renderCache: Map<string, Map<string, any>> = new Map();

  /**
   * Almacena un render pre-calculado de un mensaje en el caché
   */
  async cacheMessageRender(conversationId: string, messageId: string, renderData: any): Promise<void> {
    try {
      // Almacenar en memoria para acceso rápido
      if (!this.renderCache.has(conversationId)) {
        this.renderCache.set(conversationId, new Map());
      }
      this.renderCache.get(conversationId)!.set(messageId, renderData);

      // También almacenar en AsyncStorage para persistencia
      const storageKey = `${this.RENDER_CACHE_KEY}_${conversationId}`;
      const existingRenders = await AsyncStorage.getItem(storageKey);
      const renders = existingRenders ? JSON.parse(existingRenders) : {};
      
      renders[messageId] = {
        ...renderData,
        cachedAt: new Date().toISOString()
      };

      await AsyncStorage.setItem(storageKey, JSON.stringify(renders));
      
    } catch (error) {
      console.error(`Error cacheando render para mensaje ${messageId}:`, error);
    }
  }

  /**
   * Obtiene un render pre-calculado de un mensaje desde el caché
   */
  async getCachedMessageRender(conversationId: string, messageId: string): Promise<any | null> {
    try {
      // Primero intentar desde memoria (más rápido)
      const memoryCache = this.renderCache.get(conversationId);
      if (memoryCache && memoryCache.has(messageId)) {
        return memoryCache.get(messageId);
      }

      // Si no está en memoria, intentar desde AsyncStorage
      const storageKey = `${this.RENDER_CACHE_KEY}_${conversationId}`;
      const existingRenders = await AsyncStorage.getItem(storageKey);
      
      if (existingRenders) {
        const renders = JSON.parse(existingRenders);
        const renderData = renders[messageId];
        
        if (renderData) {
          // Cargar en memoria para futuros accesos
          if (!this.renderCache.has(conversationId)) {
            this.renderCache.set(conversationId, new Map());
          }
          this.renderCache.get(conversationId)!.set(messageId, renderData);
          
          return renderData;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error obteniendo render cacheados para mensaje ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Almacena un caché completo de renders para una conversación
   */
  async setRenderCache(conversationId: string, renderCache: Map<string, any>): Promise<void> {
    try {
      // Almacenar en memoria
      this.renderCache.set(conversationId, renderCache);

      // Convertir Map a objeto para AsyncStorage
      const rendersObject: { [key: string]: any } = {};
      renderCache.forEach((value, key) => {
        rendersObject[key] = {
          ...value,
          cachedAt: new Date().toISOString()
        };
      });

      // Almacenar en AsyncStorage
      const storageKey = `${this.RENDER_CACHE_KEY}_${conversationId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(rendersObject));
      
      console.log(`✅ CacheService: Caché de renders almacenado para conversación ${conversationId}: ${renderCache.size} renders`);
      
    } catch (error) {
      console.error(`Error almacenando caché de renders para conversación ${conversationId}:`, error);
    }
  }

  /**
   * Obtiene el caché completo de renders para una conversación
   */
  async getRenderCache(conversationId: string): Promise<Map<string, any>> {
    try {
      // Primero intentar desde memoria
      const memoryCache = this.renderCache.get(conversationId);
      if (memoryCache) {
        return memoryCache;
      }

      // Si no está en memoria, cargar desde AsyncStorage
      const storageKey = `${this.RENDER_CACHE_KEY}_${conversationId}`;
      const existingRenders = await AsyncStorage.getItem(storageKey);
      
      if (existingRenders) {
        const renders = JSON.parse(existingRenders);
        const renderMap = new Map<string, any>();
        
        Object.entries(renders).forEach(([messageId, renderData]) => {
          renderMap.set(messageId, renderData);
        });

        // Cargar en memoria para futuros accesos
        this.renderCache.set(conversationId, renderMap);
        
        return renderMap;
      }

      return new Map();
    } catch (error) {
      console.error(`Error obteniendo caché de renders para conversación ${conversationId}:`, error);
      return new Map();
    }
  }

  /**
   * Limpia el caché de renders de una conversación
   */
  async clearRenderCache(conversationId: string): Promise<void> {
    try {
      // Limpiar de memoria
      this.renderCache.delete(conversationId);

      // Limpiar de AsyncStorage
      const storageKey = `${this.RENDER_CACHE_KEY}_${conversationId}`;
      await AsyncStorage.removeItem(storageKey);
      
      console.log(`✅ CacheService: Caché de renders limpiado para conversación ${conversationId}`);
      
    } catch (error) {
      console.error(`Error limpiando caché de renders para conversación ${conversationId}:`, error);
    }
  }

  /**
   * Limpia todo el caché de renders
   */
  async clearAllRenderCache(): Promise<void> {
    try {
      // Limpiar de memoria
      this.renderCache.clear();

      // Obtener todas las claves de AsyncStorage que empiecen con RENDER_CACHE_KEY
      const allKeys = await AsyncStorage.getAllKeys();
      const renderCacheKeys = allKeys.filter(key => key.startsWith(this.RENDER_CACHE_KEY));
      
      if (renderCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(renderCacheKeys);
      }
      
      console.log(`✅ CacheService: Todo el caché de renders limpiado (${renderCacheKeys.length} conversaciones)`);
      
    } catch (error) {
      console.error('Error limpiando todo el caché de renders:', error);
    }
  }

  /**
   * Obtiene información del caché de renders para debugging
   */
  async getRenderCacheInfo(): Promise<{
    memoryCacheSize: number;
    storageCacheSize: number;
    conversations: string[];
  }> {
    try {
      const memoryCacheSize = this.renderCache.size;
      const allKeys = await AsyncStorage.getAllKeys();
      const renderCacheKeys = allKeys.filter(key => key.startsWith(this.RENDER_CACHE_KEY));
      const conversations = renderCacheKeys.map(key => key.replace(`${this.RENDER_CACHE_KEY}_`, ''));

      return {
        memoryCacheSize,
        storageCacheSize: renderCacheKeys.length,
        conversations
      };
    } catch (error) {
      console.error('Error obteniendo información del caché de renders:', error);
      return {
        memoryCacheSize: 0,
        storageCacheSize: 0,
        conversations: []
      };
    }
  }

  // ===== MÉTODOS PARA CACHÉ DE MENSAJES PRERENDERIZADOS =====

  private readonly PRERENDERED_MESSAGES_KEY = 'chat_prerendered_messages_cache';
  private prerenderedMessagesCache: Map<string, ChatMessage[]> = new Map();

  /**
   * Almacena mensajes prerenderizados para una conversación
   */
  async setPrerenderedMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      // Almacenar en memoria para acceso rápido
      this.prerenderedMessagesCache.set(conversationId, messages);

      // También almacenar en AsyncStorage para persistencia
      const storageKey = `${this.PRERENDERED_MESSAGES_KEY}_${conversationId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(messages));
      
      console.log(`🎭 CacheService: Almacenados ${messages.length} mensajes prerenderizados para conversación ${conversationId}`);
      
    } catch (error) {
      console.error(`Error almacenando mensajes prerenderizados para conversación ${conversationId}:`, error);
    }
  }

  /**
   * Obtiene mensajes prerenderizados de una conversación
   */
  async getPrerenderedMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      // Primero intentar desde memoria (más rápido)
      const memoryMessages = this.prerenderedMessagesCache.get(conversationId);
      if (memoryMessages) {
        return memoryMessages;
      }

      // Si no está en memoria, intentar desde AsyncStorage
      const storageKey = `${this.PRERENDERED_MESSAGES_KEY}_${conversationId}`;
      const storedMessages = await AsyncStorage.getItem(storageKey);
      
      if (storedMessages) {
        const messages = JSON.parse(storedMessages);
        
        // Cargar en memoria para futuros accesos
        this.prerenderedMessagesCache.set(conversationId, messages);
        
        return messages;
      }

      return [];
    } catch (error) {
      console.error(`Error obteniendo mensajes prerenderizados para conversación ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Limpia mensajes prerenderizados de una conversación
   */
  async clearPrerenderedMessages(conversationId: string): Promise<void> {
    try {
      // Limpiar de memoria
      this.prerenderedMessagesCache.delete(conversationId);

      // Limpiar de AsyncStorage
      const storageKey = `${this.PRERENDERED_MESSAGES_KEY}_${conversationId}`;
      await AsyncStorage.removeItem(storageKey);
      
      console.log(`🎭 CacheService: Mensajes prerenderizados limpiados para conversación ${conversationId}`);
      
    } catch (error) {
      console.error(`Error limpiando mensajes prerenderizados para conversación ${conversationId}:`, error);
    }
  }

  /**
   * Limpia todos los mensajes prerenderizados
   */
  async clearAllPrerenderedMessages(): Promise<void> {
    try {
      // Limpiar de memoria
      this.prerenderedMessagesCache.clear();

      // Obtener todas las claves de AsyncStorage que empiecen con PRERENDERED_MESSAGES_KEY
      const allKeys = await AsyncStorage.getAllKeys();
      const prerenderedKeys = allKeys.filter(key => key.startsWith(this.PRERENDERED_MESSAGES_KEY));
      
      if (prerenderedKeys.length > 0) {
        await AsyncStorage.multiRemove(prerenderedKeys);
      }
      
      console.log(`🎭 CacheService: Todos los mensajes prerenderizados limpiados (${prerenderedKeys.length} conversaciones)`);
      
    } catch (error) {
      console.error('Error limpiando todos los mensajes prerenderizados:', error);
    }
  }

  /**
   * Obtiene información de mensajes prerenderizados para debugging
   */
  async getPrerenderedMessagesInfo(): Promise<{
    memoryCacheSize: number;
    storageCacheSize: number;
    conversations: string[];
  }> {
    try {
      const memoryCacheSize = this.prerenderedMessagesCache.size;
      const allKeys = await AsyncStorage.getAllKeys();
      const prerenderedKeys = allKeys.filter(key => key.startsWith(this.PRERENDERED_MESSAGES_KEY));
      const conversations = prerenderedKeys.map(key => key.replace(`${this.PRERENDERED_MESSAGES_KEY}_`, ''));

      return {
        memoryCacheSize,
        storageCacheSize: prerenderedKeys.length,
        conversations
      };
    } catch (error) {
      console.error('Error obteniendo información de mensajes prerenderizados:', error);
      return {
        memoryCacheSize: 0,
        storageCacheSize: 0,
        conversations: []
      };
    }
  }
}

// Singleton
export const cacheService = new CacheService();
export default cacheService;
