import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Users';

async function createUsersTable() {
  try {
    console.log('🚀 Creando tabla de usuarios en DynamoDB...');
    
    // Crear tabla principal
    const createTableCommand = new CreateTableCommand({
      TableName: TABLE_NAME,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' } // Partition key
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
        { AttributeName: 'username', AttributeType: 'S' },
        { AttributeName: 'amplifySub', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand billing
      GlobalSecondaryIndexes: [
        {
          IndexName: 'email-index',
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          }
        },
        {
          IndexName: 'username-index',
          KeySchema: [
            { AttributeName: 'username', KeyType: 'HASH' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          }
        },
        {
          IndexName: 'amplify-sub-index',
          KeySchema: [
            { AttributeName: 'amplifySub', KeyType: 'HASH' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          }
        }
      ]
    });

    await dynamoClient.send(createTableCommand);
    console.log(`✅ Tabla '${TABLE_NAME}' creada exitosamente`);
    
    // Esperar a que la tabla esté activa
    console.log('⏳ Esperando a que la tabla esté activa...');
    await waitForTableActive(TABLE_NAME);
    console.log('✅ Tabla está activa y lista para usar');
    
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`ℹ️ La tabla '${TABLE_NAME}' ya existe`);
      // Verificar si la tabla está activa
      try {
        await waitForTableActive(TABLE_NAME);
        console.log('✅ Tabla existente está activa');
      } catch (waitError) {
        console.log('⚠️ Tabla existente pero no está activa');
      }
    } else {
      console.error('❌ Error creando tabla:', error);
      throw error;
    }
  }
}

async function waitForTableActive(tableName) {
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const describeCommand = new DescribeTableCommand({
        TableName: tableName
      });
      
      const { Table } = await dynamoClient.send(describeCommand);
      
      if (Table.TableStatus === 'ACTIVE') {
        return true;
      }
      
      console.log(`⏳ Estado de la tabla: ${Table.TableStatus}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      attempts++;
      
    } catch (error) {
      console.error('Error verificando estado de la tabla:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Timeout esperando que la tabla esté activa');
}

async function main() {
  try {
    console.log('🔧 Configurando DynamoDB para el proyecto Lunae...');
    
    // Verificar variables de entorno
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('❌ Error: AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY son requeridos');
      process.exit(1);
    }
    
    await createUsersTable();
    
    console.log('🎉 Configuración de DynamoDB completada exitosamente!');
    console.log(`📋 Tabla: ${TABLE_NAME}`);
    console.log(`🌍 Región: ${process.env.AWS_REGION || 'us-east-2'}`);
    
  } catch (error) {
    console.error('❌ Error en la configuración:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createUsersTable };
