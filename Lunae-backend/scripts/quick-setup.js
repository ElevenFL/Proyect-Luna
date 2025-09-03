import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function quickSetup() {
  try {
    console.log('🚀 Configuración Rápida para Lunae Backend');
    console.log('==========================================');
    
    // Verificar si existe .env
    const envPath = path.join(__dirname, '..', '.env');
    const envTemplatePath = path.join(__dirname, '..', 'env.template');
    
    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envTemplatePath)) {
        console.log('📝 Creando archivo .env desde plantilla...');
        fs.copyFileSync(envTemplatePath, envPath);
        console.log('✅ Archivo .env creado exitosamente');
        console.log('⚠️ IMPORTANTE: Edita el archivo .env con tus credenciales de AWS');
      } else {
        console.log('❌ No se encontró env.template');
        console.log('📝 Crea manualmente un archivo .env con las variables necesarias');
      }
    } else {
      console.log('ℹ️ El archivo .env ya existe');
    }
    
    console.log('\n📋 Pasos para completar la configuración:');
    console.log('1. Edita el archivo .env con tus credenciales de AWS');
    console.log('2. Ejecuta: npm run setup-dynamodb');
    console.log('3. Si tienes datos en MongoDB, ejecuta: npm run migrate-mongodb');
    console.log('4. Inicia el servidor: npm run dev');
    
    console.log('\n🔑 Variables de entorno requeridas:');
    console.log('- AWS_ACCESS_KEY_ID: Tu Access Key de AWS');
    console.log('- AWS_SECRET_ACCESS_KEY: Tu Secret Key de AWS');
    console.log('- AWS_REGION: Región de AWS (ej: us-east-2)');
    console.log('- JWT_SECRET: Clave secreta para JWT');
    
    console.log('\n🌐 Recursos útiles:');
    console.log('- AWS Console: https://console.aws.amazon.com/');
    console.log('- DynamoDB: https://console.aws.amazon.com/dynamodb/');
    console.log('- IAM Users: https://console.aws.amazon.com/iam/');
    
  } catch (error) {
    console.error('❌ Error en la configuración rápida:', error);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  quickSetup();
}

export { quickSetup };
