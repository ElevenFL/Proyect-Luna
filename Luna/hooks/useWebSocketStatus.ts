import { useState, useEffect } from 'react';
import { socketService } from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';

interface WebSocketStatus {
  isConnected: boolean;
  userId: string | null;
  socketId: string | null;
  isAuthenticated: boolean;
}

export const useWebSocketStatus = (): WebSocketStatus => {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<WebSocketStatus>(() => {
    const connectionStatus = socketService.getConnectionStatus();
    return {
      ...connectionStatus,
      isAuthenticated: !!(user && token)
    };
  });

  useEffect(() => {
    // Listener para cambios en el estado de conexión
    const handleConnectionChange = (isConnected: boolean) => {
      const connectionStatus = socketService.getConnectionStatus();
      setStatus({
        ...connectionStatus,
        isAuthenticated: !!(user && token)
      });
    };

    socketService.addConnectionStateListener(handleConnectionChange);

    // Actualizar estado inicial
    const connectionStatus = socketService.getConnectionStatus();
    setStatus({
      ...connectionStatus,
      isAuthenticated: !!(user && token)
    });

    return () => {
      socketService.removeConnectionStateListener(handleConnectionChange);
    };
  }, [user, token]);

  return status;
};
