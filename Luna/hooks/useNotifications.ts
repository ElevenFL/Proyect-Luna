import { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { socketService } from '@/services/socketService';
import { ChatMessage } from '@/services/optimizedChatService';

// Configurar el comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
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
    isAppInForeground: boolean = true
  ) => {
    // No mostrar notificación si el usuario está activamente en esa conversación
    if (isInActiveConversation && isAppInForeground) {
      return;
    }

    // Vibrar para todos los mensajes nuevos
    vibrate();

    if (isAppInForeground) {
      // App en primer plano - mostrar notificación in-app
      showInAppNotification(message, senderName);
    } else {
      // App en segundo plano - mostrar notificación push
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

  // Configurar listener para respuesta a notificaciones
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data.type === 'new-message' && data.conversationId) {
        // Aquí se podría navegar automáticamente al chat
        console.log('📱 Notificación de mensaje tocada:', data);
      }
    });

    return () => subscription.remove();
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
