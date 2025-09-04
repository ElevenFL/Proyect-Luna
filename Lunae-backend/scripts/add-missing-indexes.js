#!/usr/bin/env node

import { UpdateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const TABLE_NAME = 'Lunea-chat';

// Cliente DynamoDB
const tableClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

console.log('🔧 Agregando índices faltantes a la tabla existente...');
console.log('📋 Tabla:', TABLE_NAME);
console.log('🌍 Región:', process.env.AWS_REGION || 'us-east-2');

async function checkExistingIndexes() {
  try {
    const describeCommand = new DescribeTableCommand({
      TableName: TABLE_NAME
    });
    
    const { Table } = await tableClient.send(describeCommand);
    
    console.log('\n📊 Estado actual de la tabla:');
    console.log('✅ Tabla encontrada:', Table.TableName);
    console.log('📄 Estado:', Table.TableStatus);
    
    const existingIndexes = Table.GlobalSecondaryIndexes || [];
    console.log('📋 Índices existentes:', existingIndexes.length);
    
    existingIndexes.forEach(index => {
      console.log(`   - ${index.IndexName}: ${index.IndexStatus}`);
    });
    
    return existingIndexes.map(index => index.IndexName);
    
  } catch (error) {
    console.error('❌ Error verificando tabla:', error);
    throw error;
  }
}

async function addMissingIndexes() {
  try {
    // Verificar índices existentes
    const existingIndexNames = await checkExistingIndexes();
    
    // Definir los índices que necesitamos
    const requiredIndexes = [
      {
        name: 'EmailIndex',
        keyAttribute: 'email'
      },
      {
        name: 'UsernameIndex', 
        keyAttribute: 'username'
      },
      {
        name: 'AmplifySubIndex',
        keyAttribute: 'amplifySub'
      }
    ];
    
    // Encontrar índices faltantes
    const missingIndexes = requiredIndexes.filter(
      index => !existingIndexNames.includes(index.name)
    );
    
    if (missingIndexes.length === 0) {
      console.log('\n✅ Todos los índices requeridos ya existen!');
      return;
    }
    
    console.log('\n🔍 Índices faltantes:');
    missingIndexes.forEach(index => {
      console.log(`   - ${index.name} (${index.keyAttribute})`);
    });
    
    // Agregar índices uno por uno
    for (const index of missingIndexes) {
      console.log(`\n🔧 Agregando índice: ${index.name}...`);
      
      try {
        const updateCommand = new UpdateTableCommand({
          TableName: TABLE_NAME,
          AttributeDefinitions: [
            {
              AttributeName: index.keyAttribute,
              AttributeType: 'S'
            }
          ],
          GlobalSecondaryIndexUpdates: [
            {
              Create: {
                IndexName: index.name,
                KeySchema: [
                  {
                    AttributeName: index.keyAttribute,
                    KeyType: 'HASH'
                  }
                ],
                Projection: {
                  ProjectionType: 'ALL'
                }
              }
            }
          ]
        });
        
        await tableClient.send(updateCommand);
        console.log(`✅ Índice ${index.name} agregado exitosamente`);
        
        // Esperar un poco entre índices para evitar límites de AWS
        if (missingIndexes.indexOf(index) < missingIndexes.length - 1) {
          console.log('⏳ Esperando antes del siguiente índice...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (indexError) {
        console.error(`❌ Error agregando índice ${index.name}:`, indexError);
        
        if (indexError.name === 'ResourceInUseException') {
          console.log('💡 La tabla está siendo modificada. Espera unos minutos y reintenta.');
        } else if (indexError.name === 'LimitExceededException') {
          console.log('💡 Límite de modificaciones alcanzado. Espera y reintenta más tarde.');
        }
        
        throw indexError;
      }
    }
    
    console.log('\n⏳ Esperando a que los índices estén activos...');
    await waitForIndexesActive();
    
    console.log('\n🎉 Todos los índices han sido agregados exitosamente!');
    console.log('📱 Ahora puedes reiniciar la aplicación y el onboarding debería funcionar.');
    
  } catch (error) {
    console.error('\n❌ Error agregando índices:', error);
    
    if (error.name === 'ResourceNotFoundException') {
      console.error('💡 La tabla no existe. Ejecuta: npm run setup-dynamodb');
    } else if (error.name === 'AccessDeniedException') {
      console.error('💡 Error de permisos. Verifica las credenciales de AWS.');
    } else if (error.name === 'ValidationException') {
      console.error('💡 Error de validación:', error.message);
    }
    
    throw error;
  }
}

async function waitForIndexesActive() {
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const describeCommand = new DescribeTableCommand({
        TableName: TABLE_NAME
      });
      
      const { Table } = await tableClient.send(describeCommand);
      
      if (Table.TableStatus === 'ACTIVE') {
        const indexes = Table.GlobalSecondaryIndexes || [];
        const allIndexesActive = indexes.every(index => index.IndexStatus === 'ACTIVE');
        
        if (allIndexesActive) {
          console.log('✅ Todos los índices están activos');
          return true;
        }
        
        const inProgressIndexes = indexes.filter(index => index.IndexStatus !== 'ACTIVE');
        console.log(`⏳ Esperando índices: ${inProgressIndexes.map(i => `${i.IndexName}(${i.IndexStatus})`).join(', ')}`);
      } else {
        console.log(`⏳ Estado de la tabla: ${Table.TableStatus}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      attempts++;
      
    } catch (error) {
      console.error('Error verificando estado:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Timeout esperando que los índices estén activos');
}

// Ejecutar script
addMissingIndexes().catch(error => {
  console.error('\n💥 Script falló:', error.message);
  process.exit(1);
});
