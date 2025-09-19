import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import readStatusBatchService from '@/services/readStatusBatchService';

/**
 * Hook personalizado para manejar la sincronización del estado de lectura de mensajes
 * Proporciona funciones para sincronizar manualmente y estadísticas del servicio
 */
export const useReadStatusSync = () => {
  // Sincronizar cola de mensajes leídos manualmente
  const syncReadStatusQueue = useCallback(async () => {
    try {
      await readStatusBatchService.syncBatchQueue();
      console.log('✅ useReadStatusSync: Cola sincronizada manualmente');
    } catch (error) {
      console.error('❌ useReadStatusSync: Error sincronizando cola:', error);
      throw error;
    }
  }, []);

  // Sincronizar elementos fallidos manualmente
  const syncFailedItems = useCallback(async () => {
    try {
      await readStatusBatchService.syncFailedItems();
      console.log('✅ useReadStatusSync: Elementos fallidos sincronizados manualmente');
    } catch (error) {
      console.error('❌ useReadStatusSync: Error sincronizando elementos fallidos:', error);
      throw error;
    }
  }, []);

  // Obtener estadísticas del servicio
  const getReadStatusStats = useCallback(() => {
    return readStatusBatchService.getStats();
  }, []);

  // Verificar si un mensaje está marcado como leído
  const isMessageRead = useCallback((conversationId: string, messageId: string) => {
    return readStatusBatchService.isMessageRead(conversationId, messageId);
  }, []);

  // Obtener mensajes leídos de una conversación
  const getReadMessages = useCallback((conversationId: string) => {
    return readStatusBatchService.getReadMessages(conversationId);
  }, []);

  // Limpiar caché (útil para testing o reset)
  const clearReadStatusCache = useCallback(async () => {
    try {
      await readStatusBatchService.clearCache();
      console.log('✅ useReadStatusSync: Caché limpiado');
    } catch (error) {
      console.error('❌ useReadStatusSync: Error limpiando caché:', error);
      throw error;
    }
  }, []);

  // Sincronizar automáticamente cuando la app vuelve al primer plano
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Sincronizar cola cuando la app vuelve al primer plano
        syncReadStatusQueue().catch(error => {
          console.error('❌ useReadStatusSync: Error en sincronización automática:', error);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [syncReadStatusQueue]);

  return {
    syncReadStatusQueue,
    syncFailedItems,
    getReadStatusStats,
    isMessageRead,
    getReadMessages,
    clearReadStatusCache
  };
};

export default useReadStatusSync;
