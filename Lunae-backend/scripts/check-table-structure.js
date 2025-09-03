import { DynamoDBClient, DescribeTableCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkTableStructure() {
  console.log('🔍 Verificando estructura de la tabla Lunea-chat...\n');
  
  try {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    // Paso 1: Describir la tabla
    console.log('📋 Paso 1: Describiendo estructura de la tabla...');
    const describeCommand = new DescribeTableCommand({
      TableName: 'Lunea-chat'
    });
    
    const describeResponse = await client.send(describeCommand);
    const table = describeResponse.Table;
    
    console.log(`✅ Tabla: ${table.TableName}`);
    console.log(`📊 Estado: ${table.TableStatus}`);
    console.log(`🔑 Clave primaria: ${table.KeySchema.map(key => `${key.AttributeName} (${key.KeyType})`).join(', ')}`);
    
    if (table.GlobalSecondaryIndexes) {
      console.log(`📚 Índices secundarios: ${table.GlobalSecondaryIndexes.length}`);
      table.GlobalSecondaryIndexes.forEach((index, i) => {
        console.log(`   ${i + 1}. ${index.IndexName}: ${index.KeySchema.map(key => `${key.AttributeName} (${key.KeyType})`).join(', ')}`);
      });
    }
    
    // Paso 2: Escanear algunos elementos para ver la estructura
    console.log('\n📋 Paso 2: Escaneando elementos de la tabla...');
    const scanCommand = new ScanCommand({
      TableName: 'Lunea-chat',
      Limit: 3
    });
    
    const scanResponse = await client.send(scanCommand);
    console.log(`📊 Elementos encontrados: ${scanResponse.Items.length}`);
    
    if (scanResponse.Items.length > 0) {
      console.log('\n📄 Estructura de los elementos:');
      scanResponse.Items.forEach((item, i) => {
        console.log(`\n   Elemento ${i + 1}:`);
        Object.keys(item).forEach(key => {
          const value = item[key];
          const type = Object.keys(value)[0];
          const actualValue = value[type];
          console.log(`     ${key}: ${type} = ${actualValue}`);
        });
      });
    }
    
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.log('\n❌ Error:');
    console.log(`   Tipo: ${error.name}`);
    console.log(`   Mensaje: ${error.message}`);
  }
}

checkTableStructure().catch(console.error);
