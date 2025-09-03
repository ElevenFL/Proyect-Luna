import dotenv from 'dotenv';

dotenv.config();

function debugCredentials() {
  console.log('🔍 Diagnóstico de credenciales AWS...\n');
  
  // Verificar variables de entorno
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION;
  
  console.log('📋 Variables de entorno:');
  console.log(`   AWS_REGION: "${region}"`);
  console.log(`   AWS_ACCESS_KEY_ID: "${accessKey}"`);
  console.log(`   AWS_SECRET_ACCESS_KEY: "${secretKey}"`);
  
  // Verificar longitud de las claves
  console.log('\n📏 Longitud de las claves:');
  console.log(`   Access Key: ${accessKey ? accessKey.length : 0} caracteres`);
  console.log(`   Secret Key: ${secretKey ? secretKey.length : 0} caracteres`);
  
  // Verificar formato de Access Key
  console.log('\n🔑 Formato de Access Key:');
  if (accessKey) {
    const isValidFormat = /^AKIA[0-9A-Z]{16}$/.test(accessKey);
    console.log(`   Formato válido: ${isValidFormat ? '✅' : '❌'}`);
    console.log(`   Comienza con AKIA: ${accessKey.startsWith('AKIA') ? '✅' : '❌'}`);
    console.log(`   Solo letras y números: ${/^[A-Z0-9]+$/.test(accessKey) ? '✅' : '❌'}`);
  } else {
    console.log('   ❌ No configurada');
  }
  
  // Verificar formato de Secret Key
  console.log('\n🔐 Formato de Secret Key:');
  if (secretKey) {
    const isValidLength = secretKey.length === 40;
    console.log(`   Longitud correcta (40): ${isValidLength ? '✅' : '❌'}`);
    console.log(`   Solo caracteres válidos: ${/^[A-Za-z0-9+/]+$/.test(secretKey) ? '✅' : '❌'}`);
    
    // Verificar si hay caracteres problemáticos
    const problemChars = [];
    for (let i = 0; i < secretKey.length; i++) {
      const char = secretKey[i];
      if (!/[A-Za-z0-9+/]/.test(char)) {
        problemChars.push(`'${char}' en posición ${i + 1}`);
      }
    }
    
    if (problemChars.length > 0) {
      console.log(`   ❌ Caracteres problemáticos: ${problemChars.join(', ')}`);
    } else {
      console.log('   ✅ Solo caracteres válidos');
    }
  } else {
    console.log('   ❌ No configurada');
  }
  
  // Verificar si hay espacios o saltos de línea
  console.log('\n🚫 Caracteres problemáticos:');
  if (accessKey) {
    const hasSpaces = accessKey.includes(' ');
    const hasNewlines = accessKey.includes('\n') || accessKey.includes('\r');
    const hasTabs = accessKey.includes('\t');
    
    console.log(`   Access Key - Espacios: ${hasSpaces ? '❌' : '✅'}`);
    console.log(`   Access Key - Saltos de línea: ${hasNewlines ? '❌' : '✅'}`);
    console.log(`   Access Key - Tabs: ${hasTabs ? '❌' : '✅'}`);
  }
  
  if (secretKey) {
    const hasSpaces = secretKey.includes(' ');
    const hasNewlines = secretKey.includes('\n') || secretKey.includes('\r');
    const hasTabs = secretKey.includes('\t');
    
    console.log(`   Secret Key - Espacios: ${hasSpaces ? '❌' : '✅'}`);
    console.log(`   Secret Key - Saltos de línea: ${hasNewlines ? '❌' : '✅'}`);
    console.log(`   Secret Key - Tabs: ${hasTabs ? '❌' : '✅'}`);
  }
  
  // Verificar si las credenciales están completas
  console.log('\n✅ Estado de las credenciales:');
  const isComplete = accessKey && secretKey && region;
  console.log(`   Configuración completa: ${isComplete ? '✅' : '❌'}`);
  
  if (isComplete) {
    console.log('\n🎯 Recomendaciones:');
    console.log('1. Verifica que no haya espacios al inicio o final de las claves');
    console.log('2. Asegúrate de que no haya saltos de línea dentro de las claves');
    console.log('3. Copia las claves exactamente como aparecen en la consola de AWS');
    console.log('4. Si usas un editor de texto, asegúrate de que no agregue caracteres ocultos');
    
    console.log('\n🧪 Para probar las credenciales:');
    console.log('   npm run test-dynamodb');
  } else {
    console.log('\n❌ Problemas encontrados:');
    if (!accessKey) console.log('   - AWS_ACCESS_KEY_ID no está configurada');
    if (!secretKey) console.log('   - AWS_SECRET_ACCESS_KEY no está configurada');
    if (!region) console.log('   - AWS_REGION no está configurada');
  }
}

debugCredentials();
