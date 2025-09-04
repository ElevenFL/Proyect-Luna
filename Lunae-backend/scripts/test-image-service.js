#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const BACKEND_URL = 'http://localhost:3000';

console.log('🧪 Probando servicio de imágenes después de la corrección...');
console.log('🌐 URL del backend:', BACKEND_URL);

async function testImageService() {
  try {
    console.log('\n📡 1. Probando endpoint de health...');
    const healthResponse = await fetch(`${BACKEND_URL}/health`);
    
    if (healthResponse.ok) {
      console.log('✅ Health check exitoso');
    } else {
      console.log('❌ Health check falló:', healthResponse.status);
      return false;
    }
    
    console.log('\n📡 2. Probando endpoint de imágenes...');
    
    // Probar el endpoint de listar imágenes (requiere autenticación)
    console.log('ℹ️ Endpoint de imágenes requiere autenticación - se probará después del login');
    
    console.log('\n📡 3. Probando endpoint de perfil...');
    
    // Crear un usuario de prueba para probar la funcionalidad completa
    const timestamp = Date.now();
    const createData = {
      username: `image_test_user_${timestamp}`,
      email: `imagetest${timestamp}@example.com`,
      password: 'TestPassword123',
      displayName: `Usuario Prueba Imagen ${timestamp}`
    };
    
    const createResponse = await fetch(`${BACKEND_URL}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createData)
    });
    
    if (createResponse.ok) {
      console.log('✅ Usuario de prueba creado para test de imágenes');
      
      // Hacer login
      const loginData = {
        usernameOrEmail: createData.email,
        password: 'TestPassword123'
      };
      
      const loginResponse = await fetch(`${BACKEND_URL}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
      });
      
      if (loginResponse.ok) {
        const loginResult = await loginResponse.json();
        console.log('✅ Login exitoso para test de imágenes');
        
        // Probar actualización de perfil con imagen
        const profileData = {
          profileImage: 'https://via.placeholder.com/150x150/FFD700/000000?text=Test'
        };
        
        const profileResponse = await fetch(`${BACKEND_URL}/api/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginResult.token}`
          },
          body: JSON.stringify(profileData)
        });
        
        if (profileResponse.ok) {
          console.log('✅ Actualización de perfil con imagen exitosa');
          
          // Ahora probar el endpoint de imágenes con el token
          console.log('\n📡 4. Probando endpoint de imágenes con autenticación...');
          const listResponse = await fetch(`${BACKEND_URL}/api/images/list`, {
            headers: {
              'Authorization': `Bearer ${loginResult.token}`
            }
          });
          
          if (listResponse.ok) {
            const listData = await listResponse.json();
            console.log('✅ Endpoint de imágenes funcionando:', listData);
          } else {
            const errorData = await listResponse.json();
            console.log('❌ Error en endpoint de imágenes:', listResponse.status, errorData);
          }
          
        } else {
          const errorData = await profileResponse.json();
          console.log('❌ Error actualizando perfil con imagen:', errorData);
        }
        
      } else {
        const errorData = await loginResponse.json();
        console.log('❌ Error en login para test de imágenes:', loginResponse.status);
        console.log('📄 Detalles del error:', errorData);
      }
      
    } else {
      const errorData = await createResponse.json();
      console.log('❌ Error creando usuario para test de imágenes:', createResponse.status);
      console.log('📄 Detalles del error:', errorData);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    return false;
  }
}

async function runTest() {
  try {
    console.log('🚀 Iniciando prueba del servicio de imágenes...\n');
    
    const success = await testImageService();
    
    if (success) {
      console.log('\n🎉 ¡Prueba del servicio de imágenes completada!');
      console.log('📱 Ahora puedes probar la subida de imágenes en la aplicación móvil.');
      console.log('\n💡 Si todo funciona correctamente, no deberías ver más errores de "Property Image doesn\'t exist"');
    } else {
      console.log('\n⚠️ La prueba falló. Revisa los errores arriba.');
    }
    
  } catch (error) {
    console.error('\n💥 Error fatal:', error.message);
  }
}

// Ejecutar prueba
runTest().catch(error => {
  console.error('\n💥 Error fatal:', error.message);
  process.exit(1);
});
