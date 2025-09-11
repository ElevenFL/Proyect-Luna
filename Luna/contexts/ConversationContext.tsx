import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import backgroundSyncService from '@/services/backgroundSyncService';
import cacheService from '@/services/cacheService';
import ApiService from '@/services/apiService';
import { useAuth } from './AuthContext';
import optimizedChatService from '@/services/optimizedChatService';
import { useWebSocketManager } from '@/hooks/useWebSocketManager';
import { smartLog } from '@/config/logging';

interface ConversationContextType {
  conversations: any[];
  isLoading: boolean;
  refreshConversations: () => Promise<void>;
  markConversationActive: (conversationId: string, isActive: boolean) => void;
  addConversation: (conversationId: string, participants: string[]) => void;
  removeConversation: (conversationId: string) => void;
  getSyncStatus: () => any;
  getStats: () => any;
  getConnectionStatus: () => any;
  forceReconnectWebSocket: () => Promise<void>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Gestión centralizada de WebSocket para conversaciones
  const webSocketManager = useWebSocketManager({
    userId: user?.id || null,
    isAuthenticated: !!user && !!token,
    autoConnect: true,
    backgroundDisconnectDelay: 5 * 60 * 1000 // 5 minutos
  });

  useEffect(() => {
    if (user && token) {
      initializeConversationManager();
    } else {
      cleanupConversationManager();
    }

    // Listener para cambios en el estado de la app
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      // Note: cleanup will be called automatically when user/token change
    };
  }, [user, token]);

  // Listener para eventos de actualización de conversaciones
  useEffect(() => {
    const handleConversationUpdate = (data: { conversationId: string; messages: any[] }) => {
      const { conversationId, messages } = data;
      console.log(`📨 ConversationContext: Conversación ${conversationId} actualizada con ${messages.length} mensajes`);
      
      // Actualizar la lista de conversaciones si es necesario
      refreshConversations();
    };

    // Usar DeviceEventEmitter de React Native
    const subscription = DeviceEventEmitter.addListener('conversationUpdated', handleConversationUpdate);
    
    return () => {
      subscription.remove();
    };
  }, []);

  const initializeConversationManager = async () => {
    try {
      console.log('🚀 ConversationContext: Inicializando gestor de conversaciones');
      
      // Inicializar el servicio de sincronización en segundo plano
      await backgroundSyncService.initialize(user!.id);
      
      // Cargar conversaciones iniciales
      await refreshConversations();
      
      console.log('✅ ConversationContext: Gestor de conversaciones inicializado');
    } catch (error) {
      console.error('❌ ConversationContext: Error inicializando gestor:', error);
    }
  };

  const cleanupConversationManager = async () => {
    console.log('🧹 ConversationContext: Limpiando gestor de conversaciones');
    
    // Desconectar WebSocket
    try {
      await webSocketManager.disconnectWebSocket();
      smartLog.info('ConversationContext: WebSocket desconectado');
    } catch (wsError) {
      smartLog.error('ConversationContext: Error desconectando WebSocket:', wsError);
    }
    
    backgroundSyncService.stop();
    setConversations([]);
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log(`📱 ConversationContext: Cambio de estado de app: ${appState} -> ${nextAppState}`);
    setAppState(nextAppState);
    
    if (nextAppState === 'active' && user) {
      // App vuelve al primer plano - refrescar conversaciones
      refreshConversations();
    }
  };

  const refreshConversations = async () => {
    if (!user || !token) return;
    
    setIsLoading(true);
    try {
      console.log('🔄 ConversationContext: Refrescando conversaciones');
      
      // Obtener conversaciones del servidor usando servicio optimizado
      const response = await optimizedChatService.getConversations({ limit: 50 });
      const serverConversations = response?.items || [];
      
      // Actualizar estado local
      setConversations(serverConversations);
      
      // Asegurar que todas las conversaciones estén en el servicio de sincronización
      serverConversations.forEach((conv: any) => {
        // Debug: Log de datos recibidos para troubleshooting
        if (__DEV__) {
          console.log('🔍 ConversationContext: Datos de conversación recibidos:', {
            conversationId: conv.conversationId,
            participants: conv.participants,
            participantsType: typeof conv.participants,
            isArray: Array.isArray(conv.participants),
            hasLProperty: conv.participants && conv.participants.L
          });
        }
        
        // Validar y normalizar participants
        const participants = Array.isArray(conv.participants) ? conv.participants : [];
        if (!participants.length) {
          console.warn('⚠️ ConversationContext: Conversación sin participants válidos:', conv.conversationId, {
            participants: conv.participants,
            type: typeof conv.participants
          });
        }
        
        // Asegurar que la conversación tenga participants válidos antes de agregarla
        if (!conv.participants || !Array.isArray(conv.participants)) {
          conv.participants = participants;
        }
        
        backgroundSyncService.addConversation(conv.conversationId, participants);
      });
      
      console.log(`✅ ConversationContext: Refrescadas ${serverConversations.length} conversaciones`);
    } catch (error) {
      console.error('❌ ConversationContext: Error refrescando conversaciones:', error);
      
      // En caso de error, intentar cargar desde caché
      try {
        const cacheInfo = await cacheService.getCacheInfo();
        console.log('📱 ConversationContext: Intentando cargar desde caché:', cacheInfo);
      } catch (cacheError) {
        console.error('❌ ConversationContext: Error cargando desde caché:', cacheError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const markConversationActive = (conversationId: string, isActive: boolean) => {
    backgroundSyncService.setConversationActive(conversationId, isActive);
    console.log(`👁️ ConversationContext: Conversación ${conversationId} marcada como ${isActive ? 'activa' : 'inactiva'}`);
  };

  const addConversation = (conversationId: string, participants: string[]) => {
    backgroundSyncService.addConversation(conversationId, participants);
    console.log(`➕ ConversationContext: Añadida conversación ${conversationId} para sincronización`);
  };

  const removeConversation = (conversationId: string) => {
    backgroundSyncService.removeConversation(conversationId);
    console.log(`➖ ConversationContext: Removida conversación ${conversationId} de sincronización`);
  };

  const getSyncStatus = () => {
    return backgroundSyncService.getSyncStatus();
  };

  const getStats = () => {
    return backgroundSyncService.getStats();
  };

  const getConnectionStatus = () => {
    return webSocketManager.getConnectionStatus();
  };

  const forceReconnectWebSocket = async () => {
    await webSocketManager.connectWebSocket();
  };

  const value: ConversationContextType = {
    conversations,
    isLoading,
    refreshConversations,
    markConversationActive,
    addConversation,
    removeConversation,
    getSyncStatus,
    getStats,
    getConnectionStatus,
    forceReconnectWebSocket
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversations = () => {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversations debe ser usado dentro de un ConversationProvider');
  }
  return context;
};
