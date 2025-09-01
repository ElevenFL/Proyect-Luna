#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Configurando AWS para el backend de Lunae...\n');

// Verificar si existe el archivo .env
const envPath = path.join(__dirname, '../.env');
const envExamplePath = path.join(__dirname, '../env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📋 Copiando archivo de configuración de ejemplo...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Archivo .env creado');
    console.log('⚠️  Recuerda actualizar los valores con tus credenciales reales\n');
  } else {
    console.log('❌ No se encontró el archivo de ejemplo. Verifica la instalación.');
    process.exit(1);
  }
} else {
  console.log('✅ Archivo .env ya existe\n');
}

// Verificar dependencias
console.log('📦 Verificando dependencias...');
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const requiredDeps = ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'];
const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

if (missingDeps.length > 0) {
  console.log('❌ Faltan dependencias:', missingDeps.join(', '));
  console.log('💡 Ejecuta: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer multer-s3');
} else {
  console.log('✅ Todas las dependencias están instaladas');
}

console.log('\n📋 Próximos pasos:');
console.log('1. Configura tus credenciales AWS (aws configure)');
console.log('2. Crea un bucket S3 para almacenamiento');
console.log('3. Actualiza el archivo .env con tus valores reales');
console.log('4. Prueba la conexión: npm run dev');
console.log('5. Prueba el endpoint: GET /api/images/test-connection');
console.log('\n🎉 ¡Configuración del backend completada!');
