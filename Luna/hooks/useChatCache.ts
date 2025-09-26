import { useState, useEffect, useCallback } from 'react';
import enhancedCacheService from '@/services/enhancedCacheService';
import { ChatMessage } from '@/services/optimizedChatService';

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
  metadata: {
    accessCount: number;
    priority: 'high' | 'medium' | 'low';
    lastAccessTime: number;
    unreadCount: number;
  } | null;
  loadFromCache: () => Promise<void>;
  syncWithServer: (serverMessages: ChatMessage[]) => Promise<void>;
  syncNewMessagesOnly: (serverMessages: ChatMessage[]) => Promise<void>;
  addMessage: (message: ChatMessage) => Promise<void>;
  clearCache: () => Promise<void>;
  needsSync: () => Promise<boolean>;
  markAsLoaded: () => Promise<void>;
  updateMetadata: (updates: any) => Promise<void>;
  getCacheStats: () => any;
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
  const [metadata, setMetadata] = useState<{
    accessCount: number;
    priority: 'high' | 'medium' | 'low';
    lastAccessTime: number;
    unreadCount: number;
  } | null>(null);

  // Cargar mensajes desde caché
  const loadFromCache = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      // Obtener mensajes desde el caché mejorado
      const cachedMessages = await enhancedCacheService.getMessages(conversationId);
      
      // Solo mostrar precarga si no hay mensajes en caché
      if (cachedMessages.length === 0) {
        setIsPreloading(true);
      }
      
      // Obtener metadata y versión de la conversación
      const conversationMetadata = await enhancedCacheService.getConversationMetadata(conversationId);
      const conversationVersion = await enhancedCacheService.getConversationVersion(conversationId);
      
      // Establecer mensajes inmediatamente para evitar parpadeos
      setMessages(cachedMessages);
      setIsLoaded(cachedMessages.length > 0);
      setCacheVersion(conversationVersion);
      setSyncStatus('success');
      
      // Establecer metadata si existe
      if (conversationMetadata) {
        setMetadata({
          accessCount: conversationMetadata.accessCount,
          priority: conversationMetadata.priority,
          lastAccessTime: conversationMetadata.lastAccessTime,
          unreadCount: conversationMetadata.unreadCount
        });
      }
      
      // Solo mostrar log si hay mensajes o si es la primera carga
      if (cachedMessages.length > 0) {
        console.log(`📱 Hook: Cargados ${cachedMessages.length} mensajes desde caché mejorado (v${conversationVersion})`);
      } else {
        console.log(`📱 Hook: No hay mensajes en caché para ${conversationId}`);
      }
    } catch (error) {
      console.error('Error cargando mensajes desde caché:', error);
      // En caso de error, asegurar que el estado esté limpio
      setMessages([]);
      setIsLoaded(false);
      setSyncStatus('error');
      setMetadata(null);
    } finally {
      setIsPreloading(false);
    }
  }, [conversationId]);

  // Sincronizar con mensajes del servidor
  const syncWithServer = useCallback(async (serverMessages: ChatMessage[]) => {
    if (!conversationId) return;
    
    setIsSyncing(true);
    setSyncStatus('syncing');
    
    try {
      // Obtener mensajes actuales del caché para comparar
      const currentMessages = await enhancedCacheService.getMessages(conversationId);
      const currentMessageIds = new Set(currentMessages.map(m => m.messageId));
      
      // Filtrar solo mensajes nuevos
      const newMessages = serverMessages.filter(msg => !currentMessageIds.has(msg.messageId));
      
      // Solo actualizar caché si hay mensajes nuevos
      if (newMessages.length > 0) {
        // Actualizar caché con mensajes del servidor
        await enhancedCacheService.setMessages(conversationId, serverMessages);
        
        // Actualizar mensajes en el estado
        setMessages(serverMessages);
        setLastSyncTime(new Date().toISOString());
        setIsLoaded(true);
        setSyncStatus('success');
        
        // Actualizar versión del caché
        const version = await enhancedCacheService.getConversationVersion(conversationId);
        setCacheVersion(version);
        
        console.log(`🔄 Hook: Sincronizados ${serverMessages.length} mensajes totales, ${newMessages.length} nuevos`);
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
      // Obtener mensajes actuales del caché
      const currentMessages = await enhancedCacheService.getMessages(conversationId);
      const currentMessageIds = new Set(currentMessages.map(m => m.messageId));
      
      // Filtrar solo mensajes nuevos
      const newMessages = serverMessages.filter(msg => !currentMessageIds.has(msg.messageId));
      
      if (newMessages.length > 0) {
        // Añadir cada mensaje nuevo al caché
        for (const message of newMessages) {
          await enhancedCacheService.addMessage(conversationId, message);
        }
        
        // Recargar mensajes desde caché para mantener consistencia
        const updatedMessages = await enhancedCacheService.getMessages(conversationId);
        setMessages(updatedMessages);
        setLastSyncTime(new Date().toISOString());
        setIsLoaded(true);
        setSyncStatus('success');
        
        // Actualizar versión del caché
        const version = await enhancedCacheService.getConversationVersion(conversationId);
        setCacheVersion(version);
        
        console.log(`🔄 Hook: Sincronizados ${newMessages.length} mensajes nuevos únicamente`);
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
        // Guardar en caché mejorado
        await enhancedCacheService.addMessage(conversationId, message);
        
        // Recargar mensajes desde caché para mantener consistencia
        const updatedMessages = await enhancedCacheService.getMessages(conversationId);
        setMessages(updatedMessages);
        
        // Actualizar versión del caché
        const version = await enhancedCacheService.getConversationVersion(conversationId);
        setCacheVersion(version);
        setIsLoaded(true);
        setSyncStatus('success');
        
        console.log(`➕ Hook: Añadido mensaje ${message.messageId} al caché mejorado`);
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
      await enhancedCacheService.clearConversation(conversationId);
      setMessages([]);
      setLastSyncTime(null);
      setIsLoaded(false);
      setCacheVersion(0);
      setSyncStatus('idle');
      setMetadata(null);
      console.log(`🗑️ Hook: Limpiado caché de conversación ${conversationId}`);
    } catch (error) {
      console.error('Error limpiando caché:', error);
    }
  }, [conversationId]);

  // Marcar conversación como cargada
  const markAsLoaded = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      // En el caché mejorado, esto se maneja automáticamente
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
      // En el caché mejorado, siempre intentamos cargar desde caché primero
      const cachedMessages = await enhancedCacheService.getMessages(conversationId);
      return cachedMessages.length === 0; // Necesita sync si no hay mensajes en caché
    } catch (error) {
      console.error('Error verificando necesidad de sincronización:', error);
      return true; // En caso de error, asumir que necesita sincronización
    }
  }, [conversationId]);

  // Actualizar metadata de la conversación
  const updateMetadata = useCallback(async (updates: any) => {
    if (!conversationId) return;
    
    try {
      await enhancedCacheService.updateConversationMetadata(conversationId, updates);
      
      // Actualizar metadata local
      const metadata = await enhancedCacheService.getConversationMetadata(conversationId);
      if (metadata) {
        setMetadata({
          accessCount: metadata.accessCount,
          priority: metadata.priority,
          lastAccessTime: metadata.lastAccessTime,
          unreadCount: metadata.unreadCount
        });
      }
      
      // Actualizar versión del caché
      const version = await enhancedCacheService.getConversationVersion(conversationId);
      setCacheVersion(version);
      
      console.log(`📝 Hook: Metadata actualizada para conversación ${conversationId}`);
    } catch (error) {
      console.error('Error actualizando metadata:', error);
    }
  }, [conversationId]);

  // Obtener estadísticas del caché
  const getCacheStats = useCallback(() => {
    try {
      return enhancedCacheService.getCacheStats();
    } catch (error) {
      console.error('Error obteniendo estadísticas del caché:', error);
      return null;
    }
  }, []);

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
      setMetadata(null);
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
    metadata,
    loadFromCache,
    syncWithServer,
    syncNewMessagesOnly,
    addMessage,
    clearCache,
    needsSync,
    markAsLoaded,
    updateMetadata,
    getCacheStats
  };
};
