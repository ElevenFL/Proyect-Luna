import dotenv from 'dotenv';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

console.log('🔍 Depurando carga de variables de entorno...\n');

// Cargar variables de entorno
dotenv.config();

console.log('📋 Variables de entorno cargadas:');
console.log(`   AWS_REGION: "${process.env.AWS_REGION}"`);
console.log(`   AWS_ACCESS_KEY_ID: "${process.env.AWS_ACCESS_KEY_ID}"`);
console.log(`   AWS_SECRET_ACCESS_KEY: "${process.env.AWS_SECRET_ACCESS_KEY}"`);
console.log(`   DYNAMODB_TABLE_NAME: "${process.env.DYNAMODB_TABLE_NAME}"\n`);

// Verificar si las credenciales están presentes
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.log('❌ Error: Credenciales de AWS no configuradas');
  process.exit(1);
}

console.log('✅ Credenciales configuradas correctamente\n');

try {
  // Crear cliente DynamoDB
  console.log('🔌 Creando cliente DynamoDB...');
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  
  console.log('✅ Cliente DynamoDB creado exitosamente');
  
  // Probar operación
  console.log('📋 Probando operación...');
  const command = new DescribeTableCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME || 'Lunea-chat'
  });
  
  const response = await client.send(command);
  console.log('✅ Operación exitosa');
  console.log(`📋 Tabla: ${response.Table.TableName}`);
  console.log(`📊 Estado: ${response.Table.TableStatus}`);
  
} catch (error) {
  console.log('\n❌ Error:');
  console.log(`   Tipo: ${error.name}`);
  console.log(`   Mensaje: ${error.message}`);
}
