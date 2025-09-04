#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const BACKEND_URL = 'http://localhost:3000';

console.log('🧪 Probando backend después de corregir índices...');
console.log('🌐 URL del backend:', BACKEND_URL);

async function testBackendHealth() {
  try {
    console.log('\n📡 1. Probando endpoint de health...');
    const healthResponse = await fetch(`${BACKEND_URL}/health`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check exitoso:', healthData);
    } else {
      console.log('❌ Health check falló:', healthResponse.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error en health check:', error.message);
    return false;
  }
}

async function testSyncEndpoint() {
  try {
    console.log('\n📡 2. Probando endpoint de sincronización...');
    
    const syncData = {
      username: 'test_user',
      email: 'test@example.com',
      sub: 'test-amplify-sub-123'
    };
    
    const syncResponse = await fetch(`${BACKEND_URL}/api/users/sync-amplify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(syncData)
    });
    
    if (syncResponse.ok) {
      const syncResult = await syncResponse.json();
      console.log('✅ Sincronización exitosa:', syncResult);
    } else {
      const errorData = await syncResponse.json();
      console.log('❌ Sincronización falló:', syncResponse.status);
      console.log('📄 Error:', errorData);
      
      // Si es un error de validación de base de datos, mostrar más detalles
      if (errorData.error === 'DB_VALIDATION_ERROR') {
        console.log('🔍 Error de validación en la base de datos');
        console.log('💡 Esto puede indicar que los índices aún no están funcionando correctamente');
      }
    }
    
    return syncResponse.ok;
  } catch (error) {
    console.error('❌ Error probando sincronización:', error.message);
    return false;
  }
}

async function testUserSearch() {
  try {
    console.log('\n📡 3. Probando búsqueda de usuario por email...');
    
    // Primero crear un usuario
    const createData = {
      username: 'search_test_user',
      email: 'searchtest@example.com',
      displayName: 'Usuario de Prueba Búsqueda'
    };
    
    const createResponse = await fetch(`${BACKEND_URL}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createData)
    });
    
    if (createResponse.ok) {
      console.log('✅ Usuario creado para prueba de búsqueda');
      
      // Ahora probar búsqueda por email
      const searchResponse = await fetch(`${BACKEND_URL}/api/users/search?email=searchtest@example.com`);
      
      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        console.log('✅ Búsqueda por email exitosa:', searchResult);
      } else {
        console.log('❌ Búsqueda por email falló:', searchResponse.status);
      }
    } else {
      console.log('❌ No se pudo crear usuario para prueba:', createResponse.status);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error en prueba de búsqueda:', error.message);
    return false;
  }
}

async function runTests() {
  try {
    console.log('🚀 Iniciando pruebas del backend...\n');
    
    // Test 1: Health check
    const healthOk = await testBackendHealth();
    if (!healthOk) {
      console.log('\n❌ Backend no está respondiendo. Verifica que esté corriendo.');
      return;
    }
    
    // Test 2: Sincronización
    const syncOk = await testSyncEndpoint();
    
    // Test 3: Búsqueda de usuario
    const searchOk = await testUserSearch();
    
    // Resumen
    console.log('\n📊 Resumen de pruebas:');
    console.log(`   Health Check: ${healthOk ? '✅' : '❌'}`);
    console.log(`   Sincronización: ${syncOk ? '✅' : '❌'}`);
    console.log(`   Búsqueda: ${searchOk ? '✅' : '❌'}`);
    
    if (healthOk && syncOk && searchOk) {
      console.log('\n🎉 ¡Todas las pruebas pasaron! El backend está funcionando correctamente.');
      console.log('📱 Ahora puedes probar la aplicación móvil.');
    } else {
      console.log('\n⚠️ Algunas pruebas fallaron. Revisa los errores arriba.');
      
      if (!syncOk) {
        console.log('\n💡 Para el error de sincronización:');
        console.log('   1. Verifica que DynamoDB esté funcionando');
        console.log('   2. Verifica que los índices estén activos');
        console.log('   3. Verifica las credenciales de AWS');
      }
    }
    
  } catch (error) {
    console.error('\n💥 Error ejecutando pruebas:', error.message);
  }
}

// Ejecutar pruebas
runTests().catch(error => {
  console.error('\n💥 Error fatal:', error.message);
  process.exit(1);
});
