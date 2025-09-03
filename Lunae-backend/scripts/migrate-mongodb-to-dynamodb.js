import mongoose from 'mongoose';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// Configurar cliente de DynamoDB
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Configurar MongoDB (solo para lectura)
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lunae';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB para migración');
  } catch (err) {
    console.error('❌ Error conectando a MongoDB:', err);
    throw err;
  }
};

// Schema de MongoDB para lectura
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  displayName: String,
  birthDate: Date,
  gender: String,
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  profileImage: String,
  profileImageKey: String,
  profileCompleted: Boolean,
  passwordChangedAt: Date,
  active: Boolean,
  lastLogin: Date,
  loginAttempts: Number,
  lockUntil: Date
}, {
  timestamps: true
});

const MongoUser = mongoose.model('User', userSchema);

// Función para migrar un usuario
const migrateUser = (mongoUser) => {
  return {
    id: mongoUser._id.toString(), // Convertir ObjectId a string
    username: mongoUser.username,
    email: mongoUser.email,
    password: mongoUser.password, // Ya está hasheada
    displayName: mongoUser.displayName,
    birthDate: mongoUser.birthDate ? mongoUser.birthDate.toISOString() : undefined,
    gender: mongoUser.gender,
    location: mongoUser.location,
    profileImage: mongoUser.profileImage,
    profileImageKey: mongoUser.profileImageKey,
    profileCompleted: mongoUser.profileCompleted || false,
    passwordChangedAt: mongoUser.passwordChangedAt ? mongoUser.passwordChangedAt.toISOString() : undefined,
    active: mongoUser.active !== undefined ? mongoUser.active : true,
    lastLogin: mongoUser.lastLogin ? mongoUser.lastLogin.toISOString() : undefined,
    loginAttempts: mongoUser.loginAttempts || 0,
    lockUntil: mongoUser.lockUntil ? mongoUser.lockUntil.toISOString() : undefined,
    createdAt: mongoUser.createdAt ? mongoUser.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: mongoUser.updatedAt ? mongoUser.updatedAt.toISOString() : new Date().toISOString()
  };
};

// Función para escribir usuarios en lotes
const writeUsersBatch = async (users) => {
  if (users.length === 0) return;

  const writeRequests = users.map(user => ({
    PutRequest: {
      Item: user
    }
  }));

  const command = new BatchWriteCommand({
    RequestItems: {
      [process.env.DYNAMODB_TABLE_NAME || 'Users']: writeRequests
    }
  });

  try {
    await docClient.send(command);
    console.log(`✅ Lote de ${users.length} usuarios migrado exitosamente`);
  } catch (error) {
    console.error('❌ Error escribiendo lote:', error);
    
    // Si hay errores, intentar migrar uno por uno
    console.log('🔄 Intentando migración individual...');
    for (const user of users) {
      try {
        const putCommand = new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_NAME || 'Users',
          Item: user
        });
        await docClient.send(putCommand);
        console.log(`✅ Usuario ${user.username} migrado individualmente`);
      } catch (individualError) {
        console.error(`❌ Error migrando usuario ${user.username}:`, individualError);
      }
    }
  }
};

// Función principal de migración
const migrateUsers = async () => {
  try {
    console.log('🚀 Iniciando migración de usuarios de MongoDB a DynamoDB...');
    
    // Conectar a MongoDB
    await connectMongoDB();
    
    // Obtener todos los usuarios de MongoDB
    console.log('📖 Leyendo usuarios de MongoDB...');
    const mongoUsers = await MongoUser.find({});
    console.log(`📊 Encontrados ${mongoUsers.length} usuarios para migrar`);
    
    if (mongoUsers.length === 0) {
      console.log('ℹ️ No hay usuarios para migrar');
      return;
    }
    
    // Migrar usuarios en lotes de 25 (límite de DynamoDB)
    const batchSize = 25;
    const migratedUsers = [];
    
    for (let i = 0; i < mongoUsers.length; i++) {
      const mongoUser = mongoUsers[i];
      const dynamoUser = migrateUser(mongoUser);
      migratedUsers.push(dynamoUser);
      
      // Escribir lote cuando esté lleno o sea el último
      if (migratedUsers.length === batchSize || i === mongoUsers.length - 1) {
        await writeUsersBatch(migratedUsers);
        migratedUsers.length = 0; // Limpiar array
      }
    }
    
    console.log('🎉 Migración completada exitosamente!');
    console.log(`📊 Total de usuarios migrados: ${mongoUsers.length}`);
    
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    throw error;
  } finally {
    // Cerrar conexión a MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Conexión a MongoDB cerrada');
    }
  }
};

// Función para verificar la migración
const verifyMigration = async () => {
  try {
    console.log('🔍 Verificando migración...');
    
    // Contar usuarios en DynamoDB
    const { Count } = await docClient.send({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'Users'
    });
    
    console.log(`📊 Usuarios en DynamoDB: ${Count}`);
    
    // Verificar algunos usuarios específicos
    const { Items } = await docClient.send({
      TableName: process.env.DYNAMODB_TABLE_NAME || 'Users',
      Limit: 5
    });
    
    if (Items && Items.length > 0) {
      console.log('✅ Verificación exitosa - Usuarios encontrados en DynamoDB');
      console.log('📋 Ejemplos de usuarios migrados:');
      Items.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.email})`);
      });
    } else {
      console.log('⚠️ No se encontraron usuarios en DynamoDB');
    }
    
  } catch (error) {
    console.error('❌ Error verificando migración:', error);
  }
};

// Función principal
const main = async () => {
  try {
    console.log('🔧 Script de migración MongoDB → DynamoDB');
    console.log('==========================================');
    
    // Verificar variables de entorno
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('❌ Error: AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY son requeridos');
      process.exit(1);
    }
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI es requerido para la migración');
      process.exit(1);
    }
    
    // Ejecutar migración
    await migrateUsers();
    
    // Verificar migración
    await verifyMigration();
    
    console.log('🎉 Proceso de migración completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en el proceso de migración:', error);
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateUsers, verifyMigration };
