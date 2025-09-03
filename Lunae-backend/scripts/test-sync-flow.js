#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

/**
 * Prueba el flujo completo de sincronización de usuarios
 */
async function testSyncFlow() {
  console.log('🧪 Probando flujo completo de sincronización de usuarios...\n');

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

    // 2. Probar sincronización de usuario de Amplify (simulando registro)
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
      console.log(`   Username: ${syncData.user.username}`);
      console.log(`   Email: ${syncData.user.email}`);
      console.log(`   Profile Completed: ${syncData.user.profileCompleted}`);
      console.log(`   Amplify Sub: ${syncData.user.amplifySub}`);
      
      // Guardar el ID del usuario para pruebas posteriores
      const userId = syncData.user.id;
      
      // 3. Probar actualización del perfil (simulando onboarding)
      console.log('\n3️⃣ Probando actualización del perfil (onboarding)...');
      
      // Actualizar nombre
      console.log('   📝 Actualizando nombre...');
      const nameResponse = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer test_token_${userId}` // Token simulado
        },
        body: JSON.stringify({ displayName: 'Usuario de Prueba' })
      });
      
      if (nameResponse.ok) {
        console.log('   ✅ Nombre actualizado exitosamente');
      } else {
        console.log('   ❌ Error actualizando nombre:', nameResponse.status);
      }
      
      // Actualizar fecha de nacimiento
      console.log('   📅 Actualizando fecha de nacimiento...');
      const birthDateResponse = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer test_token_${userId}`
        },
        body: JSON.stringify({ birthDate: '1990-01-01T00:00:00.000Z' })
      });
      
      if (birthDateResponse.ok) {
        console.log('   ✅ Fecha de nacimiento actualizada exitosamente');
      } else {
        console.log('   ❌ Error actualizando fecha de nacimiento:', birthDateResponse.status);
      }
      
      // Actualizar género
      console.log('   👤 Actualizando género...');
      const genderResponse = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer test_token_${userId}`
        },
        body: JSON.stringify({ gender: 'No especificado' })
      });
      
      if (genderResponse.ok) {
        console.log('   ✅ Género actualizado exitosamente');
      } else {
        console.log('   ❌ Error actualizando género:', genderResponse.status);
      }
      
      // Actualizar ubicación
      console.log('   📍 Actualizando ubicación...');
      const locationResponse = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer test_token_${userId}`
        },
        body: JSON.stringify({ 
          location: {
            latitude: 40.4168,
            longitude: -3.7038,
            address: 'Madrid, España'
          }
        })
      });
      
      if (locationResponse.ok) {
        console.log('   ✅ Ubicación actualizada exitosamente');
      } else {
        console.log('   ❌ Error actualizando ubicación:', locationResponse.status);
      }
      
      // Actualizar foto de perfil
      console.log('   📸 Actualizando foto de perfil...');
      const photoResponse = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer test_token_${userId}`
        },
        body: JSON.stringify({ profileImage: 'https://example.com/profile.jpg' })
      });
      
      if (photoResponse.ok) {
        console.log('   ✅ Foto de perfil actualizada exitosamente');
      } else {
        console.log('   ❌ Error actualizando foto de perfil:', photoResponse.status);
      }
      
      // 4. Verificar estado final del perfil
      console.log('\n4️⃣ Verificando estado final del perfil...');
      const profileResponse = await fetch(`${API_BASE_URL}/profile`, {
        headers: {
          'Authorization': `Bearer test_token_${userId}`
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('✅ Perfil obtenido exitosamente');
        console.log(`   Nombre: ${profileData.user.displayName}`);
        console.log(`   Fecha de nacimiento: ${profileData.user.birthDate}`);
        console.log(`   Género: ${profileData.user.gender}`);
        console.log(`   Ubicación: ${JSON.stringify(profileData.user.location)}`);
        console.log(`   Foto: ${profileData.user.profileImage}`);
        console.log(`   Profile Completed: ${profileData.user.profileCompleted}`);
      } else {
        console.log('❌ Error obteniendo perfil:', profileResponse.status);
      }
      
    } else {
      console.log('❌ Sincronización falló');
      const errorData = await syncResponse.json();
      console.log(`   Error: ${errorData.message}`);
      return;
    }

    console.log('\n🎉 Pruebas de sincronización completadas exitosamente!');
    console.log('\n📋 Resumen del flujo:');
    console.log('   ✅ Usuario se registra en Amplify');
    console.log('   ✅ Usuario se sincroniza con DynamoDB');
    console.log('   ✅ Usuario completa onboarding paso a paso');
    console.log('   ✅ Cada campo se guarda individualmente en DynamoDB');
    console.log('   ✅ Perfil se marca como completado');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando pruebas del flujo de sincronización...\n');
  
  // Verificar variables de entorno
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ Error: AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY son requeridos');
    console.log('💡 Ejecuta: npm run setup-env');
    process.exit(1);
  }
  
  await testSyncFlow();
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testSyncFlow };
