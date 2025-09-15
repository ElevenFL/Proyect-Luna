import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/lib-dynamodb";

// Configuración de DynamoDB
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
});

const docClient = DynamoDBDocumentClient.from(client);

const FRIEND_REQUESTS_TABLE = process.env.FRIEND_REQUESTS_TABLE || "FriendRequests";

/**
 * Crear tabla de solicitudes de amistad
 */
export const createFriendRequestsTable = async () => {
  try {
    // Verificar si la tabla ya existe
    try {
      await docClient.send(new DescribeTableCommand({ TableName: FRIEND_REQUESTS_TABLE }));
      console.log(`✅ Tabla ${FRIEND_REQUESTS_TABLE} ya existe`);
      return;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    const params = {
      TableName: FRIEND_REQUESTS_TABLE,
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH' // Partition key
        }
      ],
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S'
        },
        {
          AttributeName: 'senderId',
          AttributeType: 'S'
        },
        {
          AttributeName: 'receiverId',
          AttributeType: 'S'
        }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'senderId-index',
          KeySchema: [
            {
              AttributeName: 'senderId',
              KeyType: 'HASH'
            }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        },
        {
          IndexName: 'receiverId-index',
          KeySchema: [
            {
              AttributeName: 'receiverId',
              KeyType: 'HASH'
            }
          ],
          Projection: {
            ProjectionType: 'ALL'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    };

    await docClient.send(new CreateTableCommand(params));
    console.log(`✅ Tabla ${FRIEND_REQUESTS_TABLE} creada exitosamente`);
    
    // Esperar a que la tabla esté activa
    console.log('⏳ Esperando a que la tabla esté activa...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error(`❌ Error creando tabla ${FRIEND_REQUESTS_TABLE}:`, error);
    throw error;
  }
};

/**
 * Crear todas las tablas necesarias
 */
export const createAllTables = async () => {
  try {
    console.log('🚀 Iniciando creación de tablas...');
    
    await createFriendRequestsTable();
    
    console.log('✅ Todas las tablas creadas exitosamente');
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    throw error;
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createAllTables()
    .then(() => {
      console.log('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script falló:', error);
      process.exit(1);
    });
}

