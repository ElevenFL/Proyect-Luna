import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

// Configuración de AWS Amplify v6 (solo para autenticación)
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-2_gNVmmibaW', // Cambiar por tu User Pool ID
      userPoolClientId: 'chv9d3656g27sdvb48nm5r28u', // Cambiar por tu App Client ID
      region: 'us-east-2', // Cambiar por tu región preferida
    },
  },
};

// Inicializar Amplify
Amplify.configure(amplifyConfig);

// Exportar funciones de Auth para compatibilidad
export const Auth = {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
};

export default Amplify;
