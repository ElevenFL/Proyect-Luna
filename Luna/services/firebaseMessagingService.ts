import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import ApiService from './apiService';

/**
 * Servicio para gestionar Firebase Cloud Messaging (FCM)
 */
export class FirebaseMessagingService {
  private static fcmToken: string | null = null;

  /**
   * Inicializa Firebase Cloud Messaging
   */
  static async initialize(): Promise<void> {
    try {
      console.log('🔥 Inicializando Firebase Cloud Messaging...');

      // Solicitar permisos de notificación
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Permisos de notificación concedidos');
        await this.getFCMToken();
        this.setupMessageHandlers();
      } else {
        console.warn('⚠️ Permisos de notificación denegados');
      }
    } catch (error) {
      console.error('❌ Error inicializando FCM:', error);
    }
  }

  /**
   * Obtiene el token de FCM
   */
  static async getFCMToken(): Promise<string | null> {
    try {
      console.log('🔑 Obteniendo token de FCM...');
      
      const token = await messaging().getToken();
      console.log('✅ Token FCM obtenido:', token);
      
      this.fcmToken = token;
      return token;
    } catch (error) {
      console.error('❌ Error obteniendo token FCM:', error);
      return null;
    }
  }

  /**
   * Registra el token FCM en el backend
   */
  static async registerTokenInBackend(userId: string): Promise<boolean> {
    try {
      if (!this.fcmToken) {
        console.warn('⚠️ No hay token FCM para registrar');
        return false;
      }

      console.log('📤 Registrando token FCM en el backend para usuario:', userId);

      const response = await ApiService.post('/push-tokens/register', {
        userId,
        pushToken: this.fcmToken,
        platform: Platform.OS,
        deviceId: this.fcmToken,
        tokenType: 'fcm' // Indicar que es un token FCM
      });

      if (response.success) {
        console.log('✅ Token FCM registrado en el backend exitosamente');
        return true;
      } else {
        console.error('❌ Error registrando token FCM en el backend:', response.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error de red registrando token FCM:', error);
      return false;
    }
  }

  /**
   * Configura los manejadores de mensajes FCM
   */
  private static setupMessageHandlers(): void {
    // Manejar mensajes cuando la app está en primer plano
    messaging().onMessage(async remoteMessage => {
      console.log('📬 Mensaje FCM recibido en primer plano:', remoteMessage);
      
      // Aquí puedes mostrar una notificación local o actualizar la UI
      // Por ejemplo, mostrar un toast o actualizar un contador
    });

    // Manejar cuando el usuario toca una notificación
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('👆 Notificación FCM tocada:', remoteMessage);
      
      // Navegar a la pantalla correspondiente basada en los datos
      this.handleNotificationNavigation(remoteMessage);
    });

    // Verificar si la app fue abierta por una notificación
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('🚀 App abierta por notificación FCM:', remoteMessage);
          this.handleNotificationNavigation(remoteMessage);
        }
      });
  }

  /**
   * Maneja la navegación basada en los datos de la notificación
   */
  private static handleNotificationNavigation(remoteMessage: any): void {
    try {
      const data = remoteMessage.data;
      
      if (data?.type === 'chat') {
        // Navegar al chat
        console.log('💬 Navegando al chat:', data.userId);
        // Aquí implementarías la navegación usando tu router
      } else if (data?.type === 'story') {
        // Navegar a las historias
        console.log('📖 Navegando a las historias');
      } else if (data?.type === 'friend_request') {
        // Navegar a solicitudes de amistad
        console.log('👥 Navegando a solicitudes de amistad');
      }
    } catch (error) {
      console.error('❌ Error manejando navegación de notificación:', error);
    }
  }

  /**
   * Desregistra el token FCM
   */
  static async unregisterToken(userId: string): Promise<boolean> {
    try {
      if (!this.fcmToken) {
        console.log('⚠️ No hay token FCM para desregistrar');
        return false;
      }

      console.log('🗑️ Desregistrando token FCM para usuario:', userId);

      const response = await ApiService.post('/push-tokens/unregister', {
        userId,
        pushToken: this.fcmToken,
      });

      if (response.success) {
        console.log('✅ Token FCM desregistrado exitosamente');
        this.fcmToken = null;
        return true;
      } else {
        console.error('❌ Error desregistrando token FCM:', response.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error desregistrando token FCM:', error);
      return false;
    }
  }

  /**
   * Obtiene el token FCM actual
   */
  static getCurrentToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Suscribe a un tema FCM
   */
  static async subscribeToTopic(topic: string): Promise<boolean> {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`✅ Suscrito al tema FCM: ${topic}`);
      return true;
    } catch (error) {
      console.error(`❌ Error suscribiéndose al tema ${topic}:`, error);
      return false;
    }
  }

  /**
   * Desuscribe de un tema FCM
   */
  static async unsubscribeFromTopic(topic: string): Promise<boolean> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`✅ Desuscrito del tema FCM: ${topic}`);
      return true;
    } catch (error) {
      console.error(`❌ Error desuscribiéndose del tema ${topic}:`, error);
      return false;
    }
  }

  /**
   * Verifica si las notificaciones están habilitadas
   */
  static async areNotificationsEnabled(): Promise<boolean> {
    try {
      const authStatus = await messaging().hasPermission();
      return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
             authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    } catch (error) {
      console.error('❌ Error verificando permisos de notificaciones:', error);
      return false;
    }
  }
}

export default FirebaseMessagingService;

