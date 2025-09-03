// Configuración de la aplicación para manejar estados y comportamientos
export const APP_CONFIG = {
  // Timeouts y delays
  TIMEOUTS: {
    AUTH_LOADING: 10000, // 10 segundos para carga de autenticación
    REDIRECT_ATTEMPTS: 3, // Máximo 3 intentos de redirección
    REDIRECT_DELAY: 1000, // 1 segundo entre intentos de redirección
    SAFETY_TIMEOUT: 15000, // 15 segundos de timeout de seguridad
  },

  // Estados de la aplicación
  APP_STATES: {
    ACTIVE: 'active',
    BACKGROUND: 'background',
    INACTIVE: 'inactive',
  },

  // Configuración de alertas
  ALERTS: {
    AUTO_CLEANUP_ON_BACKGROUND: true, // Limpiar alertas al pasar a segundo plano
    MAX_ALERTS: 5, // Máximo número de alertas activas
  },

  // Configuración de recuperación
  RECOVERY: {
    ENABLE_AUTO_RECOVERY: true, // Habilitar recuperación automática
    MAX_RECOVERY_ATTEMPTS: 3, // Máximo intentos de recuperación
    RECOVERY_DELAY: 2000, // 2 segundos entre intentos de recuperación
  },

  // Configuración de logging
  LOGGING: {
    ENABLE_DEBUG: __DEV__, // Solo en desarrollo
    LOG_APP_STATE_CHANGES: true,
    LOG_AUTH_CHANGES: true,
    LOG_ERRORS: true,
  },

  // Configuración de navegación
  NAVIGATION: {
    ENABLE_SAFE_NAVIGATION: true, // Navegación segura con timeouts
    NAVIGATION_TIMEOUT: 5000, // 5 segundos de timeout para navegación
  },

  // Configuración de persistencia
  PERSISTENCE: {
    ENABLE_STATE_PERSISTENCE: true, // Persistir estado de la app
    CLEANUP_ON_APP_BACKGROUND: true, // Limpiar estado temporal al pasar a segundo plano
  },
};

// Configuración específica para diferentes entornos
export const ENV_CONFIG = {
  development: {
    ...APP_CONFIG,
    LOGGING: {
      ...APP_CONFIG.LOGGING,
      ENABLE_DEBUG: true,
      LOG_LEVEL: 'debug',
    },
    TIMEOUTS: {
      ...APP_CONFIG.TIMEOUTS,
      SAFETY_TIMEOUT: 5000, // Timeout más corto en desarrollo
    },
  },
  production: {
    ...APP_CONFIG,
    LOGGING: {
      ...APP_CONFIG.LOGGING,
      ENABLE_DEBUG: false,
      LOG_LEVEL: 'error',
    },
    RECOVERY: {
      ...APP_CONFIG.RECOVERY,
      ENABLE_AUTO_RECOVERY: false, // Deshabilitar recuperación automática en producción
    },
  },
};

// Función para obtener la configuración según el entorno
export const getAppConfig = () => {
  const env = __DEV__ ? 'development' : 'production';
  return ENV_CONFIG[env] || APP_CONFIG;
};

// Función para validar la configuración
export const validateAppConfig = () => {
  const config = getAppConfig();
  
  // Validar timeouts
  if (config.TIMEOUTS.AUTH_LOADING <= 0) {
    console.warn('APP_CONFIG: AUTH_LOADING timeout debe ser mayor a 0');
  }
  
  if (config.TIMEOUTS.SAFETY_TIMEOUT <= config.TIMEOUTS.AUTH_LOADING) {
    console.warn('APP_CONFIG: SAFETY_TIMEOUT debe ser mayor que AUTH_LOADING');
  }
  
  return config;
};

// Configuración por defecto exportada
export default getAppConfig();
