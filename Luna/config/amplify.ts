import { Amplify } from 'aws-amplify';
import { uploadData, getUrl, remove } from 'aws-amplify/storage';

// Configuración de AWS Amplify v6
const amplifyConfig = {
  Storage: {
    S3: {
      bucket: 'eleven-lunea-storage', // Cambiar por tu bucket real
      region: 'us-east-2', // Cambiar por tu región preferida
    },
  },
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

// Exportar funciones de Storage para compatibilidad
export const Storage = {
  uploadData,
  getUrl,
  remove,
};

export default Amplify;
