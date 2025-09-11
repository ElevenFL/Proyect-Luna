import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configurar cliente de DynamoDB con timeouts optimizados
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // Configuraciones de timeout para mejorar rendimiento
  requestHandler: {
    requestTimeout: 10000, // 10 segundos timeout para requests
    connectionTimeout: 5000, // 5 segundos timeout para conexión
  },
  maxAttempts: 3, // Máximo 3 intentos
  retryMode: 'adaptive', // Modo adaptativo de reintentos
});

// Crear cliente de documento para operaciones más simples
export const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    // Configuración para serialización
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
  unmarshallOptions: {
    // Configuración para deserialización
    wrapNumbers: false,
  },
});

export const connectDB = async () => {
  try {
    console.log('🔌 Conectando a DynamoDB...');
    console.log(`🌍 Región: ${process.env.AWS_REGION || 'us-east-2'}`);
    console.log(`📋 Tabla: ${process.env.DYNAMODB_TABLE_NAME || 'Users'}`);
    
    // Verificar que las credenciales estén configuradas
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn("⚠️ Credenciales de AWS no configuradas");
      console.warn("📝 Crea un archivo .env con tus credenciales de AWS");
      console.warn("🔑 Variables requeridas:");
      console.warn("   - AWS_ACCESS_KEY_ID");
      console.warn("   - AWS_SECRET_ACCESS_KEY");
      console.warn("   - AWS_REGION (opcional, por defecto: us-east-2)");
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Credenciales de AWS no configuradas');
      } else {
        console.log("⚠️ Continuando en modo desarrollo...");
        return;
      }
    }
    
    // Verificar que las credenciales no sean las por defecto
    if (process.env.AWS_ACCESS_KEY_ID === 'TU_ACCESS_KEY_AWS_AQUI' || 
        process.env.AWS_SECRET_ACCESS_KEY === 'TU_SECRET_KEY_AWS_AQUI') {
      console.warn("⚠️ Usando credenciales por defecto. Configura tus credenciales reales en .env");
    }
    
    console.log("✅ Configuración de DynamoDB completada");
    console.log("ℹ️ La tabla se creará automáticamente cuando se ejecute el primer comando");
    
  } catch (err) {
    console.error("❌ Error en la configuración de DynamoDB:", err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log("⚠️ Continuando en modo desarrollo...");
    }
  }
};
