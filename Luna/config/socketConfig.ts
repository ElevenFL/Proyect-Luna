import { Platform } from 'react-native';

/**
 * Configuración específica para Socket.IO en React Native
 */
export const SOCKET_CONFIG = {
  // Configuración de transporte optimizada para React Native
  transports: Platform.OS === 'ios' ? ['websocket', 'polling'] : ['polling', 'websocket'],
  
  // Timeouts optimizados para móviles
  timeout: 20000, // 20 segundos para móviles
  pingTimeout: 60000, // 1 minuto
  pingInterval: 25000, // 25 segundos
  
  // Configuración de reconexión
  reconnection: false, // Desactivar reconexión automática de Socket.IO
  reconnectionAttempts: 0,
  reconnectionDelay: 0,

  
  // Configuración específica para React Native
  forceNew: true, // Forzar nueva conexión
  upgrade: true, // Permitir upgrade de polling a websocket
  rememberUpgrade: false, // No recordar upgrade
  closeOnBeforeunload: false, // No cerrar automáticamente
  
  // Configuración de autenticación
  auth: {
    // Se establecerá dinámicamente
  },
  
  // Configuración de debugging
  debug: __DEV__, // Solo en desarrollo
  
  // Configuración de eventos
  autoConnect: false,
  
  // Configuración específica para móviles
  ...(Platform.OS === 'android' && {
    // Configuraciones específicas para Android
    transports: ['polling', 'websocket'],
    timeout: 25000, // Android puede necesitar más tiempo
  }),
  
  ...(Platform.OS === 'ios' && {
    // Configuraciones específicas para iOS
    transports: ['websocket', 'polling'],
    timeout: 15000, // iOS generalmente es más rápido
  })
};

/**
 * Verifica si Socket.IO está disponible y configurado correctamente
 */
export const validateSocketIO = (): boolean => {
  try {
    // Verificar que estamos en un entorno que soporta WebSockets
    if (typeof window === 'undefined' && typeof global === 'undefined') {
      console.error('❌ SocketConfig: Entorno no soportado para Socket.IO');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ SocketConfig: Error validando Socket.IO:', error);
    return false;
  }
};

/**
 * Obtiene la configuración de Socket.IO para una URL específica
 */
export const getSocketConfig = (baseUrl: string, userId: string, authToken?: string) => {
  return {
    ...SOCKET_CONFIG,
    auth: {
      userId,
      token: authToken
    }
  };
};
