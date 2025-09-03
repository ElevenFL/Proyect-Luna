import dotenv from 'dotenv';
import { User } from '../src/models/Users.js';

dotenv.config();

async function testUserCreation() {
  console.log('🧪 Probando creación de usuarios en DynamoDB...\n');
  
  try {
    // Verificar configuración
    console.log('📋 Configuración:');
    console.log(`   Tabla: ${process.env.DYNAMODB_TABLE_NAME || 'Users'}`);
    console.log(`   Región: ${process.env.AWS_REGION || 'us-east-2'}`);
    console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurada' : '❌ No configurada'}\n`);
    
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('❌ Credenciales de AWS no configuradas');
      console.log('📝 Crea un archivo .env con tus credenciales reales');
      return;
    }
    
    // Probar creación de usuario
    console.log('👤 Probando creación de usuario...');
    const testUserData = {
      username: 'testuser_' + Date.now(),
      email: 'test_' + Date.now() + '@example.com',
      password: 'TestPassword123',
      displayName: 'Usuario de Prueba',
      birthDate: new Date('1990-01-01'),
      gender: 'other',
      location: 'Ciudad de Prueba'
    };
    
    const newUser = await User.create(testUserData);
    console.log('✅ Usuario creado exitosamente');
    console.log('📄 Datos del usuario:', {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      displayName: newUser.displayName,
      profileCompleted: newUser.profileCompleted
    });
    
    // Probar búsqueda del usuario creado
    console.log('\n🔍 Probando búsqueda del usuario...');
    const foundUser = await User.findById(newUser.id);
    if (foundUser) {
      console.log('✅ Usuario encontrado por ID');
      console.log('📄 Datos encontrados:', {
        id: foundUser.id,
        username: foundUser.username,
        email: foundUser.email,
        displayName: foundUser.displayName
      });
    } else {
      console.log('❌ Usuario no encontrado por ID');
    }
    
    // Probar búsqueda por email
    console.log('\n📧 Probando búsqueda por email...');
    const userByEmail = await User.findByEmail(testUserData.email);
    if (userByEmail) {
      console.log('✅ Usuario encontrado por email');
    } else {
      console.log('❌ Usuario no encontrado por email');
    }
    
    // Probar búsqueda por username
    console.log('\n👤 Probando búsqueda por username...');
    const userByUsername = await User.findByUsername(testUserData.username);
    if (userByUsername) {
      console.log('✅ Usuario encontrado por username');
    } else {
      console.log('❌ Usuario no encontrado por username');
    }
    
    // Probar listado de usuarios
    console.log('\n📋 Probando listado de usuarios...');
    const allUsers = await User.find();
    console.log(`✅ Encontrados ${allUsers.length} usuarios en total`);
    
    // Probar actualización del usuario
    console.log('\n✏️ Probando actualización del usuario...');
    const updateData = {
      displayName: 'Usuario de Prueba Actualizado',
      location: 'Nueva Ciudad de Prueba'
    };
    
    await foundUser.update(updateData);
    console.log('✅ Usuario actualizado exitosamente');
    
    // Verificar la actualización
    const updatedUser = await User.findById(newUser.id);
    console.log('📄 Datos actualizados:', {
      displayName: updatedUser.displayName,
      location: updatedUser.location,
      updatedAt: updatedUser.updatedAt
    });
    
    console.log('\n🎉 Todas las pruebas pasaron exitosamente!');
    console.log('✅ La creación y gestión de usuarios está funcionando correctamente');
    
  } catch (error) {
    console.error('\n❌ Error en las pruebas:', error.message);
    
    if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Se creará automáticamente en la primera operación.');
    } else if (error.name === 'UnrecognizedClientException') {
      console.log('💡 Verifica que las credenciales de AWS sean correctas.');
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Verifica que tu usuario de AWS tenga permisos para DynamoDB.');
    } else if (error.name === 'ValidationException') {
      console.log('💡 Error de validación en los datos del usuario.');
    }
  }
}

testUserCreation();
