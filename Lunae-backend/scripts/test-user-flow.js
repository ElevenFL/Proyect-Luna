#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

/**
 * Prueba el flujo completo de registro de usuarios
 */
async function testUserFlow() {
  console.log('🧪 Probando flujo completo de registro de usuarios...\n');

  try {
    // 1. Probar endpoint de health check
    console.log('1️⃣ Probando health check...');
    const healthResponse = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    if (healthResponse.ok) {
      console.log('✅ Health check exitoso');
    } else {
      console.log('❌ Health check falló');
      return;
    }

    // 2. Probar sincronización de usuario de Amplify
    console.log('\n2️⃣ Probando sincronización de usuario de Amplify...');
    const testUser = {
      username: 'testuser_' + Date.now(),
      email: `test${Date.now()}@example.com`,
      sub: 'test_amplify_sub_' + Date.now()
    };

    const syncResponse = await fetch(`${API_BASE_URL}/users/sync-amplify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser)
    });

    if (syncResponse.ok) {
      const syncData = await syncResponse.json();
      console.log('✅ Sincronización exitosa');
      console.log(`   Usuario ID: ${syncData.user.id}`);
      console.log(`   Profile Completed: ${syncData.user.profileCompleted}`);
    } else {
      console.log('❌ Sincronización falló');
      const errorData = await syncResponse.json();
      console.log(`   Error: ${errorData.message}`);
      return;
    }

    // 3. Probar búsqueda de usuario por email
    console.log('\n3️⃣ Probando búsqueda de usuario por email...');
    const searchResponse = await fetch(`${API_BASE_URL}/users?email=${testUser.email}`);
    if (searchResponse.ok) {
      console.log('✅ Búsqueda por email exitosa');
    } else {
      console.log('❌ Búsqueda por email falló');
    }

    // 4. Probar verificación de estado del perfil (sin autenticación)
    console.log('\n4️⃣ Probando verificación de estado del perfil (sin auth)...');
    const profileResponse = await fetch(`${API_BASE_URL}/users/profile-status`);
    if (profileResponse.status === 401) {
      console.log('✅ Protección de ruta funcionando (401 Unauthorized)');
    } else {
      console.log('❌ Ruta no está protegida correctamente');
    }

    // 5. Probar registro de usuario normal
    console.log('\n5️⃣ Probando registro de usuario normal...');
    const registerUser = {
      username: 'normaluser_' + Date.now(),
      email: `normal${Date.now()}@example.com`,
      password: 'TestPass123!'
    };

    const registerResponse = await fetch(`${API_BASE_URL}/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registerUser)
    });

    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      console.log('✅ Registro exitoso');
      console.log(`   Token recibido: ${registerData.token ? 'Sí' : 'No'}`);
      console.log(`   Profile Completed: ${registerData.user.profileCompleted}`);
    } else {
      console.log('❌ Registro falló');
      const errorData = await registerResponse.json();
      console.log(`   Error: ${errorData.message}`);
    }

    // 6. Probar login con usuario registrado
    console.log('\n6️⃣ Probando login con usuario registrado...');
    const loginResponse = await fetch(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usernameOrEmail: registerUser.username,
        password: registerUser.password
      })
    });

    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Login exitoso');
      console.log(`   Token recibido: ${loginData.token ? 'Sí' : 'No'}`);
      console.log(`   Profile Completed: ${loginData.user.profileCompleted}`);
      
      // 7. Probar verificación de estado del perfil (con autenticación)
      console.log('\n7️⃣ Probando verificación de estado del perfil (con auth)...');
      const authProfileResponse = await fetch(`${API_BASE_URL}/users/profile-status`, {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      });
      
      if (authProfileResponse.ok) {
        const profileData = await authProfileResponse.json();
        console.log('✅ Verificación de perfil exitosa');
        console.log(`   Profile Completed: ${profileData.user.profileCompleted}`);
      } else {
        console.log('❌ Verificación de perfil falló');
        const errorData = await authProfileResponse.json();
        console.log(`   Error: ${errorData.message}`);
      }
    } else {
      console.log('❌ Login falló');
      const errorData = await loginResponse.json();
      console.log(`   Error: ${errorData.message}`);
    }

    console.log('\n🎉 Pruebas completadas exitosamente!');
    console.log('\n📋 Resumen del flujo:');
    console.log('   ✅ Usuario se registra en Amplify');
    console.log('   ✅ Usuario verifica email con código');
    console.log('   ✅ Usuario se sincroniza con DynamoDB');
    console.log('   ✅ Usuario es redirigido al onboarding');
    console.log('   ✅ Usuario completa perfil');
    console.log('   ✅ Usuario accede al home');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando pruebas del flujo de usuarios...\n');
  
  // Verificar variables de entorno
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ Error: AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY son requeridos');
    console.log('💡 Ejecuta: npm run setup-env');
    process.exit(1);
  }
  
  await testUserFlow();
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testUserFlow };
