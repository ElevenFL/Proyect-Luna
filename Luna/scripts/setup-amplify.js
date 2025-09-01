#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Configurando AWS Amplify para Luna...\n');

// Verificar si existe el archivo de configuración
const configPath = path.join(__dirname, '../config/amplify.ts');
const examplePath = path.join(__dirname, '../config/amplify.example.ts');

if (!fs.existsSync(configPath)) {
  if (fs.existsSync(examplePath)) {
    console.log('📋 Copiando archivo de configuración de ejemplo...');
    fs.copyFileSync(examplePath, configPath);
    console.log('✅ Archivo de configuración creado en config/amplify.ts');
    console.log('⚠️  Recuerda actualizar los valores con tus credenciales reales\n');
  } else {
    console.log('❌ No se encontró el archivo de ejemplo. Verifica la instalación.');
    process.exit(1);
  }
} else {
  console.log('✅ Archivo de configuración ya existe\n');
}

// Verificar dependencias
console.log('📦 Verificando dependencias...');
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const requiredDeps = ['aws-amplify', '@aws-amplify/react-native'];
const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

if (missingDeps.length > 0) {
  console.log('❌ Faltan dependencias:', missingDeps.join(', '));
  console.log('💡 Ejecuta: npm install aws-amplify @aws-amplify/react-native');
} else {
  console.log('✅ Todas las dependencias están instaladas');
}

console.log('\n📋 Próximos pasos:');
console.log('1. Configura tus credenciales AWS (aws configure)');
console.log('2. Crea un bucket S3 para almacenamiento');
console.log('3. Actualiza config/amplify.ts con tus valores reales');
console.log('4. Prueba la conexión con ImageService.testConnection()');
console.log('\n🎉 ¡Configuración completada!');
