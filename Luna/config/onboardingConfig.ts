// Configuración del flujo de onboarding
export const ONBOARDING_CONFIG = {
  // Rutas del onboarding
  ROUTES: {
    WELCOME: '/onboarding/welcome',
    NAME: '/onboarding/name',
    BIRTHDATE: '/onboarding/birthdate',
    GENDER: '/onboarding/gender',
    LOCATION: '/onboarding/location',
    PHOTO: '/onboarding/photo',
    COMPLETE: '/onboarding/complete'
  },
  
  // Rutas de la aplicación principal
  APP_ROUTES: {
    TABS: '/(tabs)',
    LOGIN: '/(auth)/login',
    REGISTER: '/(auth)/register',
    VERIFY: '/(auth)/verify'
  },
  
  // Campos requeridos para completar el perfil
  REQUIRED_FIELDS: [
    'displayName',
    'birthDate', 
    'gender',
    'location',
    'profileImage'
  ],
  
  // Mensajes de estado
  MESSAGES: {
    PROFILE_INCOMPLETE: 'Tu perfil no está completo. Por favor, completa la configuración.',
    PROFILE_COMPLETE: 'Tu perfil está completo. ¡Bienvenido a la aplicación!',
    REDIRECTING_ONBOARDING: 'Redirigiendo al onboarding...',
    REDIRECTING_APP: 'Redirigiendo a la aplicación...'
  },
  
  // Configuración de redirección
  REDIRECT: {
    DELAY: 1000, // Delay en ms para las redirecciones
    MAX_ATTEMPTS: 3 // Máximo número de intentos de redirección
  }
};

// Función para verificar si un usuario necesita completar el onboarding
export const needsOnboarding = (user: any): boolean => {
  if (!user) return true;
  
  // Confiar completamente en el campo profileCompleted de la base de datos
  // Si profileCompleted es true, el usuario NO necesita completar el onboarding
  return !user.profileCompleted;
};

// Función para obtener la ruta de destino según el estado del usuario
export const getDestinationRoute = (user: any): string => {
  if (!user) {
    return ONBOARDING_CONFIG.APP_ROUTES.LOGIN;
  }
  
  if (needsOnboarding(user)) {
    return ONBOARDING_CONFIG.ROUTES.WELCOME;
  }
  
  return ONBOARDING_CONFIG.APP_ROUTES.TABS;
};

// Función para verificar si el usuario está en la ruta correcta
export const isOnCorrectRoute = (user: any, currentRoute: string): boolean => {
  const destinationRoute = getDestinationRoute(user);
  
  if (needsOnboarding(user)) {
    return currentRoute.startsWith('/onboarding');
  } else {
    return currentRoute.startsWith('/(tabs)');
  }
};
