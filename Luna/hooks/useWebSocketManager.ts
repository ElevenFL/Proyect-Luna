import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { socketService } from '../services/socketService';
import { smartLog } from '../config/logging';
import ApiService from '../services/apiService';

interface UseWebSocketManagerOptions {
  userId: string | null;
  isAuthenticated: boolean;
  autoConnect?: boolean;
  backgroundDisconnectDelay?: number; // en milisegundos, por defecto 5 minutos
}

export const useWebSocketManager = ({
  userId,
  isAuthenticated,
  autoConnect = true,
  backgroundDisconnectDelay = 5 * 60 * 1000 // 5 minutos por defecto
}: UseWebSocketManagerOptions) => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundTimer = useRef<number | null>(null);
  const isConnectingRef = useRef(false);
  const lastConnectionAttempt = useRef(0);
  const connectionThrottleDelay = 1000; // Reducido a 1 segundo para mejor UX

  // Función para actualizar el estado de conexión en DynamoDB
  const updateConnectionStatus = useCallback(async (isOnline: boolean) => {
    if (!userId || !isAuthenticated) {
      return;
    }

    try {
      // Verificar la salud del backend antes de intentar actualizar
      try {
        const healthCheck = await ApiService.checkBackendHealth();
        if (!healthCheck.isHealthy) {
          // Solo loggear como info, no como warning, ya que es un comportamiento esperado
          smartLog.info('useWebSocketManager: Backend no disponible, saltando actualización de estado de conexión');
          return;
        }
      } catch (healthError) {
        // Solo loggear como info, no como warning
        smartLog.info('useWebSocketManager: Error verificando salud del backend, saltando actualización de estado de conexión');
        return;
      }

      smartLog.info(`useWebSocketManager: Actualizando estado de conexión a ${isOnline ? 'online' : 'offline'} para usuario ${userId}`);
      
      const lastConnection = isOnline ? new Date().toISOString() : undefined;
      await ApiService.updateConnectionStatus(isOnline, lastConnection);
      
      smartLog.info(`useWebSocketManager: Estado de conexión actualizado exitosamente en DynamoDB`);
    } catch (error) {
      smartLog.error('useWebSocketManager: Error actualizando estado de conexión en DynamoDB:', error);
      
      // Verificar si es un error de conexión al backend
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
          smartLog.warn('useWebSocketManager: Backend no disponible, continuando sin actualizar estado de conexión');
        } else if (error.message.includes('SERVER_ERROR') || error.message.includes('500')) {
          smartLog.warn('useWebSocketManager: Error del servidor backend, continuando sin actualizar estado de conexión');
        } else {
          smartLog.warn('useWebSocketManager: Error desconocido, continuando sin actualizar estado de conexión');
        }
      }
      
      // No lanzar el error para no interrumpir el flujo de WebSocket
    }
  }, [userId, isAuthenticated]);

  // Función para conectar WebSocket
  const connectWebSocket = useCallback(async () => {
    if (!userId || !isAuthenticated || isConnectingRef.current) {
      return;
    }

    // Verificar que socketService esté disponible
    if (!socketService) {
      smartLog.error('useWebSocketManager: socketService no está disponible');
      return;
    }

    // Throttling para evitar conexiones muy frecuentes
    const now = Date.now();
    if (now - lastConnectionAttempt.current < connectionThrottleDelay) {
      smartLog.info('useWebSocketManager: Conexión throttled, esperando...');
      return;
    }

    lastConnectionAttempt.current = now;
    isConnectingRef.current = true;

    let maxRetries = 5; // Aumentado a 5 intentos
    let retryCount = 0;
    let connected = false;
    let lastError = null;

    // Resetear estados antes de intentar conectar
    socketService.resetCircuitBreaker();
    socketService.resetConnectionLock();

    while (!connected && retryCount < maxRetries) {
      try {
        smartLog.info(`useWebSocketManager: Conectando WebSocket... (intento ${retryCount + 1}/${maxRetries})`);
        
        // Verificar que socketService tenga el método connect
        if (typeof socketService.connect !== 'function') {
          throw new Error('socketService.connect no es una función');
        }
        
        // Intentar conectar con timeout
        const connectPromise = socketService.connect(userId);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout de conexión')), 30000);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        smartLog.info('useWebSocketManager: WebSocket conectado exitosamente');
        connected = true;
        
        // Actualizar estado de conexión en DynamoDB
        await updateConnectionStatus(true);
      } catch (error) {
        retryCount++;
        
        // Guardar el último error para análisis
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Resetear estados si es necesario
        if (errorMessage.includes('Circuit breaker abierto') || errorMessage.includes('Conexión bloqueada')) {
          smartLog.warn('useWebSocketManager: Reseteando estados de conexión...');
          socketService.resetCircuitBreaker();
          socketService.resetConnectionLock();
          
          // Esperar un poco más en estos casos
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        // Verificar la salud del backend antes de reintentar
        try {
          const healthCheck = await ApiService.checkBackendHealth();
          if (!healthCheck.isHealthy) {
            smartLog.warn('useWebSocketManager: Backend no saludable, esperando más tiempo...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (healthError) {
          smartLog.warn('useWebSocketManager: No se pudo verificar salud del backend');
        }
        
        smartLog.error(`useWebSocketManager: Error conectando WebSocket (intento ${retryCount}/${maxRetries}):`, error);
        
        // Backoff exponencial con jitter para evitar reconexiones sincronizadas
        if (retryCount < maxRetries) {
          const baseDelay = Math.min(1000 * Math.pow(1.5, retryCount), 3000);
          const jitter = Math.random() * 1000;
          const delay = baseDelay + jitter;
          
          smartLog.info(`useWebSocketManager: Esperando ${Math.round(delay)}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!connected) {
      smartLog.error('useWebSocketManager: No se pudo conectar WebSocket después de todos los intentos', { lastError });
      
      // Limpiar estados
      socketService.resetCircuitBreaker();
      socketService.resetConnectionLock();
      
      // Notificar al backend del estado offline
      try {
        await updateConnectionStatus(false);
      } catch (updateError) {
        smartLog.error('useWebSocketManager: Error actualizando estado offline:', updateError);
      }
    }

    // Asegurar que el estado de conexión se resetee
    isConnectingRef.current = false;
    lastConnectionAttempt.current = connected ? Date.now() : 0;
  }, [userId, isAuthenticated, updateConnectionStatus]);

  // Función para desconectar WebSocket
  const disconnectWebSocket = useCallback(async () => {
    try {
      smartLog.info('useWebSocketManager: Desconectando WebSocket...');
      socketService.disconnect();
      smartLog.info('useWebSocketManager: WebSocket desconectado');
      
      // Actualizar estado de conexión en DynamoDB
      await updateConnectionStatus(false);
    } catch (error) {
      smartLog.error('useWebSocketManager: Error desconectando WebSocket:', error);
    }
  }, [updateConnectionStatus]);

  // Función para limpiar el timer de segundo plano
  const clearBackgroundTimer = useCallback(() => {
    if (backgroundTimer.current) {
      clearTimeout(backgroundTimer.current);
      backgroundTimer.current = null;
      smartLog.info('useWebSocketManager: Timer de segundo plano limpiado');
    }
  }, []);

  // Función para iniciar el timer de desconexión en segundo plano
  const startBackgroundTimer = useCallback(() => {
    clearBackgroundTimer();
    
    backgroundTimer.current = setTimeout(async () => {
      smartLog.info('useWebSocketManager: Timer de segundo plano expirado, desconectando WebSocket...');
      await disconnectWebSocket();
    }, backgroundDisconnectDelay);

    smartLog.info(`useWebSocketManager: Timer de desconexión iniciado (${backgroundDisconnectDelay / 1000}s)`);
  }, [backgroundDisconnectDelay, disconnectWebSocket, clearBackgroundTimer]);

  // Manejar cambios en el estado de la aplicación
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    smartLog.info(`useWebSocketManager: Cambio de estado: ${appState.current} -> ${nextAppState}`);

    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App vuelve al primer plano
      smartLog.info('useWebSocketManager: App vuelve al primer plano');
      clearBackgroundTimer();
      
      if (autoConnect && isAuthenticated && userId) {
        // Pequeño delay para evitar reconexiones muy rápidas
        setTimeout(() => {
          if (isAuthenticated && userId) {
            connectWebSocket().catch(error => {
              smartLog.error('useWebSocketManager: Error reconectando al volver al primer plano:', error);
            });
          }
        }, 1000);
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App pasa a segundo plano
      smartLog.info('useWebSocketManager: App pasa a segundo plano');
      
      if (autoConnect && isAuthenticated) {
        // Iniciar timer para desconectar después del delay
        startBackgroundTimer();
      } else {
        // Si no hay auto-connect, desconectar inmediatamente
        setTimeout(() => {
          disconnectWebSocket().catch(error => {
            smartLog.error('useWebSocketManager: Error desconectando en segundo plano:', error);
          });
        }, 500); // Pequeño delay para evitar interrupciones bruscas
      }
    }

    appState.current = nextAppState;
  }, [autoConnect, isAuthenticated, userId, connectWebSocket, disconnectWebSocket, startBackgroundTimer, clearBackgroundTimer]);

  // Efecto principal para manejar el estado de la aplicación
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
      clearBackgroundTimer();
    };
  }, [handleAppStateChange, clearBackgroundTimer]);

  // Efecto para conectar automáticamente cuando el usuario se autentica
  useEffect(() => {
    if (autoConnect && isAuthenticated && userId && appState.current === 'active') {
      smartLog.info('useWebSocketManager: Usuario autenticado, conectando WebSocket...');
      connectWebSocket();
    } else if (!isAuthenticated) {
      smartLog.info('useWebSocketManager: Usuario no autenticado, desconectando WebSocket...');
      disconnectWebSocket();
    }
  }, [autoConnect, isAuthenticated, userId, connectWebSocket, disconnectWebSocket]);

  // Efecto de limpieza al desmontar
  useEffect(() => {
    return () => {
      clearBackgroundTimer();
    };
  }, [clearBackgroundTimer]);

  // Funciones públicas para control manual
  const forceConnect = useCallback(async () => {
    if (isAuthenticated && userId) {
      await connectWebSocket();
    }
  }, [isAuthenticated, userId, connectWebSocket]);

  const forceDisconnect = useCallback(async () => {
    clearBackgroundTimer();
    await disconnectWebSocket();
  }, [clearBackgroundTimer, disconnectWebSocket]);

  // Obtener estado de conexión
  const getConnectionStatus = useCallback(() => {
    return socketService.getConnectionStatus();
  }, []);

  // Obtener estado detallado para debugging
  const getDetailedStatus = useCallback(() => {
    return socketService.getDetailedStatus();
  }, []);

  // Función para resetear el circuit breaker manualmente
  const resetCircuitBreaker = useCallback(() => {
    smartLog.info('useWebSocketManager: Reseteando circuit breaker manualmente');
    socketService.resetCircuitBreaker();
  }, []);

  // Función para resetear el connectionLock manualmente
  const resetConnectionLock = useCallback(() => {
    smartLog.info('useWebSocketManager: Reseteando connectionLock manualmente');
    socketService.resetConnectionLock();
  }, []);

  return {
    connectWebSocket: forceConnect,
    disconnectWebSocket: forceDisconnect,
    getConnectionStatus,
    getDetailedStatus,
    resetCircuitBreaker,
    resetConnectionLock,
    isConnecting: isConnectingRef.current
  };
};
