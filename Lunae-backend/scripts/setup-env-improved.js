import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Configurando archivo de entorno para el backend...\n');

const envPath = path.join(__dirname, '../.env');
const envExamplePath = path.join(__dirname, '../env.example');

// Verificar si ya existe el archivo .env
if (fs.existsSync(envPath)) {
  console.log('✅ Archivo .env ya existe');
  console.log('📝 Si necesitas regenerarlo, elimina el archivo actual y ejecuta este script nuevamente');
  process.exit(0);
}

// Leer el archivo de ejemplo
if (!fs.existsSync(envExamplePath)) {
  console.log('❌ Archivo env.example no encontrado');
  process.exit(1);
}

try {
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  
  // Crear el archivo .env con valores por defecto
  const envContent = envExample
    .replace('your_access_key_here', 'TU_ACCESS_KEY_AWS_AQUI')
    .replace('your_secret_key_here', 'TU_SECRET_KEY_AWS_AQUI')
    .replace('your_jwt_secret_here', 'lunae_jwt_secret_' + Date.now());
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Archivo .env creado exitosamente');
  console.log('📝 IMPORTANTE: Edita el archivo .env con tus credenciales reales de AWS');
  console.log('🔑 Necesitarás configurar:');
  console.log('   - AWS_ACCESS_KEY_ID');
  console.log('   - AWS_SECRET_ACCESS_KEY');
  console.log('   - JWT_SECRET (ya generado automáticamente)');
  console.log('\n🚀 Para continuar:');
  console.log('1. Edita el archivo .env con tus credenciales reales de AWS');
  console.log('2. Ejecuta: npm start');
  console.log('3. Verifica que DynamoDB esté configurado correctamente');
  
} catch (error) {
  console.error('❌ Error creando archivo .env:', error.message);
  process.exit(1);
}
