import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import ApiService from './apiService';

/**
 * Servicio para gestionar Push Notifications en el frontend
 */
export class PushNotificationService {
  private static pushToken: string | null = null;

  /**
   * Registra el dispositivo para recibir push notifications
   */
  static async registerForPushNotifications(userId: string): Promise<string | null> {
    try {
      console.log('📱 Registrando push notifications para usuario:', userId);

      // Solicitar permisos
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Si no tiene permisos, solicitarlos
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // Si no se concedieron los permisos, retornar null
      if (finalStatus !== 'granted') {
        console.warn('⚠️ Permisos de notificación denegados');
        return null;
      }

      // Obtener el token de Expo Push
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '14e249c5-a3bb-4284-94ad-8d6d6b0d04f3', // ID del proyecto desde app.json
      });

      const token = tokenData.data;
      console.log('✅ Push token obtenido:', token);

      // Guardar el token localmente
      this.pushToken = token;

      // Registrar el token en el backend
      try {
        const response = await ApiService.post('/push-tokens/register', {
          userId,
          pushToken: token,
          platform: Platform.OS,
          deviceId: token, // Usar el token como deviceId por ahora
        });

        if (response.success) {
          console.log('✅ Push token registrado en el backend exitosamente');
        } else {
          console.error('❌ Error registrando push token en el backend:', response.message);
        }
      } catch (backendError) {
        console.error('❌ Error de red registrando push token:', backendError);
        // No lanzar error, el token local sigue siendo válido
      }

      return token;
    } catch (error) {
      console.error('❌ Error registrando push notifications:', error);
      return null;
    }
  }

  /**
   * Desregistra el dispositivo (útil al hacer logout)
   */
  static async unregisterPushToken(userId: string): Promise<boolean> {
    try {
      if (!this.pushToken) {
        console.log('⚠️ No hay push token para desregistrar');
        return false;
      }

      console.log('🗑️ Desregistrando push token para usuario:', userId);

      const response = await ApiService.post('/push-tokens/unregister', {
        userId,
        pushToken: this.pushToken,
      });

      if (response.success) {
        console.log('✅ Push token desregistrado exitosamente');
        this.pushToken = null;
        return true;
      } else {
        console.error('❌ Error desregistrando push token:', response.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error desregistrando push token:', error);
      return false;
    }
  }

  /**
   * Desactiva todos los tokens del usuario (útil al hacer logout completo)
   */
  static async unregisterAllUserTokens(): Promise<boolean> {
    try {
      console.log('🗑️ Desactivando todos los tokens del usuario');

      const response = await ApiService.delete('/push-tokens/all');

      if (response.success) {
        console.log('✅ Todos los tokens desactivados exitosamente');
        this.pushToken = null;
        return true;
      } else {
        console.error('❌ Error desactivando todos los tokens:', response.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error desactivando todos los tokens:', error);
      return false;
    }
  }

  /**
   * Obtiene el push token actual
   */
  static getPushToken(): string | null {
    return this.pushToken;
  }

  /**
   * Envía una notificación de prueba (solo en desarrollo)
   */
  static async sendTestNotification(): Promise<boolean> {
    try {
      if (__DEV__) {
        console.log('🧪 Enviando notificación de prueba');

        const response = await ApiService.post('/push-tokens/test', {
          title: 'Notificación de prueba',
          body: 'Esta es una notificación de prueba desde Luna',
          data: { type: 'test' },
        });

        if (response.success) {
          console.log('✅ Notificación de prueba enviada');
          return true;
        } else {
          console.error('❌ Error enviando notificación de prueba:', response.message);
          return false;
        }
      } else {
        console.warn('⚠️ Notificaciones de prueba solo disponibles en desarrollo');
        return false;
      }
    } catch (error) {
      console.error('❌ Error enviando notificación de prueba:', error);
      return false;
    }
  }

  /**
   * Configura listeners de notificaciones
   */
  static setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationTapped?: (response: Notifications.NotificationResponse) => void
  ) {
    // Listener cuando se recibe una notificación
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notificación recibida:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener cuando el usuario toca una notificación
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notificación tocada:', response);
      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });

    // Retornar función de cleanup
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }

  /**
   * Verifica si las notificaciones están habilitadas
   */
  static async areNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error verificando permisos de notificaciones:', error);
      return false;
    }
  }

  /**
   * Abre la configuración de notificaciones del sistema
   */
  static async openNotificationSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        // En iOS, abrir la configuración de la app
        await Notifications.openSettingsAsync();
      } else if (Platform.OS === 'android') {
        // En Android, abrir la configuración de la app
        await Notifications.openSettingsAsync();
      }
    } catch (error) {
      console.error('❌ Error abriendo configuración de notificaciones:', error);
    }
  }
}

export default PushNotificationService;

