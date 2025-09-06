import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import backgroundSyncService from '@/services/backgroundSyncService';
import cacheService from '@/services/cacheService';
import ApiService from '@/services/apiService';
import { useAuth } from './AuthContext';
import { Conversation } from '@/services/chatService';

interface ConversationContextType {
  conversations: Conversation[];
  isLoading: boolean;
  refreshConversations: () => Promise<void>;
  markConversationActive: (conversationId: string, isActive: boolean) => void;
  addConversation: (conversationId: string, participants: string[]) => void;
  removeConversation: (conversationId: string) => void;
  getSyncStatus: () => any;
  getStats: () => any;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const ConversationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

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
      cleanupConversationManager();
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

  const cleanupConversationManager = () => {
    console.log('🧹 ConversationContext: Limpiando gestor de conversaciones');
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
      
      // Obtener conversaciones del servidor
      const response = await ApiService.listConversations({ limit: 50 });
      const serverConversations = response.data?.items || [];
      
      // Actualizar estado local
      setConversations(serverConversations);
      
      // Asegurar que todas las conversaciones estén en el servicio de sincronización
      serverConversations.forEach((conv: Conversation) => {
        backgroundSyncService.addConversation(conv.conversationId, conv.participants || []);
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

  const value: ConversationContextType = {
    conversations,
    isLoading,
    refreshConversations,
    markConversationActive,
    addConversation,
    removeConversation,
    getSyncStatus,
    getStats
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
