const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Inicio rápido del backend Lunae...\n');

// Función para ejecutar comandos de forma segura
function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    execSync(command, { stdio: 'inherit', cwd: __dirname + '/..' });
    console.log(`✅ ${description} completado\n`);
  } catch (error) {
    console.log(`❌ Error en ${description}: ${error.message}\n`);
    return false;
  }
  return true;
}

// Función para verificar si MongoDB está corriendo
function checkMongoDB() {
  try {
    console.log('🔍 Verificando MongoDB...');
    const { execSync } = require('child_process');
    
    // Intentar conectar a MongoDB
    execSync('mongosh --eval "db.runCommand(\'ping\')"', { 
      stdio: 'pipe',
      timeout: 5000 
    });
    
    console.log('✅ MongoDB está corriendo\n');
    return true;
  } catch (error) {
    console.log('❌ MongoDB no está corriendo');
    console.log('💡 Para iniciar MongoDB:');
    console.log('   - Windows: Inicia MongoDB como servicio');
    console.log('   - macOS: brew services start mongodb-community');
    console.log('   - Linux: sudo systemctl start mongod\n');
    return false;
  }
}

// Función para verificar archivo .env
function checkEnvFile() {
  const envPath = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('📝 Archivo .env no encontrado, creándolo...');
    if (!runCommand('npm run setup-env', 'Configurando archivo de entorno')) {
      return false;
    }
  } else {
    console.log('✅ Archivo .env encontrado');
  }
  
  return true;
}

// Función principal
async function quickStart() {
  console.log('🔧 Verificando requisitos...\n');
  
  // Verificar MongoDB
  if (!checkMongoDB()) {
    console.log('❌ No se puede continuar sin MongoDB');
    return;
  }
  
  // Verificar archivo .env
  if (!checkEnvFile()) {
    console.log('❌ No se pudo configurar el archivo de entorno');
    return;
  }
  
  // Verificar dependencias
  console.log('📦 Verificando dependencias...');
  if (!fs.existsSync(path.join(__dirname, '../node_modules'))) {
    console.log('📦 Instalando dependencias...');
    if (!runCommand('npm install', 'Instalando dependencias')) {
      console.log('❌ Error instalando dependencias');
      return;
    }
  } else {
    console.log('✅ Dependencias ya instaladas');
  }
  
  console.log('\n🎯 Todo listo! Iniciando servidor...\n');
  
  // Iniciar servidor
  runCommand('npm run dev', 'Iniciando servidor de desarrollo');
}

// Ejecutar inicio rápido
quickStart().catch(console.error);

