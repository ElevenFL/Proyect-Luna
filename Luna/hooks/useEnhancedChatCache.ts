import { useState, useEffect, useCallback } from 'react';
import enhancedCacheService from '@/services/enhancedCacheService';
import { ChatMessage } from '@/services/optimizedChatService';

interface UseEnhancedChatCacheOptions {
  conversationId: string | null;
  autoSync?: boolean;
  syncInterval?: number; // en milisegundos
}

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

interface UseEnhancedChatCacheReturn {
  messages: ChatMessage[];
  metadata: ConversationMetadata | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  isLoaded: boolean;
  cacheVersion: number;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  isPreloading: boolean;
  
  // Métodos principales
  loadFromCache: () => Promise<void>;
  syncWithServer: (serverMessages: ChatMessage[]) => Promise<void>;
  addMessage: (message: ChatMessage) => Promise<void>;
  clearCache: () => Promise<void>;
  needsSync: () => Promise<boolean>;
  
  // Gestión de metadata
  updateMetadata: (updates: Partial<ConversationMetadata>) => Promise<void>;
  updateUnreadCount: (count: number) => Promise<void>;
  updateUserInfo: (userInfo: ConversationMetadata['otherUserInfo']) => Promise<void>;
  
  // Utilidades
  getCacheStats: () => any;
  markAsAccessed: () => Promise<void>;
  setPriority: (priority: 'high' | 'medium' | 'low') => Promise<void>;
}

/**
 * Hook mejorado para manejar el caché de conversaciones con el nuevo sistema
 * Proporciona una interfaz optimizada para cargar y sincronizar mensajes con metadata
 */
export const useEnhancedChatCache = ({ 
  conversationId, 
  autoSync = true, 
  syncInterval = 30000 // 30 segundos por defecto
}: UseEnhancedChatCacheOptions): UseEnhancedChatCacheReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [metadata, setMetadata] = useState<ConversationMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const [isPreloading, setIsPreloading] = useState(false);

  // Cargar mensajes y metadata desde caché
  const loadFromCache = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      // Obtener mensajes desde el caché mejorado
      const cachedMessages = await enhancedCacheService.getMessages(conversationId);
      
      // Solo mostrar precarga si no hay mensajes en caché
      if (cachedMessages.length === 0) {
        setIsPreloading(true);
      }
      
      // Obtener metadata de la conversación
      const conversationMetadata = await enhancedCacheService.getConversationMetadata(conversationId);
      
      // Establecer mensajes inmediatamente para evitar parpadeos
      setMessages(cachedMessages);
      setIsLoaded(cachedMessages.length > 0);
      setCacheVersion(conversationMetadata?.version || 0);
      setSyncStatus('success');
      setMetadata(conversationMetadata);
      
      // Solo mostrar log si hay mensajes o si es la primera carga
      if (cachedMessages.length > 0) {
        console.log(`📱 EnhancedHook: Cargados ${cachedMessages.length} mensajes desde caché mejorado (v${conversationMetadata?.version || 0})`);
      } else {
        console.log(`📱 EnhancedHook: No hay mensajes en caché para ${conversationId}`);
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
        const updatedMetadata = await enhancedCacheService.getConversationMetadata(conversationId);
        setCacheVersion(updatedMetadata?.version || 0);
        setMetadata(updatedMetadata);
        
        console.log(`🔄 EnhancedHook: Sincronizados ${serverMessages.length} mensajes totales, ${newMessages.length} nuevos`);
      } else {
        // No hay mensajes nuevos, solo marcar como sincronizado
        setLastSyncTime(new Date().toISOString());
        setIsLoaded(true);
        setSyncStatus('success');
        
        console.log(`✅ EnhancedHook: No hay mensajes nuevos, caché ya está actualizado`);
      }
    } catch (error) {
      console.error('Error sincronizando con servidor:', error);
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
        const updatedMetadata = await enhancedCacheService.getConversationMetadata(conversationId);
        setCacheVersion(updatedMetadata?.version || 0);
        setMetadata(updatedMetadata);
        setIsLoaded(true);
        setSyncStatus('success');
        
        console.log(`➕ EnhancedHook: Añadido mensaje ${message.messageId} al caché mejorado`);
      } else {
        console.log(`ℹ️ EnhancedHook: Mensaje ${message.messageId} ya existe, ignorando`);
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
      console.log(`🗑️ EnhancedHook: Limpiado caché de conversación ${conversationId}`);
    } catch (error) {
      console.error('Error limpiando caché:', error);
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
  const updateMetadata = useCallback(async (updates: Partial<ConversationMetadata>) => {
    if (!conversationId) return;
    
    try {
      await enhancedCacheService.updateConversationMetadata(conversationId, updates);
      
      // Actualizar metadata local
      const updatedMetadata = await enhancedCacheService.getConversationMetadata(conversationId);
      setMetadata(updatedMetadata);
      
      console.log(`📝 EnhancedHook: Metadata actualizada para conversación ${conversationId}`);
    } catch (error) {
      console.error('Error actualizando metadata:', error);
    }
  }, [conversationId]);

  // Actualizar contador de mensajes no leídos
  const updateUnreadCount = useCallback(async (count: number) => {
    await updateMetadata({ unreadCount: count });
  }, [updateMetadata]);

  // Actualizar información del usuario
  const updateUserInfo = useCallback(async (userInfo: ConversationMetadata['otherUserInfo']) => {
    await updateMetadata({ otherUserInfo: userInfo });
  }, [updateMetadata]);

  // Obtener estadísticas del caché
  const getCacheStats = useCallback(() => {
    try {
      return enhancedCacheService.getCacheStats();
    } catch (error) {
      console.error('Error obteniendo estadísticas del caché:', error);
      return null;
    }
  }, []);

  // Marcar conversación como accedida
  const markAsAccessed = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const currentMetadata = await enhancedCacheService.getConversationMetadata(conversationId);
      if (currentMetadata) {
        await updateMetadata({
          lastAccessTime: Date.now(),
          accessCount: currentMetadata.accessCount + 1
        });
      }
    } catch (error) {
      console.error('Error marcando como accedida:', error);
    }
  }, [conversationId, updateMetadata]);

  // Establecer prioridad de la conversación
  const setPriority = useCallback(async (priority: 'high' | 'medium' | 'low') => {
    await updateMetadata({ priority });
  }, [updateMetadata]);

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
        console.log('🔄 EnhancedHook: Auto-sincronización detectada como necesaria');
        // Nota: La sincronización real debe ser manejada por el componente padre
        // ya que requiere llamadas al servidor
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [autoSync, conversationId, syncInterval, needsSync]);

  return {
    messages,
    metadata,
    isLoading,
    isSyncing,
    lastSyncTime,
    isLoaded,
    cacheVersion,
    syncStatus,
    isPreloading,
    loadFromCache,
    syncWithServer,
    addMessage,
    clearCache,
    needsSync,
    updateMetadata,
    updateUnreadCount,
    updateUserInfo,
    getCacheStats,
    markAsAccessed,
    setPriority
  };
};
