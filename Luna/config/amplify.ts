import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signUp, 
  signOut, 
  getCurrentUser, 
  fetchAuthSession,
  confirmSignUp,
  resendSignUpCode,
  type SignInInput,
  type SignUpInput,
  type ConfirmSignUpInput,
  type ResendSignUpCodeInput
} from 'aws-amplify/auth';
import { ENV, validateEnv } from './env';

// Validar variables de entorno requeridas
validateEnv();

// Configuración de AWS Amplify v6
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: ENV.AWS.USER_POOL_ID!,
      userPoolClientId: ENV.AWS.USER_POOL_CLIENT_ID!,
      region: ENV.AWS.REGION,
    },
  },
} as const;

// Inicializar Amplify con manejo de errores mejorado
let isAmplifyConfigured = false;

const initializeAmplify = () => {
  if (isAmplifyConfigured) {
    return;
  }
  
  try {
    Amplify.configure(amplifyConfig);
    isAmplifyConfigured = true;
    console.log('Amplify configurado exitosamente');
  } catch (error) {
    console.error('Error configurando Amplify:', error);
    // No lanzar error inmediatamente, permitir que la app continúe
    console.warn('Amplify no se pudo configurar, continuando sin autenticación...');
  }
};

// Inicializar Amplify de forma segura
initializeAmplify();

// Tipos personalizados para mejor tipado
export interface AuthError extends Error {
  code?: string;
  name: string;
}

// Wrapper para mejor manejo de errores
const handleAuthError = (error: unknown): AuthError => {
  if (error instanceof Error) {
    const authError: AuthError = error;
    // Normalizar códigos de error comunes
    switch (authError.name) {
      case 'UserNotFoundException':
        authError.code = 'USER_NOT_FOUND';
        break;
      case 'NotAuthorizedException':
        // No transformar este error para mantener el mensaje original
        // Solo agregar el código para referencia
        authError.code = 'INVALID_CREDENTIALS';
        break;
      case 'UserNotConfirmedException':
        authError.code = 'USER_NOT_CONFIRMED';
        break;
      case 'UsernameExistsException':
        authError.code = 'USERNAME_EXISTS';
        break;
      case 'InvalidPasswordException':
        authError.code = 'INVALID_PASSWORD';
        break;
      default:
        authError.code = 'UNKNOWN_ERROR';
    }
    return authError;
  }
  return {
    name: 'UnknownError',
    code: 'UNKNOWN_ERROR',
    message: 'Error desconocido en la autenticación'
  };
};

// Exportar funciones de Auth con mejor manejo de errores
export const Auth = {
  async signIn(input: SignInInput) {
    try {
      return await signIn(input);
    } catch (error) {
      throw handleAuthError(error);
    }
  },
  
  async signUp(input: SignUpInput) {
    try {
      return await signUp(input);
    } catch (error) {
      throw handleAuthError(error);
    }
  },
  
  async signOut() {
    try {
      return await signOut();
    } catch (error) {
      throw handleAuthError(error);
    }
  },
  
  async getCurrentUser() {
    try {
      return await getCurrentUser();
    } catch (error) {
      throw handleAuthError(error);
    }
  },
  
  async fetchAuthSession() {
    try {
      return await fetchAuthSession();
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async confirmSignUp(input: ConfirmSignUpInput) {
    try {
      return await confirmSignUp(input);
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async resendSignUpCode(input: ResendSignUpCodeInput) {
    try {
      return await resendSignUpCode(input);
    } catch (error) {
      throw handleAuthError(error);
    }
  }
};

export default Amplify;
