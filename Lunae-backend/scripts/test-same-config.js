import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function testSameConfig() {
  console.log('🔍 Probando con la misma configuración que funciona...\n');
  
  try {
    // Usar exactamente la misma configuración que funciona en test-credentials.js
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    console.log('🔌 Cliente DynamoDB creado exitosamente');
    
    // Probar listar tablas (esto funciona)
    console.log('📋 Probando listar tablas...');
    const listCommand = new ListTablesCommand({});
    const listResponse = await client.send(listCommand);
    console.log('✅ Listar tablas exitoso');
    console.log(`📊 Tablas disponibles: ${listResponse.TableNames.length}\n`);
    
    // Probar describir tabla específica (esto es lo que falla en Users.js)
    console.log('📋 Probando describir tabla específica...');
    const tableName = process.env.DYNAMODB_TABLE_NAME || 'Lunea-chat';
    const describeCommand = new DescribeTableCommand({
      TableName: tableName
    });
    
    const describeResponse = await client.send(describeCommand);
    console.log('✅ Describir tabla exitoso');
    console.log(`📋 Tabla: ${describeResponse.Table.TableName}`);
    console.log(`📊 Estado: ${describeResponse.Table.TableStatus}`);
    
  } catch (error) {
    console.log('\n❌ Error en las pruebas:');
    console.log(`   Tipo: ${error.name}`);
    console.log(`   Mensaje: ${error.message}`);
    
    if (error.name === 'InvalidClientTokenId') {
      console.log('\n💡 Las credenciales no son válidas');
    } else if (error.name === 'AccessDeniedException') {
      console.log('\n💡 Error de permisos');
    } else if (error.name === 'ResourceNotFoundException') {
      console.log('\n💡 La tabla no existe');
    }
  }
}

testSameConfig().catch(console.error);
