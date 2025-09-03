// Configuración de logging para controlar la salida de errores
export const LOGGING_CONFIG = {
  // Errores que NO se deben mostrar en consola (son esperados)
  SILENT_ERRORS: [
    'NotAuthorizedException',
    'Incorrect username or password',
    'UserNotFoundException',
    'User is not confirmed',
    'UserNotConfirmedException',
    'CodeMismatchException',
    'ExpiredCodeException',
    'LimitExceededException'
  ],
  
  // Errores que SÍ se deben mostrar en consola (son críticos)
  CRITICAL_ERRORS: [
    'NetworkError',
    'ConnectionError',
    'TimeoutError',
    'ServerError'
  ],
  
  // Nivel de logging
  LEVEL: process.env.NODE_ENV === 'development' ? 'debug' : 'error'
};

// Función para determinar si un error debe ser silencioso
export const shouldSilenceError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return LOGGING_CONFIG.SILENT_ERRORS.some(silentError => 
      error.message.includes(silentError) || error.name.includes(silentError)
    );
  }
  return false;
};

// Función para determinar si un error es crítico
export const isCriticalError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return LOGGING_CONFIG.CRITICAL_ERRORS.some(criticalError => 
      error.message.includes(criticalError) || error.name.includes(criticalError)
    );
  }
  return false;
};

// Función de logging inteligente
export const smartLog = {
  error: (message: string, error?: unknown) => {
    if (error && shouldSilenceError(error)) {
      // Error silencioso - solo mostrar mensaje básico
      console.log(message);
    } else if (error && isCriticalError(error)) {
      // Error crítico - mostrar completo
      console.error(message, error);
    } else if (error) {
      // Error normal - mostrar sin detalles excesivos
      console.error(message, error instanceof Error ? error.message : error);
    } else {
      // Solo mensaje
      console.error(message);
    }
  },
  
  warn: (message: string, data?: unknown) => {
    if (LOGGING_CONFIG.LEVEL === 'debug') {
      console.warn(message, data);
    }
  },
  
  info: (message: string, data?: unknown) => {
    if (LOGGING_CONFIG.LEVEL === 'debug') {
      console.log(message, data);
    }
  },
  
  debug: (message: string, data?: unknown) => {
    if (LOGGING_CONFIG.LEVEL === 'debug') {
      console.log(message, data);
    }
  }
};
