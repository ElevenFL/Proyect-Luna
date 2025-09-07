import { useState, useEffect, useCallback } from 'react';
import cacheService from '@/services/cacheService';
import { ChatMessage } from '@/services/chatService';

interface UseChatCacheOptions {
  conversationId: string | null;
  autoSync?: boolean;
  syncInterval?: number; // en milisegundos
}

interface UseChatCacheReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  isLoaded: boolean;
  cacheVersion: number;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  isPreloading: boolean;
  loadFromCache: () => Promise<void>;
  syncWithServer: (serverMessages: ChatMessage[]) => Promise<void>;
  syncNewMessagesOnly: (serverMessages: ChatMessage[]) => Promise<void>;
  addMessage: (message: ChatMessage) => Promise<void>;
  clearCache: () => Promise<void>;
  needsSync: () => Promise<boolean>;
  markAsLoaded: () => Promise<void>;
}

/**
 * Hook personalizado para manejar el caché de conversaciones
 * Proporciona una interfaz optimizada para cargar y sincronizar mensajes
 */
export const useChatCache = ({ 
  conversationId, 
  autoSync = true, 
  syncInterval = 30000 // 30 segundos por defecto
}: UseChatCacheOptions): UseChatCacheReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const [isPreloading, setIsPreloading] = useState(false);

  // Cargar mensajes desde caché
  const loadFromCache = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      // OPTIMIZACIÓN: Verificar si hay mensajes en caché antes de mostrar precarga
      const hasCachedMessages = await cacheService.hasCachedMessages(conversationId);
      
      // Solo mostrar precarga si no hay mensajes en caché
      if (!hasCachedMessages) {
        setIsPreloading(true);
      }
      
      const cacheData = await cacheService.getCachedMessagesWithState(conversationId);
      
      // OPTIMIZACIÓN: Establecer mensajes inmediatamente para evitar parpadeos
      setMessages(cacheData.messages);
      setIsLoaded(cacheData.isLoaded);
      setCacheVersion(cacheData.version);
      setSyncStatus(cacheData.syncStatus);
      
      // Solo mostrar log si hay mensajes o si es la primera carga
      if (cacheData.messages.length > 0 || !cacheData.isLoaded) {
        console.log(`📱 Hook: Cargados ${cacheData.messages.length} mensajes desde caché (v${cacheData.version}, loaded: ${cacheData.isLoaded})`);
      } else {
        console.log(`📱 Hook: No hay mensajes en caché para ${conversationId}`);
      }
    } catch (error) {
      console.error('Error cargando mensajes desde caché:', error);
      // En caso de error, asegurar que el estado esté limpio
      setMessages([]);
      setIsLoaded(false);
      setSyncStatus('error');
    } finally {
      setIsPreloading(false);
    }
    // No establecer isLoading en ningún caso para evitar parpadeos
  }, [conversationId]);

  // Sincronizar con mensajes del servidor
  const syncWithServer = useCallback(async (serverMessages: ChatMessage[]) => {
    if (!conversationId) return;
    
    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      // Actualizar estado de sincronización
      await cacheService.updateSyncStatus(conversationId, 'syncing');
      
      // Obtener mensajes actuales del caché para comparar
      const currentMessages = await cacheService.getCachedMessages(conversationId);
      const currentMessageIds = new Set(currentMessages.map(m => m.messageId));
      
      // Filtrar solo mensajes nuevos
      const newMessages = serverMessages.filter(msg => !currentMessageIds.has(msg.messageId));
      
      // OPTIMIZACIÓN: Solo actualizar caché si hay mensajes nuevos
      if (newMessages.length > 0) {
        // Actualizar caché con mensajes del servidor
        await cacheService.updateCachedMessages(conversationId, serverMessages);
        
        // Actualizar mensajes en el estado
        setMessages(serverMessages);
        setLastSyncTime(new Date().toISOString());
        setIsLoaded(true);
        setSyncStatus('success');
        
        // Actualizar versión del caché
        const newVersion = await cacheService.getCacheVersion(conversationId);
        setCacheVersion(newVersion);
        
        console.log(`🔄 Hook: Sincronizados ${serverMessages.length} mensajes totales, ${newMessages.length} nuevos (v${newVersion})`);
      } else {
        // No hay mensajes nuevos, solo marcar como sincronizado
        setLastSyncTime(new Date().toISOString());
        setIsLoaded(true);
        setSyncStatus('success');
        
        console.log(`✅ Hook: No hay mensajes nuevos, caché ya está actualizado`);
      }
    } catch (error) {
      console.error('Error sincronizando con servidor:', error);
      setSyncStatus('error');
      await cacheService.updateSyncStatus(conversationId, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [conversationId]);

  // Sincronizar solo mensajes nuevos (optimización para conversaciones ya cargadas)
  const syncNewMessagesOnly = useCallback(async (serverMessages: ChatMessage[]) => {
    if (!conversationId) return;
    
    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      // Actualizar estado de sincronización
      await cacheService.updateSyncStatus(conversationId, 'syncing');
      
      // Obtener solo mensajes nuevos del servidor
      const newMessages = await cacheService.getNewMessagesFromServer(conversationId, serverMessages);
      
      if (newMessages.length > 0) {
        // Sincronizar solo mensajes nuevos
        await cacheService.syncNewMessagesOnly(conversationId, newMessages);
        
        // Recargar mensajes desde caché para mantener consistencia
        const updatedMessages = await cacheService.getCachedMessages(conversationId);
        setMessages(updatedMessages);
        setLastSyncTime(new Date().toISOString());
        setIsLoaded(true);
        setSyncStatus('success');
        
        // Actualizar versión del caché
        const newVersion = await cacheService.getCacheVersion(conversationId);
        setCacheVersion(newVersion);
        
        console.log(`🔄 Hook: Sincronizados ${newMessages.length} mensajes nuevos únicamente (v${newVersion})`);
      } else {
        // No hay mensajes nuevos, solo marcar como sincronizado
        setLastSyncTime(new Date().toISOString());
        setIsLoaded(true);
        setSyncStatus('success');
        
        console.log(`✅ Hook: No hay mensajes nuevos, caché ya está actualizado`);
      }
    } catch (error) {
      console.error('Error sincronizando mensajes nuevos:', error);
      setSyncStatus('error');
      await cacheService.updateSyncStatus(conversationId, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [conversationId]);

  // Añadir un nuevo mensaje al caché
  const addMessage = useCallback(async (message: ChatMessage) => {
    if (!conversationId) return;
    
    try {
      // Verificar si el mensaje ya existe para evitar duplicados
      const messageExists = messages.some(m => m.messageId === message.messageId);
      
      if (!messageExists) {
        // Guardar en caché primero
        await cacheService.addMessageToCache(conversationId, message);
        
        // Recargar mensajes desde caché para mantener consistencia
        const updatedMessages = await cacheService.getCachedMessages(conversationId);
        setMessages(updatedMessages);
        
        // Actualizar versión del caché
        const newVersion = await cacheService.getCacheVersion(conversationId);
        setCacheVersion(newVersion);
        setIsLoaded(true);
        setSyncStatus('success');
        
        console.log(`➕ Hook: Añadido mensaje ${message.messageId} al caché (v${newVersion})`);
      } else {
        console.log(`ℹ️ Hook: Mensaje ${message.messageId} ya existe, ignorando`);
      }
    } catch (error) {
      console.error('Error añadiendo mensaje al caché:', error);
    }
  }, [conversationId, messages]);

  // Limpiar caché de la conversación
  const clearCache = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      await cacheService.clearConversationCache(conversationId);
      setMessages([]);
      setLastSyncTime(null);
      setIsLoaded(false);
      setCacheVersion(0);
      setSyncStatus('idle');
      console.log(`🗑️ Hook: Limpiado caché de conversación ${conversationId}`);
    } catch (error) {
      console.error('Error limpiando caché:', error);
    }
  }, [conversationId]);

  // Marcar conversación como cargada
  const markAsLoaded = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      await cacheService.markConversationAsLoaded(conversationId);
      setIsLoaded(true);
      console.log(`✅ Hook: Marcada conversación ${conversationId} como cargada`);
    } catch (error) {
      console.error('Error marcando conversación como cargada:', error);
    }
  }, [conversationId]);

  // Verificar si necesita sincronización
  const needsSync = useCallback(async (): Promise<boolean> => {
    if (!conversationId) return false;
    
    try {
      return await cacheService.needsSync(conversationId);
    } catch (error) {
      console.error('Error verificando necesidad de sincronización:', error);
      return true; // En caso de error, asumir que necesita sincronización
    }
  }, [conversationId]);

  // Cargar desde caché cuando cambie la conversación
  useEffect(() => {
    if (conversationId) {
      // Cargar inmediatamente sin mostrar estado de precarga si ya hay mensajes
      loadFromCache();
    } else {
      setMessages([]);
      setLastSyncTime(null);
      setIsLoaded(false);
      setCacheVersion(0);
      setSyncStatus('idle');
      setIsPreloading(false);
    }
  }, [conversationId, loadFromCache]);

  // Auto-sincronización periódica (opcional)
  useEffect(() => {
    if (!autoSync || !conversationId) return;

    const interval = setInterval(async () => {
      const shouldSync = await needsSync();
      if (shouldSync) {
        console.log('🔄 Hook: Auto-sincronización detectada como necesaria');
        // Nota: La sincronización real debe ser manejada por el componente padre
        // ya que requiere llamadas al servidor
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, conversationId, syncInterval, needsSync]);

  return {
    messages,
    isLoading,
    isSyncing,
    lastSyncTime,
    isLoaded,
    cacheVersion,
    syncStatus,
    isPreloading,
    loadFromCache,
    syncWithServer,
    syncNewMessagesOnly,
    addMessage,
    clearCache,
    needsSync,
    markAsLoaded
  };
};
