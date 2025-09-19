import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './apiService';

interface ReadStatusUpdate {
  conversationId: string;
  messageIds: string[];
  timestamp: number;
  retryCount: number;
}

interface ReadStatusCache {
  [conversationId: string]: {
    [messageId: string]: boolean;
  };
}

/**
 * Servicio para manejar el estado de lectura de mensajes de forma optimizada
 * Actualiza localmente primero y sincroniza por lotes con la base de datos
 */
class ReadStatusBatchService {
  private readonly STORAGE_KEY = 'read_status_cache';
  private readonly BATCH_QUEUE_KEY = 'read_status_batch_queue';
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_INTERVAL = 1000; // 1 segundo (más rápido para mejor UX)
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5 segundos

  private batchQueue: ReadStatusUpdate[] = [];
  private localReadStatus: ReadStatusCache = {};
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private isInitialized = false;
  private failedItems: ReadStatusUpdate[] = []; // Cola de elementos que fallaron definitivamente
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly RECOVERY_INTERVAL = 5 * 60 * 1000; // 5 minutos

  /**
   * Inicializa el servicio
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Cargar estado local desde AsyncStorage
      await this.loadLocalReadStatus();
      
      // Cargar cola de sincronización pendiente
      await this.loadBatchQueue();
      
      // Iniciar procesamiento de lotes
      this.startBatchProcessing();
      
      // Iniciar sistema de recuperación
      this.startRecoverySystem();
      
      this.isInitialized = true;
      console.log('✅ ReadStatusBatchService: Inicializado');
    } catch (error) {
      console.error('❌ ReadStatusBatchService: Error inicializando:', error);
      throw error;
    }
  }

  /**
   * Marca mensajes como leídos localmente (inmediato) y los añade a la cola de sincronización
   */
  async markAsRead(conversationId: string, messageIds: string[]): Promise<void> {
    try {
      console.log(`👁️ ReadStatusBatchService: Marcando ${messageIds.length} mensajes como leídos localmente en conversación ${conversationId}`);

      // Filtrar mensajes que ya están marcados como leídos para evitar duplicados
      const unreadMessageIds = messageIds.filter(id => {
        const isAlreadyRead = this.isMessageRead(conversationId, id);
        if (isAlreadyRead) {
          console.log(`ℹ️ ReadStatusBatchService: Mensaje ${id} ya está marcado como leído localmente`);
        }
        return !isAlreadyRead;
      });

      if (unreadMessageIds.length === 0) {
        console.log(`ℹ️ ReadStatusBatchService: Todos los mensajes ya están marcados como leídos, omitiendo actualización`);
        return;
      }

      console.log(`📝 ReadStatusBatchService: ${unreadMessageIds.length} de ${messageIds.length} mensajes realmente necesitan ser marcados como leídos:`, unreadMessageIds);

      // Actualizar estado local inmediatamente solo para mensajes no leídos
      this.updateLocalReadStatus(conversationId, unreadMessageIds);

      // Añadir a la cola de sincronización solo mensajes no leídos
      await this.addToBatchQueue(conversationId, unreadMessageIds);

      // Guardar estado local
      await this.saveLocalReadStatus();

      console.log(`✅ ReadStatusBatchService: Estado local actualizado para ${unreadMessageIds.length} mensajes en conversación ${conversationId}`);
    } catch (error) {
      console.error('❌ ReadStatusBatchService: Error marcando como leído:', error);
      throw error;
    }
  }

  /**
   * Verifica si un mensaje está marcado como leído localmente
   */
  isMessageRead(conversationId: string, messageId: string): boolean {
    return this.localReadStatus[conversationId]?.[messageId] || false;
  }

  /**
   * Obtiene todos los mensajes leídos de una conversación
   */
  getReadMessages(conversationId: string): string[] {
    const conversationReadStatus = this.localReadStatus[conversationId];
    if (!conversationReadStatus) return [];

    return Object.keys(conversationReadStatus).filter(
      messageId => conversationReadStatus[messageId]
    );
  }

  /**
   * Sincroniza manualmente la cola de lotes con la base de datos
   */
  async syncBatchQueue(): Promise<void> {
    if (this.isProcessing || this.batchQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      console.log(`🔄 ReadStatusBatchService: Sincronizando ${this.batchQueue.length} lotes pendientes`);

      // Procesar lotes en grupos
      const batches = this.chunkArray(this.batchQueue, this.BATCH_SIZE);
      
      for (const batch of batches) {
        await this.processBatch(batch);
      }

      // Limpiar cola procesada
      this.batchQueue = [];
      await this.saveBatchQueue();

      console.log('✅ ReadStatusBatchService: Cola de lotes sincronizada exitosamente');
    } catch (error) {
      console.error('❌ ReadStatusBatchService: Error sincronizando cola de lotes:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Fuerza la sincronización inmediata de un lote específico (para casos críticos)
   */
  async forceSyncConversation(conversationId: string): Promise<void> {
    try {
      // Buscar lotes pendientes para esta conversación
      const pendingBatches = this.batchQueue.filter(item => item.conversationId === conversationId);
      
      if (pendingBatches.length === 0) {
        console.log(`ℹ️ ReadStatusBatchService: No hay lotes pendientes para forzar sincronización de ${conversationId}`);
        return;
      }

      console.log(`⚡ ReadStatusBatchService: Forzando sincronización inmediata para ${conversationId} (${pendingBatches.length} lotes)`);

      // Procesar inmediatamente
      await this.processBatch(pendingBatches);

      // Remover de la cola
      this.batchQueue = this.batchQueue.filter(item => item.conversationId !== conversationId);
      await this.saveBatchQueue();

      console.log(`✅ ReadStatusBatchService: Sincronización forzada completada para ${conversationId}`);
    } catch (error) {
      console.error(`❌ ReadStatusBatchService: Error en sincronización forzada para ${conversationId}:`, error);
    }
  }

  /**
   * Sincroniza manualmente elementos fallidos (para uso desde hooks)
   */
  async syncFailedItems(): Promise<void> {
    await this.recoverFailedSync();
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      queueLength: this.batchQueue.length,
      failedItemsCount: this.failedItems.length,
      localReadStatusCount: Object.keys(this.localReadStatus).length,
      totalReadMessages: Object.values(this.localReadStatus).reduce(
        (total, conv) => total + Object.values(conv).filter(Boolean).length,
        0
      )
    };
  }

  /**
   * Recupera elementos que fallaron en la sincronización
   */
  async recoverFailedSync(): Promise<void> {
    if (this.failedItems.length === 0) {
      return;
    }

    console.log(`🔄 ReadStatusBatchService: Intentando recuperar ${this.failedItems.length} elementos fallidos`);

    const itemsToRetry = [...this.failedItems];
    this.failedItems = []; // Limpiar la cola de fallidos

    for (const item of itemsToRetry) {
      try {
        // Intentar con estrategia de recuperación (lotes más pequeños, más tiempo)
        await this.retryWithRecoveryStrategy(item);
        console.log(`✅ ReadStatusBatchService: Elemento recuperado exitosamente: ${item.conversationId}`);
      } catch (error) {
        console.error(`❌ ReadStatusBatchService: Elemento aún fallando en recuperación: ${item.conversationId}`, error);
        // Volver a añadir a la cola de fallidos
        this.failedItems.push(item);
      }
    }

    if (this.failedItems.length > 0) {
      console.log(`⚠️ ReadStatusBatchService: ${this.failedItems.length} elementos aún fallando después de recuperación`);
    }
  }

  /**
   * Limpia el caché local (útil para testing o reset)
   */
  async clearCache(): Promise<void> {
    this.localReadStatus = {};
    this.batchQueue = [];
    this.isProcessing = false;

    await AsyncStorage.multiRemove([this.STORAGE_KEY, this.BATCH_QUEUE_KEY]);
    console.log('🧹 ReadStatusBatchService: Caché limpiado');
  }

  // Métodos privados

  private async loadLocalReadStatus(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.localReadStatus = JSON.parse(stored);
        console.log(`📱 ReadStatusBatchService: Estado local cargado - ${Object.keys(this.localReadStatus).length} conversaciones`);
      }
    } catch (error) {
      console.error('❌ ReadStatusBatchService: Error cargando estado local:', error);
      this.localReadStatus = {};
    }
  }

  private async saveLocalReadStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.localReadStatus));
    } catch (error) {
      console.error('❌ ReadStatusBatchService: Error guardando estado local:', error);
    }
  }

  private async loadBatchQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.BATCH_QUEUE_KEY);
      if (stored) {
        this.batchQueue = JSON.parse(stored);
        console.log(`📦 ReadStatusBatchService: Cola de lotes cargada - ${this.batchQueue.length} elementos`);
      }
    } catch (error) {
      console.error('❌ ReadStatusBatchService: Error cargando cola de lotes:', error);
      this.batchQueue = [];
    }
  }

  private async saveBatchQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.BATCH_QUEUE_KEY, JSON.stringify(this.batchQueue));
    } catch (error) {
      console.error('❌ ReadStatusBatchService: Error guardando cola de lotes:', error);
    }
  }

  private updateLocalReadStatus(conversationId: string, messageIds: string[]): void {
    if (!this.localReadStatus[conversationId]) {
      this.localReadStatus[conversationId] = {};
    }

    messageIds.forEach(messageId => {
      this.localReadStatus[conversationId][messageId] = true;
    });
  }

  private async addToBatchQueue(conversationId: string, messageIds: string[]): Promise<void> {
    // Verificar si ya existe un lote pendiente para esta conversación
    const existingIndex = this.batchQueue.findIndex(
      item => item.conversationId === conversationId
    );

    if (existingIndex >= 0) {
      // Combinar con el lote existente, eliminando duplicados
      const existing = this.batchQueue[existingIndex];
      const combinedMessageIds = [...new Set([...existing.messageIds, ...messageIds])];
      
      // Solo actualizar si hay mensajes nuevos
      if (combinedMessageIds.length > existing.messageIds.length) {
        this.batchQueue[existingIndex] = {
          ...existing,
          messageIds: combinedMessageIds,
          timestamp: Date.now()
        };
        console.log(`📦 ReadStatusBatchService: Lote existente actualizado con ${combinedMessageIds.length - existing.messageIds.length} mensajes nuevos`);
      } else {
        console.log(`ℹ️ ReadStatusBatchService: No hay mensajes nuevos para añadir al lote existente`);
      }
    } else {
      // Crear nuevo lote
      this.batchQueue.push({
        conversationId,
        messageIds,
        timestamp: Date.now(),
        retryCount: 0
      });
      console.log(`📦 ReadStatusBatchService: Nuevo lote creado para conversación ${conversationId} con ${messageIds.length} mensajes`);
    }

    await this.saveBatchQueue();
  }

  private startBatchProcessing(): void {
    // Procesar lotes periódicamente
    this.batchTimer = setInterval(() => {
      if (this.batchQueue.length > 0 && !this.isProcessing) {
        this.syncBatchQueue().catch(error => {
          console.error('❌ ReadStatusBatchService: Error en procesamiento automático:', error);
        });
      }
    }, this.BATCH_INTERVAL);

    console.log('⏰ ReadStatusBatchService: Procesamiento automático de lotes iniciado');
  }

  private async processBatch(batch: ReadStatusUpdate[]): Promise<void> {
    const promises = batch.map(update => this.processSingleUpdate(update));
    await Promise.allSettled(promises);
  }

  private async processSingleUpdate(update: ReadStatusUpdate): Promise<void> {
    try {
      console.log(`🔄 ReadStatusBatchService: Procesando lote para conversación ${update.conversationId} (${update.messageIds.length} mensajes)`);

      const response = await ApiService.markMessagesAsRead(update.conversationId, update.messageIds);

      if (response.success) {
        console.log(`✅ ReadStatusBatchService: Lote procesado exitosamente para conversación ${update.conversationId}`);
      } else {
        throw new Error(response.error || 'Error marcando mensajes como leídos');
      }
    } catch (error) {
      console.error(`❌ ReadStatusBatchService: Error procesando lote para conversación ${update.conversationId}:`, error);
      
      // Reintentar si no se ha excedido el límite
      if (update.retryCount < this.MAX_RETRIES) {
        update.retryCount++;
        update.timestamp = Date.now() + this.RETRY_DELAY; // Programar para más tarde
        
        // Re-añadir a la cola para reintento
        this.batchQueue.push(update);
        await this.saveBatchQueue();
        
        console.log(`🔄 ReadStatusBatchService: Lote programado para reintento ${update.retryCount}/${this.MAX_RETRIES}`);
      } else {
        console.error(`❌ ReadStatusBatchService: Lote falló definitivamente después de ${this.MAX_RETRIES} intentos, moviendo a cola de recuperación`);
        // Mover a la cola de elementos fallidos para recuperación posterior
        this.failedItems.push(update);
      }
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Inicia el sistema de recuperación automática
   */
  private startRecoverySystem(): void {
    this.recoveryTimer = setInterval(() => {
      if (this.failedItems.length > 0) {
        this.recoverFailedSync().catch(error => {
          console.error('❌ ReadStatusBatchService: Error en recuperación automática:', error);
        });
      }
    }, this.RECOVERY_INTERVAL);

    console.log('🔄 ReadStatusBatchService: Sistema de recuperación automática iniciado');
  }

  /**
   * Estrategia de recuperación con lotes más pequeños y más tiempo
   */
  private async retryWithRecoveryStrategy(item: ReadStatusUpdate): Promise<void> {
    console.log(`🔄 ReadStatusBatchService: Aplicando estrategia de recuperación para ${item.conversationId}`);

    // Esperar más tiempo antes de reintentar
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos

    // Procesar en lotes más pequeños (5 mensajes por vez)
    const chunks = this.chunkArray(item.messageIds, 5);
    
    for (const chunk of chunks) {
      try {
        const response = await ApiService.markMessagesAsRead(item.conversationId, chunk);
        if (!response.success) {
          throw new Error(response.error || 'Error en estrategia de recuperación');
        }
        console.log(`✅ ReadStatusBatchService: Chunk de ${chunk.length} mensajes procesado en recuperación`);
      } catch (error) {
        console.error(`❌ ReadStatusBatchService: Error procesando chunk en recuperación:`, error);
        throw error; // Re-lanzar para que el elemento vuelva a la cola de fallidos
      }
    }
  }

  /**
   * Limpia recursos al desmontar
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    
    this.isInitialized = false;
    this.isProcessing = false;
    this.failedItems = [];
    console.log('🔌 ReadStatusBatchService: Destruido');
  }
}

// Singleton
export const readStatusBatchService = new ReadStatusBatchService();
export default readStatusBatchService;
