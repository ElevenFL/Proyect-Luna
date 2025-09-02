#!/usr/bin/env node

/**
 * This script is used to reset the project to a blank state.
 * It deletes or moves the /app, /components, /hooks, /scripts, and /constants directories to /app-example based on user input and creates a new /app directory with an index.tsx and _layout.tsx file.
 * You can remove the `reset-project` script from package.json and safely delete this file after running it.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Reiniciando proyecto Luna...\n');

// Función para ejecutar comandos de forma segura
function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    execSync(command, { stdio: 'inherit', cwd: __dirname + '/..' });
    console.log(`✅ ${description} completado\n`);
  } catch (error) {
    console.log(`❌ Error en ${description}: ${error.message}\n`);
  }
}

// Función para eliminar directorios si existen
function removeDirectory(dirPath, description) {
  if (fs.existsSync(dirPath)) {
    try {
      console.log(`🗑️  ${description}...`);
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✅ ${description} eliminado\n`);
    } catch (error) {
      console.log(`❌ Error eliminando ${description}: ${error.message}\n`);
    }
  }
}

// Limpiar caché y archivos temporales
console.log('🧹 Limpiando caché y archivos temporales...\n');

// Eliminar directorios de build y caché
removeDirectory(path.join(__dirname, '../android/app/build'), 'Directorio de build de Android');
removeDirectory(path.join(__dirname, '../android/build'), 'Directorio de build de Gradle');
removeDirectory(path.join(__dirname, '../build'), 'Directorio de build general');
removeDirectory(path.join(__dirname, '../.expo'), 'Directorio de Expo');
removeDirectory(path.join(__dirname, '../node_modules/.cache'), 'Caché de node_modules');

// Limpiar caché de Metro
runCommand('npx expo start --clear', 'Limpiando caché de Metro');

console.log('🎯 Proceso de reinicio completado!');
console.log('\n📱 Para continuar:');
console.log('1. Presiona Ctrl+C para detener el servidor de Metro');
console.log('2. Ejecuta: npm start');
console.log('3. Escanea el código QR con tu app Expo Go');
console.log('\n🔧 Si persisten los problemas:');
console.log('- Ejecuta: npm run android (para Android)');
console.log('- Ejecuta: npm run ios (para iOS)');
console.log('- Verifica que tu backend esté corriendo en http://192.168.1.11:3000');
