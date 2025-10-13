import { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { socketService } from '@/services/socketService';
import { ChatMessage } from '@/services/optimizedChatService';

// Configuración del comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationConfig {
  enableInAppNotifications: boolean;
  enablePushNotifications: boolean;
  enableSoundNotifications: boolean;
  enableVibration: boolean;
}

export function useNotifications(config: NotificationConfig = {
  enableInAppNotifications: true,
  enablePushNotifications: true,
  enableSoundNotifications: true,
  enableVibration: true
}) {
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [inAppNotifications, setInAppNotifications] = useState<{ id: string; message: ChatMessage; timestamp: number }[]>([]);

  // Solicitar permisos de notificación
  const requestNotificationPermissions = useCallback(async () => {
    if (!config.enablePushNotifications) {
      return 'denied';
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      setNotificationPermission(finalStatus);
      return finalStatus;
    } catch (error) {
      console.error('Error solicitando permisos de notificación:', error);
      return 'denied';
    }
  }, [config.enablePushNotifications]);

  // Mostrar notificación local
  const showLocalNotification = useCallback(async (message: ChatMessage, senderName?: string) => {
    if (!config.enablePushNotifications || notificationPermission !== 'granted') {
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: senderName || 'Nuevo mensaje',
          body: message.content.length > 100 
            ? `${message.content.substring(0, 100)}...` 
            : message.content,
          sound: config.enableSoundNotifications ? 'default' : false,
          data: {
            messageId: message.messageId,
            conversationId: message.conversationId,
            senderId: message.senderId,
            type: 'new-message'
          },
        },
        trigger: null, // Mostrar inmediatamente
      });
    } catch (error) {
      console.error('Error mostrando notificación local:', error);
    }
  }, [config.enablePushNotifications, config.enableSoundNotifications, notificationPermission]);

  // Mostrar notificación in-app
  const showInAppNotification = useCallback((message: ChatMessage, senderName?: string) => {
    if (!config.enableInAppNotifications) {
      return;
    }

    const notificationId = `${Date.now()}-${message.messageId}`;
    const notification = {
      id: notificationId,
      message,
      timestamp: Date.now(),
      senderName
    };

    setInAppNotifications(prev => [notification, ...prev.slice(0, 4)]); // Mantener máximo 5 notificaciones

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      setInAppNotifications(prev => prev.filter(n => n.id !== notificationId));
    }, 5000);
  }, [config.enableInAppNotifications]);

  // Vibrar dispositivo
  const vibrate = useCallback(() => {
    if (config.enableVibration) {
      if (Platform.OS === 'ios') {
        // iOS - usar HapticFeedback si está disponible
        try {
          const Haptics = require('expo-haptics');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.log('Haptic feedback no disponible');
        }
      } else {
        // Android - usar vibración
        try {
          const { Vibration } = require('react-native');
          Vibration.vibrate(200);
        } catch (error) {
          console.log('Vibración no disponible');
        }
      }
    }
  }, [config.enableVibration]);

  // Manejar nuevo mensaje y mostrar notificación apropiada
  const handleNewMessageNotification = useCallback(async (
    message: ChatMessage, 
    senderName?: string,
    isInActiveConversation: boolean = false,
    isAppInForeground: boolean = true,
    currentChatId?: string | null
  ) => {
    console.log('🔔 useNotifications: Procesando notificación de mensaje:', {
      messageId: message.messageId,
      conversationId: message.conversationId,
      isInActiveConversation,
      isAppInForeground,
      currentChatId,
      senderName
    });

    // No mostrar notificación si el usuario está activamente en esa conversación específica
    if (isInActiveConversation && isAppInForeground && currentChatId === message.conversationId) {
      console.log('🔔 useNotifications: Usuario está en la conversación activa, omitiendo notificación');
      return;
    }

    // No mostrar notificación si el mensaje es del propio usuario
    if (message.senderId === message.receiverId) {
      console.log('🔔 useNotifications: Mensaje del propio usuario, omitiendo notificación');
      return;
    }

    // Vibrar para todos los mensajes nuevos (excepto si está en la conversación activa)
    if (!(isInActiveConversation && currentChatId === message.conversationId)) {
      vibrate();
    }

    if (isAppInForeground) {
      // App en primer plano - mostrar notificación in-app
      console.log('🔔 useNotifications: Mostrando notificación in-app');
      showInAppNotification(message, senderName);
    } else {
      // App en segundo plano - mostrar notificación push
      console.log('🔔 useNotifications: Mostrando notificación push');
      await showLocalNotification(message, senderName);
    }
  }, [vibrate, showInAppNotification, showLocalNotification]);

  // Remover notificación in-app específica
  const removeInAppNotification = useCallback((id: string) => {
    setInAppNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Limpiar todas las notificaciones in-app
  const clearAllInAppNotifications = useCallback(() => {
    setInAppNotifications([]);
  }, []);

  // Configurar listener para notificaciones remotas (cuando llegan)
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
      console.log('📬 Notificación remota recibida:', notification);
      
      const data = notification.request.content.data as any;
      
      // Manejar notificación según su tipo
      if (data.type === 'new-message' && data.conversationId) {
        console.log('📨 Notificación de nuevo mensaje:', data);
        // La notificación ya se mostrará automáticamente por el sistema
        // Aquí podrías actualizar el estado de la app si es necesario
      } else if (data.type === 'friend_request') {
        console.log('👥 Notificación de solicitud de amistad:', data);
      } else if (data.type === 'friend_request_accepted') {
        console.log('✅ Notificación de solicitud aceptada:', data);
      }
    });

    return () => receivedSubscription.remove();
  }, []);

  // Configurar listener para respuesta a notificaciones (cuando se tocan)
  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as any;
      
      console.log('👆 Notificación tocada:', data);
      
      // Navegar según el tipo de notificación
      if (data.type === 'new-message' && data.conversationId) {
        console.log('📱 Navegando a chat:', data.conversationId);
        // Aquí se podría usar el router para navegar
        // router.push({ pathname: '/chat/[userId]', params: { userId: data.senderId } });
      } else if (data.type === 'friend_request') {
        console.log('📱 Navegando a notificaciones');
        // router.push('/(tabs)/notifications');
      } else if (data.type === 'friend_request_accepted') {
        console.log('📱 Navegando a perfil del usuario:', data.accepterId);
        // router.push({ pathname: '/user-profile', params: { userId: data.accepterId } });
      }
    });

    return () => responseSubscription.remove();
  }, []);

  // Inicializar permisos
  useEffect(() => {
    requestNotificationPermissions();
  }, [requestNotificationPermissions]);

  return {
    // Estado
    notificationPermission,
    inAppNotifications,
    
    // Funciones
    requestNotificationPermissions,
    showLocalNotification,
    showInAppNotification,
    handleNewMessageNotification,
    removeInAppNotification,
    clearAllInAppNotifications,
    vibrate,
    
    // Configuración
    config
  };
}

export default useNotifications;
