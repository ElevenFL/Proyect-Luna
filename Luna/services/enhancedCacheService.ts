import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from './optimizedChatService';

// Interfaces para el nuevo sistema de caché
interface ConversationMetadata {
  conversationId: string;
  lastAccessTime: number;
  accessCount: number;
  lastMessageAt: string;
  unreadCount: number;
  priority: 'high' | 'medium' | 'low';
  participants: string[];
  otherUserInfo?: {
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
  createdAt: string;
  updatedAt: string;
}

interface CachedConversation {
  conversationId: string;
  messages: ChatMessage[];
  metadata: ConversationMetadata;
  lastUpdated: number;
  version: number;
  isPersisted: boolean; // Indica si está guardado en AsyncStorage
}

interface CacheStats {
  totalConversations: number;
  totalMessages: number;
  memoryUsage: number;
  persistedConversations: number;
  oldestConversation: string | null;
  newestConversation: string | null;
}

/**
 * Servicio de caché mejorado con LRU y persistencia selectiva
 * - Mantiene 80 conversaciones recientes en memoria
 * - 50 mensajes por conversación máximo
 * - Persiste las últimas 20 conversaciones en AsyncStorage
 * - Sistema LRU para gestión automática de memoria
 */
class EnhancedCacheService {
  private readonly MAX_MEMORY_CONVERSATIONS = 80;
  private readonly MAX_PERSISTED_CONVERSATIONS = 20;
  private readonly MAX_MESSAGES_PER_CONVERSATION = 50;
  private readonly PERSISTENCE_KEY = 'enhanced_chat_cache_persisted';
  private readonly METADATA_KEY = 'enhanced_chat_cache_metadata';
  private readonly CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
  
  // Caché en memoria (LRU)
  private memoryCache: Map<string, CachedConversation> = new Map();
  private accessOrder: string[] = []; // Para implementar LRU
  private lastCleanup: number = Date.now();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutos

  /**
   * Obtiene mensajes de una conversación desde el caché
   */
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      // Intentar desde caché en memoria primero
      let conversation = this.memoryCache.get(conversationId);
      
      if (!conversation) {
        // Si no está en memoria, intentar cargar desde persistencia
        conversation = await this.loadFromPersistence(conversationId);
        if (conversation) {
          this.addToMemoryCache(conversation);
        }
      }
      
      if (conversation && this.isCacheValid(conversation)) {
        // Actualizar metadata de acceso
        this.updateAccessMetadata(conversationId);
        return conversation.messages;
      }
      
      return [];
    } catch (error) {
      console.error('Error obteniendo mensajes del caché:', error);
      return [];
    }
  }

  /**
   * Guarda mensajes de una conversación en el caché
   */
  async setMessages(conversationId: string, messages: ChatMessage[], metadata: Partial<ConversationMetadata> = {}): Promise<void> {
    try {
      // Asegurar que los mensajes estén en orden descendente (más recientes primero)
      const sortedMessages = [...messages].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Limitar mensajes a 50 por conversación (mantener los más recientes)
      const limitedMessages = sortedMessages.slice(0, this.MAX_MESSAGES_PER_CONVERSATION);
      
      // Obtener o crear metadata
      const existingConv = this.memoryCache.get(conversationId);
      const conversationMetadata: ConversationMetadata = {
        conversationId,
        lastAccessTime: Date.now(),
        accessCount: (existingConv?.metadata.accessCount || 0) + 1,
        lastMessageAt: limitedMessages[0]?.createdAt || new Date().toISOString(), // El primer mensaje es el más reciente
        unreadCount: metadata.unreadCount || 0,
        priority: this.calculatePriority(existingConv?.metadata),
        participants: metadata.participants || existingConv?.metadata.participants || [],
        otherUserInfo: metadata.otherUserInfo || existingConv?.metadata.otherUserInfo,
        createdAt: metadata.createdAt || existingConv?.metadata.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const cachedConversation: CachedConversation = {
        conversationId,
        messages: limitedMessages,
        metadata: conversationMetadata,
        lastUpdated: Date.now(),
        version: (existingConv?.version || 0) + 1,
        isPersisted: false
      };

      // Añadir al caché en memoria
      this.addToMemoryCache(cachedConversation);
      
      // Decidir si persistir basado en prioridad y uso
      await this.updatePersistence(cachedConversation);
      
      console.log(`✅ EnhancedCache: Guardados ${limitedMessages.length} mensajes para conversación ${conversationId} (ordenados por fecha)`);
    } catch (error) {
      console.error('Error guardando mensajes en caché:', error);
    }
  }

  /**
   * Añade un mensaje a una conversación existente
   */
  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    try {
      let conversation = this.memoryCache.get(conversationId);
      
      if (!conversation) {
        // Crear nueva conversación
        await this.setMessages(conversationId, [message]);
        return;
      }

      // Verificar si el mensaje ya existe
      const messageExists = conversation.messages.some(m => m.messageId === message.messageId);
      if (messageExists) {
        console.log(`⚠️ EnhancedCache: Mensaje ${message.messageId} ya existe, ignorando`);
        return;
      }

      // Añadir mensaje y mantener orden descendente (más recientes primero)
      conversation.messages.push(message);
      conversation.messages = conversation.messages
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, this.MAX_MESSAGES_PER_CONVERSATION); // Mantener solo los más recientes

      // Actualizar metadata
      conversation.metadata.lastMessageAt = message.createdAt;
      conversation.metadata.updatedAt = new Date().toISOString();
      conversation.lastUpdated = Date.now();
      conversation.version++;

      // Actualizar caché
      this.memoryCache.set(conversationId, conversation);
      this.updateAccessOrder(conversationId);
      
      // Actualizar persistencia si es necesario
      await this.updatePersistence(conversation);
      
      console.log(`➕ EnhancedCache: Añadido mensaje ${message.messageId} a conversación ${conversationId}`);
    } catch (error) {
      console.error('Error añadiendo mensaje al caché:', error);
    }
  }

  /**
   * Obtiene metadata de una conversación
   */
  async getConversationMetadata(conversationId: string): Promise<ConversationMetadata | null> {
    try {
      let conversation = this.memoryCache.get(conversationId);
      
      if (!conversation) {
        conversation = await this.loadFromPersistence(conversationId);
      }
      
      return conversation?.metadata || null;
    } catch (error) {
      console.error('Error obteniendo metadata de conversación:', error);
      return null;
    }
  }

  /**
   * Actualiza metadata de una conversación
   */
  async updateConversationMetadata(conversationId: string, updates: Partial<ConversationMetadata>): Promise<void> {
    try {
      let conversation = this.memoryCache.get(conversationId);
      
      if (!conversation) {
        conversation = await this.loadFromPersistence(conversationId);
        if (conversation) {
          this.addToMemoryCache(conversation);
        }
      }
      
      if (conversation) {
        conversation.metadata = { ...conversation.metadata, ...updates };
        conversation.lastUpdated = Date.now();
        conversation.version++;
        
        this.memoryCache.set(conversationId, conversation);
        this.updateAccessOrder(conversationId);
        
        await this.updatePersistence(conversation);
      }
    } catch (error) {
      console.error('Error actualizando metadata de conversación:', error);
    }
  }

  /**
   * Obtiene todas las conversaciones ordenadas por prioridad
   */
  async getConversationsByPriority(): Promise<ConversationMetadata[]> {
    try {
      const conversations: ConversationMetadata[] = [];
      
      // Añadir conversaciones en memoria
      for (const [_, conversation] of this.memoryCache) {
        conversations.push(conversation.metadata);
      }
      
      // Añadir conversaciones persistentes que no estén en memoria
      const persistedConversations = await this.loadPersistedConversations();
      for (const conversation of persistedConversations) {
        if (!this.memoryCache.has(conversation.conversationId)) {
          conversations.push(conversation.metadata);
        }
      }
      
      // Ordenar por prioridad y último acceso
      return conversations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        
        return b.lastAccessTime - a.lastAccessTime;
      });
    } catch (error) {
      console.error('Error obteniendo conversaciones por prioridad:', error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  getCacheStats(): CacheStats {
    const stats: CacheStats = {
      totalConversations: this.memoryCache.size,
      totalMessages: 0,
      memoryUsage: 0,
      persistedConversations: 0,
      oldestConversation: null,
      newestConversation: null
    };

    let oldestTime = Date.now();
    let newestTime = 0;

    for (const [id, conversation] of this.memoryCache) {
      stats.totalMessages += conversation.messages.length;
      stats.memoryUsage += JSON.stringify(conversation).length;
      stats.persistedConversations += conversation.isPersisted ? 1 : 0;
      
      const convTime = conversation.lastUpdated;
      if (convTime < oldestTime) {
        oldestTime = convTime;
        stats.oldestConversation = id;
      }
      if (convTime > newestTime) {
        newestTime = convTime;
        stats.newestConversation = id;
      }
    }

    return stats;
  }

  /**
   * Limpia el caché de una conversación específica
   */
  async clearConversation(conversationId: string): Promise<void> {
    try {
      this.memoryCache.delete(conversationId);
      this.removeFromAccessOrder(conversationId);
      
      // También remover de persistencia
      await this.removeFromPersistence(conversationId);
      
      console.log(`🗑️ EnhancedCache: Limpiada conversación ${conversationId}`);
    } catch (error) {
      console.error('Error limpiando conversación del caché:', error);
    }
  }

  /**
   * Limpia todo el caché
   */
  async clearAllCache(): Promise<void> {
    try {
      this.memoryCache.clear();
      this.accessOrder = [];
      
      // Limpiar persistencia
      await AsyncStorage.multiRemove([this.PERSISTENCE_KEY, this.METADATA_KEY]);
      
      console.log('🧹 EnhancedCache: Todo el caché limpiado');
    } catch (error) {
      console.error('Error limpiando todo el caché:', error);
    }
  }

  /**
   * Ejecuta limpieza automática del caché
   */
  async performCleanup(): Promise<void> {
    try {
      const now = Date.now();
      
      // Solo ejecutar limpieza cada 5 minutos
      if (now - this.lastCleanup < this.CLEANUP_INTERVAL) {
        return;
      }
      
      this.lastCleanup = now;
      
      // Limpiar conversaciones expiradas
      const expiredConversations: string[] = [];
      
      for (const [id, conversation] of this.memoryCache) {
        if (!this.isCacheValid(conversation)) {
          expiredConversations.push(id);
        }
      }
      
      for (const id of expiredConversations) {
        await this.clearConversation(id);
      }
      
      // Aplicar límite LRU si es necesario
      await this.enforceMemoryLimit();
      
      console.log(`🧹 EnhancedCache: Limpieza completada, removidas ${expiredConversations.length} conversaciones expiradas`);
    } catch (error) {
      console.error('Error en limpieza automática del caché:', error);
    }
  }

  // Métodos privados

  private addToMemoryCache(conversation: CachedConversation): void {
    this.memoryCache.set(conversation.conversationId, conversation);
    this.updateAccessOrder(conversation.conversationId);
  }

  private updateAccessOrder(conversationId: string): void {
    // Remover si ya existe
    this.removeFromAccessOrder(conversationId);
    // Añadir al final (más reciente)
    this.accessOrder.push(conversationId);
  }

  private removeFromAccessOrder(conversationId: string): void {
    const index = this.accessOrder.indexOf(conversationId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateAccessMetadata(conversationId: string): void {
    const conversation = this.memoryCache.get(conversationId);
    if (conversation) {
      conversation.metadata.lastAccessTime = Date.now();
      conversation.metadata.accessCount++;
      conversation.metadata.priority = this.calculatePriority(conversation.metadata);
      this.memoryCache.set(conversationId, conversation);
      this.updateAccessOrder(conversationId);
    }
  }

  private calculatePriority(metadata?: ConversationMetadata): 'high' | 'medium' | 'low' {
    if (!metadata) return 'low';
    
    const now = Date.now();
    const daysSinceLastAccess = (now - metadata.lastAccessTime) / (1000 * 60 * 60 * 24);
    
    // Alta prioridad: accedida más de 10 veces y en los últimos 2 días
    if (metadata.accessCount >= 10 && daysSinceLastAccess <= 2) {
      return 'high';
    }
    
    // Media prioridad: accedida más de 3 veces y en los últimos 7 días
    if (metadata.accessCount >= 3 && daysSinceLastAccess <= 7) {
      return 'medium';
    }
    
    return 'low';
  }

  private async updatePersistence(conversation: CachedConversation): Promise<void> {
    try {
      // Solo persistir conversaciones de alta prioridad o las más recientes
      const shouldPersist = conversation.metadata.priority === 'high' || 
                           this.shouldPersistByRecency(conversation);
      
      if (shouldPersist) {
        await this.saveToPersistence(conversation);
        conversation.isPersisted = true;
      }
    } catch (error) {
      console.error('Error actualizando persistencia:', error);
    }
  }

  private shouldPersistByRecency(conversation: CachedConversation): boolean {
    // Persistir si es una de las 20 conversaciones más recientes
    const sortedByTime = Array.from(this.memoryCache.values())
      .sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt))
      .slice(0, this.MAX_PERSISTED_CONVERSATIONS);
    
    return sortedByTime.some(conv => conv.conversationId === conversation.conversationId);
  }

  private async saveToPersistence(conversation: CachedConversation): Promise<void> {
    try {
      const persistedConversations = await this.loadPersistedConversations();
      
      // Remover si ya existe
      const filtered = persistedConversations.filter(conv => 
        conv.conversationId !== conversation.conversationId
      );
      
      // Añadir la conversación
      filtered.push(conversation);
      
      // Mantener solo las más recientes
      const sorted = filtered
        .sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt))
        .slice(0, this.MAX_PERSISTED_CONVERSATIONS);
      
      await AsyncStorage.setItem(this.PERSISTENCE_KEY, JSON.stringify(sorted));
      
      console.log(`💾 EnhancedCache: Persistida conversación ${conversation.conversationId}`);
    } catch (error) {
      console.error('Error guardando en persistencia:', error);
    }
  }

  private async loadFromPersistence(conversationId: string): Promise<CachedConversation | null> {
    try {
      const persistedConversations = await this.loadPersistedConversations();
      return persistedConversations.find(conv => conv.conversationId === conversationId) || null;
    } catch (error) {
      console.error('Error cargando desde persistencia:', error);
      return null;
    }
  }

  private async loadPersistedConversations(): Promise<CachedConversation[]> {
    try {
      const data = await AsyncStorage.getItem(this.PERSISTENCE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error cargando conversaciones persistentes:', error);
      return [];
    }
  }

  private async removeFromPersistence(conversationId: string): Promise<void> {
    try {
      const persistedConversations = await this.loadPersistedConversations();
      const filtered = persistedConversations.filter(conv => 
        conv.conversationId !== conversationId
      );
      
      await AsyncStorage.setItem(this.PERSISTENCE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removiendo de persistencia:', error);
    }
  }

  private async enforceMemoryLimit(): Promise<void> {
    if (this.memoryCache.size <= this.MAX_MEMORY_CONVERSATIONS) {
      return;
    }
    
    // Remover las conversaciones menos usadas (LRU)
    const toRemove = this.accessOrder.slice(0, this.memoryCache.size - this.MAX_MEMORY_CONVERSATIONS);
    
    for (const conversationId of toRemove) {
      await this.clearConversation(conversationId);
    }
    
    console.log(`🔧 EnhancedCache: Aplicado límite LRU, removidas ${toRemove.length} conversaciones`);
  }

  private isCacheValid(conversation: CachedConversation): boolean {
    const now = Date.now();
    const age = now - conversation.lastUpdated;
    return age < this.CACHE_EXPIRY_MS;
  }

  /**
   * Inicializa el servicio y carga conversaciones persistentes
   */
  async initialize(): Promise<void> {
    try {
      // Cargar conversaciones persistentes en memoria si hay espacio
      const persistedConversations = await this.loadPersistedConversations();
      
      for (const conversation of persistedConversations.slice(0, this.MAX_MEMORY_CONVERSATIONS)) {
        this.addToMemoryCache(conversation);
      }
      
      // Iniciar limpieza automática
      setInterval(() => this.performCleanup(), this.CLEANUP_INTERVAL);
      
      console.log(`✅ EnhancedCache: Inicializado con ${persistedConversations.length} conversaciones persistentes`);
    } catch (error) {
      console.error('Error inicializando EnhancedCache:', error);
    }
  }
}

// Singleton
export const enhancedCacheService = new EnhancedCacheService();
export default enhancedCacheService;
