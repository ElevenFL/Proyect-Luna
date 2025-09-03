import dotenv from 'dotenv';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/Users.js';

dotenv.config();

async function verifySetup() {
  console.log('🔍 Verificando configuración del proyecto Lunae...\n');
  
  try {
    // Verificar variables de entorno
    console.log('📋 Verificando variables de entorno:');
    console.log(`   PORT: ${process.env.PORT || '3000 (por defecto)'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development (por defecto)'}`);
    console.log(`   DYNAMODB_TABLE_NAME: ${process.env.DYNAMODB_TABLE_NAME || 'Users (por defecto)'}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-2 (por defecto)'}`);
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Configurada' : '❌ No configurada'}\n`);
    
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('❌ Error: AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY son requeridos');
      console.log('📝 Crea un archivo .env basado en env.template con tus credenciales reales');
      return;
    }
    
    if (!process.env.JWT_SECRET) {
      console.log('❌ Error: JWT_SECRET es requerido');
      console.log('📝 Configura un JWT_SECRET seguro en tu archivo .env');
      return;
    }
    
    // Verificar credenciales por defecto
    if (process.env.AWS_ACCESS_KEY_ID === 'TU_ACCESS_KEY_AWS_AQUI' || 
        process.env.AWS_SECRET_ACCESS_KEY === 'TU_SECRET_KEY_AWS_AQUI') {
      console.log('❌ Error: Estás usando credenciales por defecto');
      console.log('📝 Reemplaza las credenciales con tus credenciales reales de AWS');
      return;
    }
    
    if (process.env.JWT_SECRET === 'tu_jwt_secret_super_seguro_aqui') {
      console.log('❌ Error: Estás usando JWT_SECRET por defecto');
      console.log('📝 Configura un JWT_SECRET seguro y único');
      return;
    }
    
    console.log('✅ Variables de entorno configuradas correctamente\n');
    
    // Probar conexión a DynamoDB
    console.log('🔌 Probando conexión a DynamoDB...');
    await connectDB();
    console.log('✅ Conexión a DynamoDB exitosa\n');
    
    // Probar creación de tabla
    console.log('📋 Verificando tabla de usuarios...');
    await User.ensureTableExists();
    console.log('✅ Tabla de usuarios verificada\n');
    
    // Probar operaciones básicas
    console.log('🧪 Probando operaciones básicas...');
    
    // Crear usuario de prueba
    const testUserData = {
      username: 'verify_user_' + Date.now(),
      email: 'verify_' + Date.now() + '@example.com',
      password: 'VerifyPass123',
      displayName: 'Usuario de Verificación'
    };
    
    const testUser = await User.create(testUserData);
    console.log('✅ Usuario de prueba creado:', testUser.id);
    
    // Buscar usuario
    const foundUser = await User.findById(testUser.id);
    if (foundUser) {
      console.log('✅ Usuario encontrado por ID');
    } else {
      console.log('❌ Usuario no encontrado por ID');
    }
    
    // Buscar por email
    const userByEmail = await User.findByEmail(testUserData.email);
    if (userByEmail) {
      console.log('✅ Usuario encontrado por email');
    } else {
      console.log('❌ Usuario no encontrado por email');
    }
    
    // Listar usuarios
    const allUsers = await User.find();
    console.log(`✅ Encontrados ${allUsers.length} usuarios en total`);
    
    // Actualizar usuario
    await testUser.update({ displayName: 'Usuario Verificado' });
    console.log('✅ Usuario actualizado exitosamente');
    
    // Eliminar usuario de prueba
    await testUser.delete();
    console.log('✅ Usuario de prueba eliminado');
    
    console.log('\n🎉 ¡Configuración verificada exitosamente!');
    console.log('✅ El proyecto está listo para usar');
    console.log('✅ DynamoDB está funcionando correctamente');
    console.log('✅ Todas las operaciones básicas funcionan');
    
  } catch (error) {
    console.error('\n❌ Error en la verificación:', error.message);
    
    if (error.name === 'UnrecognizedClientException') {
      console.log('💡 Verifica que las credenciales de AWS sean correctas');
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Verifica que tu usuario de AWS tenga permisos para DynamoDB');
    } else if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Se creará automáticamente.');
    } else if (error.name === 'ValidationException') {
      console.log('💡 Error de validación en los datos');
    }
    
    console.log('\n📝 Pasos para solucionar:');
    console.log('1. Verifica que tu archivo .env esté configurado correctamente');
    console.log('2. Asegúrate de que las credenciales de AWS sean válidas');
    console.log('3. Verifica que tu usuario de AWS tenga permisos para DynamoDB');
    console.log('4. Ejecuta: npm run setup-dynamodb');
  }
}

verifySetup();
