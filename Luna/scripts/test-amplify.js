const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Probando configuración de Amplify...\n');

// Verificar si existe la configuración de Amplify
const amplifyConfigPath = path.join(__dirname, '../config/amplify.ts');
if (!fs.existsSync(amplifyConfigPath)) {
  console.log('❌ Archivo de configuración de Amplify no encontrado');
  process.exit(1);
}

console.log('✅ Archivo de configuración de Amplify encontrado');

// Verificar dependencias
console.log('\n📦 Verificando dependencias...');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  
  const requiredDeps = [
    '@aws-amplify/auth',
    '@aws-amplify/react-native',
    'aws-amplify'
  ];
  
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
  
  if (missingDeps.length > 0) {
    console.log(`❌ Dependencias faltantes: ${missingDeps.join(', ')}`);
    console.log('💡 Ejecuta: npm install');
  } else {
    console.log('✅ Todas las dependencias de Amplify están instaladas');
  }
} catch (error) {
  console.log('❌ Error leyendo package.json:', error.message);
}

// Verificar configuración de red
console.log('\n🌐 Verificando conectividad de red...');
try {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  console.log('📱 Interfaces de red disponibles:');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  - ${name}: ${net.address}`);
      }
    }
  }
} catch (error) {
  console.log('❌ Error obteniendo información de red:', error.message);
}

// Verificar backend
console.log('\n🔗 Verificando conectividad con backend...');
const backendUrl = 'http://192.168.1.11:3000';

try {
  const https = require('http');
  const url = new URL(backendUrl);
  
  const req = https.request({
    hostname: url.hostname,
    port: url.port,
    path: '/health',
    method: 'GET',
    timeout: 5000
  }, (res) => {
    console.log(`✅ Backend respondiendo: ${res.statusCode}`);
    res.on('data', (chunk) => {
      try {
        const data = JSON.parse(chunk.toString());
        console.log(`📊 Estado del backend: ${data.status}`);
      } catch (e) {
        console.log('📊 Respuesta del backend recibida');
      }
    });
  });
  
  req.on('error', (error) => {
    console.log(`❌ Error conectando al backend: ${error.message}`);
    console.log('💡 Verifica que tu backend esté corriendo en:', backendUrl);
  });
  
  req.on('timeout', () => {
    console.log('⏰ Timeout conectando al backend');
    req.destroy();
  });
  
  req.end();
} catch (error) {
  console.log('❌ Error en la verificación del backend:', error.message);
}

console.log('\n🎯 Verificación completada!');
console.log('\n📋 Resumen de problemas comunes:');
console.log('1. Token de autenticación expirado - Reinicia sesión');
console.log('2. Backend no disponible - Verifica que esté corriendo');
console.log('3. Problemas de CORS - Verifica la configuración del backend');
console.log('4. Caché de Metro - Ejecuta: npm run reset-project');
console.log('5. Dependencias - Ejecuta: npm install');

console.log('\n🔧 Comandos útiles:');
console.log('- npm run reset-project  - Limpiar caché y reiniciar');
console.log('- npm start             - Iniciar servidor de desarrollo');
console.log('- npm run android       - Ejecutar en Android');
console.log('- npm run ios           - Ejecutar en iOS');
