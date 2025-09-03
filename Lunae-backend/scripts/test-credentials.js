import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function testCredentials() {
  console.log('🔍 Probando credenciales de AWS...\n');
  
  // Mostrar configuración
  console.log('📋 Configuración actual:');
  console.log(`   Región: ${process.env.AWS_REGION || 'No configurada'}`);
  console.log(`   Access Key: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Configurada' : '❌ No configurada'}`);
  console.log(`   Secret Key: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurada' : '❌ No configurada'}`);
  console.log(`   Tabla: ${process.env.DYNAMODB_TABLE_NAME || 'No configurada'}\n`);
  
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('❌ Error: Credenciales de AWS no configuradas');
    return;
  }
  
  try {
    // Crear cliente DynamoDB
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    console.log('🔌 Cliente DynamoDB creado exitosamente');
    
    // Probar conexión listando tablas
    console.log('📋 Probando conexión...');
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    
    console.log('✅ Conexión exitosa a DynamoDB!');
    console.log(`📊 Tablas disponibles: ${response.TableNames.length}`);
    
    if (response.TableNames.length > 0) {
      console.log('📋 Tablas:');
      response.TableNames.forEach(table => {
        console.log(`   - ${table}`);
      });
    }
    
    // Verificar si existe la tabla específica
    const targetTable = process.env.DYNAMODB_TABLE_NAME || 'Lunea-chat';
    if (response.TableNames.includes(targetTable)) {
      console.log(`\n✅ La tabla '${targetTable}' existe`);
    } else {
      console.log(`\n⚠️ La tabla '${targetTable}' NO existe`);
      console.log('💡 Se creará automáticamente en la primera operación');
    }
    
  } catch (error) {
    console.log('\n❌ Error de conexión:');
    console.log(`   Tipo: ${error.name}`);
    console.log(`   Mensaje: ${error.message}`);
    
    if (error.name === 'InvalidClientTokenId') {
      console.log('\n💡 Solución: Las credenciales de AWS no son válidas');
      console.log('   - Verifica que las Access Key y Secret Key sean correctas');
      console.log('   - Asegúrate de que no hayan expirado');
      console.log('   - Verifica que el usuario tenga permisos para DynamoDB');
    } else if (error.name === 'AccessDeniedException') {
      console.log('\n💡 Solución: Permisos insuficientes');
      console.log('   - Verifica que el usuario tenga permisos para DynamoDB');
      console.log('   - Asegúrate de que la política IAM esté adjunta al usuario');
    } else if (error.name === 'UnrecognizedClientException') {
      console.log('\n💡 Solución: Error de configuración del cliente');
      console.log('   - Verifica que la región sea correcta');
      console.log('   - Asegúrate de que las credenciales estén bien formateadas');
    }
  }
}

testCredentials().catch(console.error);
