#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const BACKEND_URL = 'http://localhost:3000';

console.log('🧪 Probando actualización de perfil con birthDate...');
console.log('🌐 URL del backend:', BACKEND_URL);

async function testProfileUpdate() {
  try {
    console.log('\n📡 1. Creando usuario de prueba...');
    
    // Crear usuario de prueba
    const createData = {
      username: 'test_profile_user',
      email: 'testprofile@example.com',
      displayName: 'Usuario Prueba Perfil'
    };
    
    const createResponse = await fetch(`${BACKEND_URL}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createData)
    });
    
    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.log('❌ Error creando usuario:', errorData);
      return false;
    }
    
    const createResult = await createResponse.json();
    console.log('✅ Usuario creado:', createResult.user.id);
    
    // Hacer login para obtener token
    console.log('\n📡 2. Haciendo login...');
    const loginData = {
      email: 'testprofile@example.com',
      password: 'testpassword123'
    };
    
    const loginResponse = await fetch(`${BACKEND_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData)
    });
    
    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.log('❌ Error en login:', errorData);
      return false;
    }
    
    const loginResult = await loginResponse.json();
    const token = loginResult.token;
    console.log('✅ Login exitoso, token obtenido');
    
    // Probar actualización de perfil con birthDate
    console.log('\n📡 3. Probando actualización de perfil con birthDate...');
    
    const profileData = {
      birthDate: '1990-05-15',
      gender: 'M',
      location: 'Buenos Aires, Argentina'
    };
    
    const profileResponse = await fetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileData)
    });
    
    if (profileResponse.ok) {
      const profileResult = await profileResponse.json();
      console.log('✅ Perfil actualizado exitosamente:', profileResult);
      
      // Verificar que los datos se guardaron correctamente
      console.log('\n📡 4. Verificando datos guardados...');
      const getProfileResponse = await fetch(`${BACKEND_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (getProfileResponse.ok) {
        const profileData = await getProfileResponse.json();
        console.log('✅ Datos del perfil:', profileData.user);
        
        // Verificar campos específicos
        if (profileData.user.birthDate) {
          console.log('✅ birthDate guardado:', profileData.user.birthDate);
        } else {
          console.log('❌ birthDate no se guardó correctamente');
        }
        
        if (profileData.user.gender) {
          console.log('✅ gender guardado:', profileData.user.gender);
        } else {
          console.log('❌ gender no se guardó correctamente');
        }
        
        if (profileData.user.location) {
          console.log('✅ location guardado:', profileData.user.location);
        } else {
          console.log('❌ location no se guardó correctamente');
        }
        
      } else {
        console.log('❌ Error obteniendo perfil:', getProfileResponse.status);
      }
      
    } else {
      const errorData = await profileResponse.json();
      console.log('❌ Error actualizando perfil:', profileResponse.status);
      console.log('📄 Detalles del error:', errorData);
      
      // Mostrar información específica del error
      if (errorData.error === 'DB_VALIDATION_ERROR') {
        console.log('🔍 Error de validación en la base de datos');
        console.log('💡 Verifica que los índices estén funcionando correctamente');
      } else if (errorData.error === 'INVALID_BIRTH_DATE') {
        console.log('🔍 Error en la fecha de nacimiento');
        console.log('💡 Verifica el formato de la fecha');
      } else if (errorData.error === 'SERVER_ERROR') {
        console.log('🔍 Error interno del servidor');
        console.log('💡 Revisa los logs del backend para más detalles');
      }
    }
    
    return profileResponse.ok;
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    return false;
  }
}

async function runTest() {
  try {
    console.log('🚀 Iniciando prueba de actualización de perfil...\n');
    
    const success = await testProfileUpdate();
    
    if (success) {
      console.log('\n🎉 ¡Prueba exitosa! La actualización de perfil funciona correctamente.');
      console.log('📱 Ahora puedes probar la aplicación móvil sin errores.');
    } else {
      console.log('\n⚠️ La prueba falló. Revisa los errores arriba.');
      console.log('\n💡 Posibles soluciones:');
      console.log('   1. Verifica que el backend esté corriendo');
      console.log('   2. Verifica que DynamoDB esté funcionando');
      console.log('   3. Verifica que los índices estén activos');
      console.log('   4. Revisa los logs del backend para más detalles');
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
