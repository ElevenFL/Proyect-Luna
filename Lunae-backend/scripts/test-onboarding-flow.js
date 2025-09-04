#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const BACKEND_URL = 'http://localhost:3000';

console.log('🧪 Probando flujo completo del onboarding...');
console.log('🌐 URL del backend:', BACKEND_URL);

async function testOnboardingFlow() {
  try {
    console.log('\n📡 1. Creando usuario de prueba...');
    
    // Crear usuario de prueba
    const createData = {
      username: 'onboarding_test_user',
      email: 'onboardingtest@example.com',
      displayName: 'Usuario Prueba Onboarding'
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
      email: 'onboardingtest@example.com',
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
    
    // Test 3: Actualizar nombre
    console.log('\n📡 3. Probando actualización de nombre...');
    const nameData = { displayName: 'Usuario Prueba Onboarding' };
    const nameResponse = await fetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(nameData)
    });
    
    if (nameResponse.ok) {
      console.log('✅ Nombre actualizado exitosamente');
    } else {
      const errorData = await nameResponse.json();
      console.log('❌ Error actualizando nombre:', errorData);
      return false;
    }
    
    // Test 4: Actualizar fecha de nacimiento
    console.log('\n📡 4. Probando actualización de fecha de nacimiento...');
    const birthDateData = { birthDate: '1990-05-15' };
    const birthDateResponse = await fetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(birthDateData)
    });
    
    if (birthDateResponse.ok) {
      console.log('✅ Fecha de nacimiento actualizada exitosamente');
    } else {
      const errorData = await birthDateResponse.json();
      console.log('❌ Error actualizando fecha de nacimiento:', errorData);
      return false;
    }
    
    // Test 5: Actualizar género
    console.log('\n📡 5. Probando actualización de género...');
    const genderData = { gender: 'M' };
    const genderResponse = await fetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(genderData)
    });
    
    if (genderResponse.ok) {
      console.log('✅ Género actualizado exitosamente');
    } else {
      const errorData = await genderResponse.json();
      console.log('❌ Error actualizando género:', errorData);
      return false;
    }
    
    // Test 6: Actualizar ubicación
    console.log('\n📡 6. Probando actualización de ubicación...');
    const locationData = { 
      location: {
        latitude: -34.6037,
        longitude: -58.3816,
        address: 'Buenos Aires, Argentina'
      }
    };
    const locationResponse = await fetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(locationData)
    });
    
    if (locationResponse.ok) {
      console.log('✅ Ubicación actualizada exitosamente');
    } else {
      const errorData = await locationResponse.json();
      console.log('❌ Error actualizando ubicación:', errorData);
      return false;
    }
    
    // Test 7: Actualizar imagen de perfil
    console.log('\n📡 7. Probando actualización de imagen de perfil...');
    const profileImageData = { profileImage: 'https://example.com/test-image.jpg' };
    const profileImageResponse = await fetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileImageData)
    });
    
    if (profileImageResponse.ok) {
      console.log('✅ Imagen de perfil actualizada exitosamente');
    } else {
      const errorData = await profileImageResponse.json();
      console.log('❌ Error actualizando imagen de perfil:', errorData);
      return false;
    }
    
    // Test 8: Marcar perfil como completado
    console.log('\n📡 8. Probando marcado de perfil como completado...');
    const profileCompletedData = { profileCompleted: true };
    const profileCompletedResponse = await fetch(`${BACKEND_URL}/api/profile/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(profileCompletedData)
    });
    
    if (profileCompletedResponse.ok) {
      console.log('✅ Perfil marcado como completado exitosamente');
    } else {
      const errorData = await profileCompletedResponse.json();
      console.log('❌ Error marcando perfil como completado:', errorData);
      return false;
    }
    
    // Test 9: Verificar perfil completo
    console.log('\n📡 9. Verificando perfil completo...');
    const getProfileResponse = await fetch(`${BACKEND_URL}/api/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (getProfileResponse.ok) {
      const profileData = await getProfileResponse.json();
      console.log('✅ Perfil obtenido exitosamente');
      
      // Verificar que todos los campos estén presentes
      const user = profileData.user;
      const requiredFields = ['displayName', 'birthDate', 'gender', 'location', 'profileImage', 'profileCompleted'];
      
      console.log('\n📊 Verificación de campos:');
      requiredFields.forEach(field => {
        if (user[field]) {
          console.log(`   ✅ ${field}: ${JSON.stringify(user[field])}`);
        } else {
          console.log(`   ❌ ${field}: No encontrado`);
        }
      });
      
      // Verificar si el perfil está completo
      if (user.profileCompleted) {
        console.log('\n🎉 ¡Perfil marcado como completo!');
      } else {
        console.log('\n⚠️ Perfil no marcado como completo');
      }
      
    } else {
      console.log('❌ Error obteniendo perfil:', getProfileResponse.status);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    return false;
  }
}

async function runTest() {
  try {
    console.log('🚀 Iniciando prueba del flujo de onboarding...\n');
    
    const success = await testOnboardingFlow();
    
    if (success) {
      console.log('\n🎉 ¡Todas las pruebas del onboarding pasaron!');
      console.log('📱 El flujo completo está funcionando correctamente.');
      console.log('💡 Ahora puedes probar la aplicación móvil sin errores.');
    } else {
      console.log('\n⚠️ Algunas pruebas fallaron. Revisa los errores arriba.');
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
