import { AppState, AppStateStatus } from 'react-native';
import ApiService from './apiService';
import cacheService from './cacheService';
import socketService from './socketService';
import { ChatMessage } from './chatService';

interface ConversationInfo {
  conversationId: string;
  lastMessageId?: string;
  lastSyncTime: string;
  isActive: boolean;
  participants: string[];
}

interface BackgroundSyncConfig {
  syncInterval: number; // en milisegundos
  maxConcurrentSyncs: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Servicio de sincronización en segundo plano para conversaciones
 * Mantiene todas las conversaciones actualizadas constantemente
 */
class BackgroundSyncService {
  private conversations: Map<string, ConversationInfo> = new Map();
  private syncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private currentUserId: string | null = null;
  private appState: AppStateStatus = 'active';
  
  private config: BackgroundSyncConfig = {
    syncInterval: 30000, // 30 segundos
    maxConcurrentSyncs: 3,
    retryAttempts: 3,
    retryDelay: 5000 // 5 segundos
  };

  constructor() {
    this.setupAppStateListener();
  }

  /**
   * Inicializa el servicio de sincronización en segundo plano
   */
  async initialize(userId: string) {
    this.currentUserId = userId;
    console.log('🔄 BackgroundSync: Inicializando servicio para usuario:', userId);
    
    // Cargar conversaciones existentes
    await this.loadConversations();
    
    // Iniciar sincronización
    this.startSync();
  }

  /**
   * Detiene el servicio de sincronización
   */
  stop() {
    console.log('🛑 BackgroundSync: Deteniendo servicio');
    this.isRunning = false;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.conversations.clear();
  }

  /**
   * Añade una conversación para sincronización en segundo plano
   */
  addConversation(conversationId: string, participants: string[]) {
    const conversation: ConversationInfo = {
      conversationId,
      lastSyncTime: new Date().toISOString(),
      isActive: true,
      participants
    };
    
    this.conversations.set(conversationId, conversation);
    console.log(`➕ BackgroundSync: Añadida conversación ${conversationId} para sincronización`);
    
    // Sincronizar inmediatamente si no está corriendo el timer
    if (!this.isRunning) {
      this.syncConversation(conversationId);
    }
  }

  /**
   * Remueve una conversación de la sincronización
   */
  removeConversation(conversationId: string) {
    this.conversations.delete(conversationId);
    console.log(`➖ BackgroundSync: Removida conversación ${conversationId} de sincronización`);
  }

  /**
   * Marca una conversación como activa (usuario la está viendo)
   */
  setConversationActive(conversationId: string, isActive: boolean) {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.isActive = isActive;
      console.log(`👁️ BackgroundSync: Conversación ${conversationId} marcada como ${isActive ? 'activa' : 'inactiva'}`);
    }
  }

  /**
   * Actualiza el último mensaje de una conversación
   */
  updateLastMessage(conversationId: string, messageId: string) {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.lastMessageId = messageId;
      conversation.lastSyncTime = new Date().toISOString();
    }
  }

  /**
   * Obtiene el estado de sincronización de todas las conversaciones
   */
  getSyncStatus() {
    const status: { [conversationId: string]: { lastSync: string; isActive: boolean; needsSync: boolean } } = {};
    
    this.conversations.forEach((conv, id) => {
      const needsSync = this.shouldSyncConversation(conv);
      status[id] = {
        lastSync: conv.lastSyncTime,
        isActive: conv.isActive,
        needsSync
      };
    });
    
    return status;
  }

  // Métodos privados

  private setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = this.appState;
      this.appState = nextAppState;
      
      console.log(`📱 BackgroundSync: Cambio de estado de app: ${previousAppState} -> ${nextAppState}`);
      
      if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
        // App vuelve al primer plano - sincronizar inmediatamente
        console.log('🔄 BackgroundSync: App vuelve al primer plano, sincronizando...');
        this.syncAllConversations();
      } else if (nextAppState.match(/inactive|background/)) {
        // App pasa a segundo plano - reducir frecuencia de sincronización
        console.log('⏸️ BackgroundSync: App pasa a segundo plano, reduciendo sincronización...');
        this.adjustSyncForBackground();
      }
    });
  }

  private async loadConversations() {
    try {
      // Obtener conversaciones del usuario desde el servidor
      const response = await ApiService.listConversations({ limit: 50 });
      const conversations = response.data?.items || [];
      
      conversations.forEach((conv: any) => {
        this.addConversation(conv.conversationId, conv.participants || []);
      });
      
      console.log(`📋 BackgroundSync: Cargadas ${conversations.length} conversaciones`);
    } catch (error) {
      console.error('Error cargando conversaciones para sincronización:', error);
    }
  }

  private startSync() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 BackgroundSync: Iniciando sincronización en segundo plano');
    
    // Sincronizar inmediatamente
    this.syncAllConversations();
    
    // Configurar timer para sincronización periódica
    this.syncTimer = setInterval(() => {
      if (this.appState === 'active') {
        this.syncAllConversations();
      }
    }, this.config.syncInterval);
  }

  private async syncAllConversations() {
    const conversationsToSync = Array.from(this.conversations.values())
      .filter(conv => this.shouldSyncConversation(conv))
      .slice(0, this.config.maxConcurrentSyncs);
    
    if (conversationsToSync.length === 0) {
      console.log('✅ BackgroundSync: No hay conversaciones que necesiten sincronización');
      return;
    }
    
    console.log(`🔄 BackgroundSync: Sincronizando ${conversationsToSync.length} conversaciones`);
    
    // Sincronizar conversaciones en paralelo
    const syncPromises = conversationsToSync.map(conv => 
      this.syncConversation(conv.conversationId)
    );
    
    await Promise.allSettled(syncPromises);
  }

  private async syncConversation(conversationId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    
    try {
      console.log(`🔄 BackgroundSync: Sincronizando conversación ${conversationId}`);
      
      // Verificar si realmente necesita sincronización
      const needsSync = await cacheService.needsSync(conversationId, conversation.lastMessageId);
      if (!needsSync) {
        console.log(`✅ BackgroundSync: Conversación ${conversationId} ya está actualizada`);
        return;
      }
      
      // Obtener mensajes del servidor
      const response = await ApiService.listMessages(conversationId, { limit: 20 });
      const serverMessages = (response.data?.items || []) as ChatMessage[];
      
      if (serverMessages.length > 0) {
        // Actualizar caché
        await cacheService.updateCachedMessages(conversationId, serverMessages);
        
        // Actualizar información de la conversación
        const lastMessage = serverMessages[serverMessages.length - 1];
        conversation.lastMessageId = lastMessage.messageId;
        conversation.lastSyncTime = new Date().toISOString();
        
        console.log(`✅ BackgroundSync: Sincronizada conversación ${conversationId} con ${serverMessages.length} mensajes`);
        
        // Emitir evento de actualización si hay nuevos mensajes
        this.emitConversationUpdate(conversationId, serverMessages);
      }
    } catch (error) {
      console.error(`❌ BackgroundSync: Error sincronizando conversación ${conversationId}:`, error);
      
      // Reintentar después de un delay
      setTimeout(() => {
        this.syncConversation(conversationId);
      }, this.config.retryDelay);
    }
  }

  private shouldSyncConversation(conversation: ConversationInfo): boolean {
    const now = Date.now();
    const lastSync = new Date(conversation.lastSyncTime).getTime();
    const timeSinceLastSync = now - lastSync;
    
    // Sincronizar si:
    // 1. Ha pasado más de 30 segundos desde la última sincronización
    // 2. La conversación está activa y ha pasado más de 10 segundos
    // 3. Nunca se ha sincronizado
    
    if (!conversation.lastMessageId) return true; // Primera sincronización
    
    if (conversation.isActive) {
      return timeSinceLastSync > 10000; // 10 segundos para conversaciones activas
    } else {
      return timeSinceLastSync > 30000; // 30 segundos para conversaciones inactivas
    }
  }

  private adjustSyncForBackground() {
    // Reducir frecuencia de sincronización cuando la app está en segundo plano
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      this.syncAllConversations();
    }, this.config.syncInterval * 3); // 3 veces más lento en segundo plano
  }

  private emitConversationUpdate(conversationId: string, messages: ChatMessage[]) {
    // En React Native, usamos un sistema de eventos personalizado
    // ya que CustomEvent no está disponible
    try {
      // Emitir evento usando el sistema de eventos de React Native
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('conversationUpdated', {
        conversationId,
        messages
      });
    } catch (error) {
      console.log('📨 BackgroundSync: Evento de actualización emitido para conversación', conversationId);
      // Si no se puede emitir el evento, solo loguear
      // Los componentes se actualizarán en la próxima sincronización
    }
  }

  /**
   * Configura los parámetros de sincronización
   */
  configure(config: Partial<BackgroundSyncConfig>) {
    this.config = { ...this.config, ...config };
    console.log('⚙️ BackgroundSync: Configuración actualizada:', this.config);
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats() {
    const totalConversations = this.conversations.size;
    const activeConversations = Array.from(this.conversations.values())
      .filter(conv => conv.isActive).length;
    
    return {
      totalConversations,
      activeConversations,
      isRunning: this.isRunning,
      appState: this.appState,
      config: this.config
    };
  }
}

// Singleton
export const backgroundSyncService = new BackgroundSyncService();
export default backgroundSyncService;
