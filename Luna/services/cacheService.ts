import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, Conversation } from './chatService';

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
  private readonly CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas
  private readonly MAX_CACHED_MESSAGES = 100; // Máximo 100 mensajes por conversación

  /**
   * Obtiene mensajes de una conversación desde el caché
   */
  async getCachedMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      const cached = await this.getCachedConversation(conversationId);
      if (cached && this.isCacheValid(cached)) {
        console.log(`📱 Caché: Cargando ${cached.messages.length} mensajes para conversación ${conversationId}`);
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
          console.log(`⚡ Caché: Carga rápida de ${conversation.messages.length} mensajes para conversación ${conversationId}`);
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
        syncStatus: 'success'
      };

      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
      console.log(`💾 Caché: Guardados ${limitedMessages.length} mensajes para conversación ${conversationId} (v${currentVersion + 1})`);
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
          console.log(`➕ Caché: Añadido mensaje ${message.messageId} a conversación ${conversationId} (v${cached.version})`);
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
      const cached = await this.getCachedConversation(conversationId);
      
      if (cached && this.isCacheValid(cached)) {
        // Crear un mapa de mensajes existentes para evitar duplicados
        const existingMessagesMap = new Map(cached.messages.map(m => [m.messageId, m]));
        
        // Añadir o actualizar mensajes
        newMessages.forEach(message => {
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
        console.log(`🔄 Caché: Actualizados mensajes para conversación ${conversationId} (v${cached.version})`);
      }
    } catch (error) {
      console.error('Error actualizando mensajes en caché:', error);
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
        console.log(`✅ Caché: Marcada conversación ${conversationId} como cargada`);
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
        console.log(`🔄 Caché: Estado de sincronización actualizado para ${conversationId}: ${status}`);
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
      console.log(`🗑️ Caché: Limpiada conversación ${conversationId}`);
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
      console.log('🗑️ Caché: Limpiado todo el caché');
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
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(cached));
    } catch (error) {
      console.error('Error actualizando conversación en caché:', error);
    }
  }

  private isCacheValid(cached: CachedConversation): boolean {
    const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
    return cacheAge < this.CACHE_EXPIRY_MS;
  }
}

// Singleton
export const cacheService = new CacheService();
export default cacheService;
