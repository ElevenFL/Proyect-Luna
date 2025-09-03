import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

async function createUsersTable() {
  console.log('🔧 Creando tabla específica para usuarios...\n');
  
  try {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    
    const tableName = 'Users';
    
    // Verificar si la tabla ya existe
    try {
      const describeCommand = new DescribeTableCommand({
        TableName: tableName
      });
      
      await client.send(describeCommand);
      console.log(`✅ La tabla '${tableName}' ya existe`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }
    
    // Crear la tabla
    console.log(`📋 Creando tabla '${tableName}'...`);
    const createCommand = new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' } // Clave primaria
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
      ],
      BillingMode: 'PAY_PER_REQUEST', // On-demand billing
      GlobalSecondaryIndexes: [
        {
          IndexName: 'email-index',
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
          ],
          AttributeDefinitions: [
            { AttributeName: 'email', AttributeType: 'S' }
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
          AttributeDefinitions: [
            { AttributeName: 'username', AttributeType: 'S' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          }
        },
        {
          IndexName: 'amplifySub-index',
          KeySchema: [
            { AttributeName: 'amplifySub', KeyType: 'HASH' }
          ],
          AttributeDefinitions: [
            { AttributeName: 'amplifySub', AttributeType: 'S' }
          ],
          Projection: {
            ProjectionType: 'ALL'
          }
        }
      ]
    });
    
    await client.send(createCommand);
    console.log(`✅ Tabla '${tableName}' creada exitosamente`);
    
    // Esperar a que la tabla esté activa
    console.log('⏳ Esperando a que la tabla esté activa...');
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      try {
        const describeCommand = new DescribeTableCommand({
          TableName: tableName
        });
        
        const { Table } = await client.send(describeCommand);
        
        if (Table.TableStatus === 'ACTIVE') {
          console.log('✅ Tabla está activa y lista para usar');
          break;
        }
        
        console.log(`⏳ Estado de la tabla: ${Table.TableStatus}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
      } catch (error) {
        console.error('Error verificando estado de la tabla:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Timeout esperando que la tabla esté activa');
    }
    
    console.log('\n🎉 Tabla de usuarios creada exitosamente!');
    console.log('📋 Estructura:');
    console.log('   - id (HASH) - Clave primaria');
    console.log('   - email-index - Índice para búsquedas por email');
    console.log('   - username-index - Índice para búsquedas por username');
    console.log('   - amplifySub-index - Índice para búsquedas por Amplify Sub');
    
  } catch (error) {
    console.log('\n❌ Error:');
    console.log(`   Tipo: ${error.name}`);
    console.log(`   Mensaje: ${error.message}`);
  }
}

createUsersTable().catch(console.error);
