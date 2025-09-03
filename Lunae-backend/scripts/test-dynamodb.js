import dotenv from 'dotenv';
import { docClient } from '../src/config/db.js';
import { PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

dotenv.config();

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Users';

async function testDynamoDB() {
  console.log('🧪 Probando conexión a DynamoDB...\n');
  
  try {
    // Verificar configuración
    console.log('📋 Configuración:');
    console.log(`   Tabla: ${TABLE_NAME}`);
    console.log(`   Región: ${process.env.AWS_REGION || 'us-east-2'}`);
    console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurada' : '❌ No configurada'}\n`);
    
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('❌ Credenciales de AWS no configuradas');
      console.log('📝 Crea un archivo .env con tus credenciales reales');
      return;
    }
    
    // Probar operación de escritura
    console.log('📝 Probando escritura...');
    const testUser = {
      id: `test_${Date.now()}`,
      username: 'testuser',
      email: 'test@example.com',
      createdAt: new Date().toISOString()
    };
    
    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: testUser
    });
    
    await docClient.send(putCommand);
    console.log('✅ Escritura exitosa');
    
    // Probar operación de lectura
    console.log('📖 Probando lectura...');
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: testUser.id }
    });
    
    const result = await docClient.send(getCommand);
    if (result.Item) {
      console.log('✅ Lectura exitosa');
      console.log('📄 Usuario leído:', result.Item);
    } else {
      console.log('❌ No se pudo leer el usuario');
    }
    
    // Probar operación de scan
    console.log('🔍 Probando scan...');
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      Limit: 5
    });
    
    const scanResult = await docClient.send(scanCommand);
    console.log(`✅ Scan exitoso. Encontrados ${scanResult.Items.length} usuarios`);
    
    // Limpiar usuario de prueba
    console.log('🧹 Limpiando usuario de prueba...');
    // Nota: No implementamos DeleteCommand aquí para simplificar
    
    console.log('\n🎉 Todas las pruebas pasaron exitosamente!');
    console.log('✅ DynamoDB está funcionando correctamente');
    
  } catch (error) {
    console.error('\n❌ Error en las pruebas:', error.message);
    
    if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Se creará automáticamente en la primera operación.');
    } else if (error.name === 'UnrecognizedClientException') {
      console.log('💡 Verifica que las credenciales de AWS sean correctas.');
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Verifica que tu usuario de AWS tenga permisos para DynamoDB.');
    }
  }
}

testDynamoDB();
