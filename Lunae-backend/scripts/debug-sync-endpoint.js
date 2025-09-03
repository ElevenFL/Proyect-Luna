import { User } from '../src/models/Users.js';
import dotenv from 'dotenv';

dotenv.config();

async function debugSyncEndpoint() {
  console.log('🔍 Depurando endpoint de sincronización...\n');
  
  try {
    // Paso 1: Verificar que la tabla existe
    console.log('📋 Paso 1: Verificando que la tabla existe...');
    await User.ensureTableExists();
    console.log('✅ Tabla verificada\n');
    
    // Paso 2: Probar búsqueda de usuario existente
    console.log('📋 Paso 2: Probando búsqueda de usuario existente...');
    const testEmail = 'test@example.com';
    const existingUser = await User.findByEmail(testEmail);
    console.log(`✅ Búsqueda completada. Usuario encontrado: ${existingUser ? 'Sí' : 'No'}\n`);
    
    // Paso 3: Probar creación de usuario nuevo
    console.log('📋 Paso 3: Probando creación de usuario nuevo...');
    const newUserData = {
      username: 'testuser123',
      email: 'testuser123@example.com',
      amplifySub: 'test123456',
      active: true,
      profileCompleted: false
    };
    
    const newUser = await User.create(newUserData);
    console.log(`✅ Usuario creado exitosamente: ${newUser.id}\n`);
    
    // Paso 4: Probar actualización de usuario
    console.log('📋 Paso 4: Probando actualización de usuario...');
    await newUser.update({ profileCompleted: true });
    console.log('✅ Usuario actualizado exitosamente\n');
    
    // Paso 5: Probar búsqueda del usuario actualizado
    console.log('📋 Paso 5: Probando búsqueda del usuario actualizado...');
    const updatedUser = await User.findByEmail('testuser123@example.com');
    console.log(`✅ Usuario encontrado: ${updatedUser ? 'Sí' : 'No'}`);
    if (updatedUser) {
      console.log(`   Profile completed: ${updatedUser.profileCompleted}`);
    }
    
    console.log('\n🎉 Todas las pruebas pasaron exitosamente!');
    
  } catch (error) {
    console.log('\n❌ Error en las pruebas:');
    console.log(`   Tipo: ${error.name}`);
    console.log(`   Mensaje: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    
    // Análisis del error
    if (error.name === 'ValidationError') {
      console.log('\n💡 Error de validación - Verifica los datos de entrada');
    } else if (error.name === 'ResourceNotFoundException') {
      console.log('\n💡 La tabla no existe - Verifica la configuración de DynamoDB');
    } else if (error.name === 'AccessDeniedException') {
      console.log('\n💡 Error de permisos - Verifica la política IAM');
    } else if (error.name === 'ConditionalCheckFailedException') {
      console.log('\n💡 Error de condición - Verifica la lógica de negocio');
    }
  }
}

debugSyncEndpoint().catch(console.error);
