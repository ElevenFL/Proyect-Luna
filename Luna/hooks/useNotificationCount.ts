import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import ApiService from '@/services/apiService';
import { socketService } from '@/services/socketService';

interface Notification {
  id: string;
  type: 'like' | 'match' | 'message' | 'visit' | 'friend_request';
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  timestamp: string;
  isRead: boolean;
  friendRequestId?: string;
}

export function useNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Función para cargar el contador de notificaciones
  const loadNotificationCount = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('🔔 Cargando contador de notificaciones...');
      
      // Cargar solicitudes de amistad del backend
      const friendRequestsResponse = await ApiService.get('/friend-requests/received');
      
      let count = 0;
      
      if (friendRequestsResponse.success && friendRequestsResponse.data?.friendRequests) {
        // Contar solo las solicitudes de amistad no leídas
        count = friendRequestsResponse.data.friendRequests.filter((request: any) => !request.isRead).length;
        console.log('🔔 Solicitudes de amistad no leídas:', count);
      }
      
      setUnreadCount(count);
      setLastUpdate(new Date());
      console.log('✅ Contador de notificaciones actualizado:', count);
      
    } catch (error) {
      console.error('❌ Error cargando contador de notificaciones:', error);
      // En caso de error, mantener el contador actual
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Función para incrementar el contador (cuando llega una nueva notificación)
  const incrementCount = useCallback(() => {
    setUnreadCount(prev => prev + 1);
    console.log('🔔 Contador incrementado:', unreadCount + 1);
  }, [unreadCount]);

  // Función para decrementar el contador (cuando se lee una notificación)
  const decrementCount = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1));
    console.log('🔔 Contador decrementado:', Math.max(0, unreadCount - 1));
  }, [unreadCount]);

  // Función para resetear el contador (cuando se marcan todas como leídas)
  const resetCount = useCallback(() => {
    setUnreadCount(0);
    console.log('🔔 Contador reseteado a 0');
  }, []);

  // Función para actualizar el contador cuando se lee una notificación específica
  const markAsRead = useCallback((notificationId: string) => {
    // Por ahora solo decrementamos, en el futuro podríamos ser más específicos
    decrementCount();
  }, [decrementCount]);

  // Cargar contador inicial
  useEffect(() => {
    loadNotificationCount();
  }, [loadNotificationCount]);

  // Listener para cuando la app vuelve al primer plano
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('🔔 App vuelve al primer plano, actualizando contador...');
        // Actualizar contador cuando la app vuelve al primer plano
        loadNotificationCount();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [loadNotificationCount]);

  // Listener para notificaciones en tiempo real por WebSocket
  useEffect(() => {
    const handleNotification = (notification: any) => {
      console.log('🔔 Notificación recibida por WebSocket:', notification);
      
      if (notification.type === 'friend_request' || notification.type === 'friend_request_accepted') {
        // Incrementar contador cuando llega una nueva notificación
        incrementCount();
      }
    };

    // Escuchar eventos de notificación del WebSocket usando el método correcto
    socketService.addNotificationListener(handleNotification);

    return () => {
      socketService.removeNotificationListener(handleNotification);
    };
  }, [incrementCount]);

  // Función para refrescar manualmente
  const refresh = useCallback(() => {
    loadNotificationCount();
  }, [loadNotificationCount]);

  return {
    unreadCount,
    isLoading,
    lastUpdate,
    incrementCount,
    decrementCount,
    resetCount,
    markAsRead,
    refresh
  };
}

export default useNotificationCount;
