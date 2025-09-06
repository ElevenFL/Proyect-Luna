import { Chat } from '../src/models/Chat.js';
import { docClient } from '../src/config/db.js';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

/**
 * Script de diagnóstico para problemas de mensajería
 * Verifica la integridad del sistema de chat
 */

const TABLE_NAME = 'Lunea-chat';

async function testChatSystem() {
  console.log('🔍 Iniciando diagnóstico del sistema de chat...\n');

  try {
    // 0. Verificar configuración
    console.log('0️⃣ Verificando configuración...');
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'us-east-2'}`);
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✅ Configurado' : '❌ No configurado'}`);
    console.log(`   TABLE_NAME: ${TABLE_NAME}\n`);

    // 1. Verificar conexión a DynamoDB
    console.log('1️⃣ Verificando conexión a DynamoDB...');
    try {
      const testQuery = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'TEST#CONNECTION'
        },
        Limit: 1
      });
      
      await docClient.send(testQuery);
      console.log('✅ Conexión a DynamoDB OK\n');
    } catch (error) {
      console.log(`⚠️ Error de conexión a DynamoDB: ${error.message}`);
      console.log('   Esto puede ser normal si la tabla no existe aún\n');
    }

    // 2. Verificar datos existentes con Scan
    console.log('2️⃣ Verificando datos existentes...');
    try {
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 20
      });
      
      const scanResult = await docClient.send(scanCommand);
      console.log(`📊 Encontrados ${scanResult.Items?.length || 0} elementos en la tabla`);
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        console.log('📋 Elementos encontrados:');
        scanResult.Items.forEach((item, index) => {
          console.log(`   ${index + 1}. PK: ${item.PK}`);
          console.log(`      SK: ${item.SK}`);
          console.log(`      EntityType: ${item.entityType || 'N/A'}`);
          if (item.entityType === 'Message') {
            console.log(`      De: ${item.senderId} → Para: ${item.receiverId}`);
            console.log(`      Contenido: ${item.content?.substring(0, 30)}...`);
          }
          console.log('');
        });
      }
    } catch (error) {
      console.log(`⚠️ No se pudieron escanear datos: ${error.message}\n`);
    }

    // 3. Test de creación de conversación
    console.log('3️⃣ Probando creación de conversación...');
    const testUserId1 = 'test_user_1';
    const testUserId2 = 'test_user_2';
    
    try {
      const { conversationId, conversation } = await Chat.getOrCreateConversation(testUserId1, testUserId2);
      console.log(`✅ Conversación creada/obtenida: ${conversationId}`);
      console.log(`   Participantes: ${conversation.participants?.join(', ')}`);
      
      // 4. Test de envío de mensaje
      console.log('\n4️⃣ Probando envío de mensaje...');
      const message = await Chat.sendMessage(conversationId, {
        senderId: testUserId1,
        receiverId: testUserId2,
        content: 'Mensaje de prueba - ' + new Date().toISOString(),
        type: 'text'
      });
      
      console.log(`✅ Mensaje enviado: ${message.messageId}`);
      console.log(`   De: ${message.senderId} → Para: ${message.receiverId}`);
      console.log(`   Contenido: ${message.content}`);
      
      // 5. Test de listado de mensajes
      console.log('\n5️⃣ Probando listado de mensajes...');
      const messages = await Chat.listMessages(conversationId, { limit: 10 });
      console.log(`✅ Mensajes listados: ${messages.items.length}`);
      
      if (messages.items.length > 0) {
        const lastMessage = messages.items[messages.items.length - 1];
        console.log(`   Último mensaje: ${lastMessage.content}`);
        console.log(`   De: ${lastMessage.senderId} → Para: ${lastMessage.receiverId}`);
      }
      
    } catch (error) {
      console.error('❌ Error en test de conversación/mensaje:', error.message);
    }

    console.log('\n🎯 Diagnóstico completado');
    console.log('\n📋 Resumen de posibles problemas:');
    console.log('   1. Verificar que el servidor WebSocket esté corriendo');
    console.log('   2. Verificar que los usuarios estén autenticados correctamente');
    console.log('   3. Verificar que los IDs de usuario coincidan entre frontend y backend');
    console.log('   4. Verificar que los listeners de WebSocket estén configurados');
    console.log('   5. Verificar logs del servidor para errores de emisión');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Ejecutar diagnóstico
testChatSystem().then(() => {
  console.log('\n✅ Script de diagnóstico finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});