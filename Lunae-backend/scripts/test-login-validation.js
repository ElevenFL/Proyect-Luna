/**
 * Script para probar la validación de login y sincronización
 * Verifica que no se creen usuarios con username como email
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3001/api';

// Función para hacer peticiones HTTP
async function makeRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    return {
      status: response.status,
      data,
      success: response.ok
    };
  } catch (error) {
    console.error('❌ Error en petición:', error.message);
    return {
      status: 0,
      data: { error: error.message },
      success: false
    };
  }
}

// Función para probar la sincronización con datos inválidos
async function testInvalidSync() {
  console.log('\n🧪 Probando sincronización con datos inválidos...\n');

  // Caso 1: Email igual al username
  console.log('📧 Caso 1: Email igual al username');
  const result1 = await makeRequest('/users/sync-amplify', 'POST', {
    username: 'testuser',
    email: 'testuser', // Email igual al username
    sub: 'test-sub-123'
  });
  
  console.log('Status:', result1.status);
  console.log('Response:', JSON.stringify(result1.data, null, 2));
  
  if (result1.status === 400 && result1.data.error === 'INVALID_EMAIL_USERNAME_MATCH') {
    console.log('✅ Validación correcta: Email no puede ser igual al username\n');
  } else {
    console.log('❌ Validación fallida: Debería rechazar email igual al username\n');
  }

  // Caso 2: Email inválido
  console.log('📧 Caso 2: Email con formato inválido');
  const result2 = await makeRequest('/users/sync-amplify', 'POST', {
    username: 'testuser2',
    email: 'not-an-email', // Email inválido
    sub: 'test-sub-456'
  });
  
  console.log('Status:', result2.status);
  console.log('Response:', JSON.stringify(result2.data, null, 2));
  
  if (result2.status === 400 && result2.data.error === 'INVALID_EMAIL_FORMAT') {
    console.log('✅ Validación correcta: Email con formato inválido rechazado\n');
  } else {
    console.log('❌ Validación fallida: Debería rechazar email con formato inválido\n');
  }

  // Caso 3: Email válido (debería funcionar)
  console.log('📧 Caso 3: Email válido');
  const result3 = await makeRequest('/users/sync-amplify', 'POST', {
    username: 'testuser3',
    email: 'testuser3@example.com', // Email válido
    sub: 'test-sub-789'
  });
  
  console.log('Status:', result3.status);
  console.log('Response:', JSON.stringify(result3.data, null, 2));
  
  if (result3.success) {
    console.log('✅ Validación correcta: Email válido aceptado\n');
  } else {
    console.log('❌ Validación fallida: Email válido debería ser aceptado\n');
  }
}

// Función para probar el login con username
async function testLoginWithUsername() {
  console.log('\n🔐 Probando login con username...\n');

  // Primero intentar registrar un usuario con email válido
  console.log('📝 Registrando usuario de prueba...');
  const registerResult = await makeRequest('/users/register', 'POST', {
    username: 'logintest',
    email: 'logintest@example.com',
    password: 'TestPass123'
  });
  
  console.log('Status:', registerResult.status);
  console.log('Response:', JSON.stringify(registerResult.data, null, 2));
  
  if (registerResult.success) {
    console.log('✅ Usuario registrado correctamente\n');
    
    // Ahora probar login con username
    console.log('🔑 Probando login con username...');
    const loginResult = await makeRequest('/users/login', 'POST', {
      usernameOrEmail: 'logintest', // Usar username en lugar de email
      password: 'TestPass123'
    });
    
    console.log('Status:', loginResult.status);
    console.log('Response:', JSON.stringify(loginResult.data, null, 2));
    
    if (loginResult.success) {
      console.log('✅ Login con username funciona correctamente\n');
    } else {
      console.log('❌ Login con username falló\n');
    }
  } else {
    console.log('❌ No se pudo registrar usuario de prueba\n');
  }
}

// Función principal
async function main() {
  console.log('🚀 Iniciando pruebas de validación de login...\n');
  
  try {
    await testInvalidSync();
    await testLoginWithUsername();
    
    console.log('🎉 Pruebas completadas');
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testInvalidSync, testLoginWithUsername };
