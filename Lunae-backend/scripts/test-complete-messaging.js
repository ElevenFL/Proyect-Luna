import { io } from 'socket.io-client';
import fetch from 'node-fetch';

/**
 * Script para probar el flujo completo de mensajería
 * Incluye WebSocket + API
 */

const SERVER_URL = 'http://localhost:3000';

async function testCompleteMessaging() {
  console.log('🔍 Probando flujo completo de mensajería...\n');

  // Crear dos clientes WebSocket
  const user1 = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const user2 = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const testUserId1 = 'test_user_complete_1';
  const testUserId2 = 'test_user_complete_2';
  const testConversationId = 'test_user_complete_1__test_user_complete_2';

  return new Promise((resolve, reject) => {
    let user1Connected = false;
    let user2Connected = false;
    let messagesReceived = 0;
    let testMessage = null;

    // Configurar User 1
    user1.on('connect', () => {
      console.log('✅ User 1 conectado:', user1.id);
      user1Connected = true;
      
      // Autenticar usuario 1
      user1.emit('authenticate', testUserId1);
      console.log('🔐 User 1 autenticado');
      
      // Unirse a conversación
      user1.emit('join-conversation', testConversationId);
      console.log('👥 User 1 se unió a la conversación');
      
      // Escuchar mensajes
      user1.on('new-message', (message) => {
        console.log('📨 User 1 recibió mensaje:', message);
        messagesReceived++;
      });

      // Si ambos están conectados, proceder con el test
      if (user2Connected) {
        setTimeout(() => runCompleteTest(), 1000);
      }
    });

    // Configurar User 2
    user2.on('connect', () => {
      console.log('✅ User 2 conectado:', user2.id);
      user2Connected = true;
      
      // Autenticar usuario 2
      user2.emit('authenticate', testUserId2);
      console.log('🔐 User 2 autenticado');
      
      // Unirse a conversación
      user2.emit('join-conversation', testConversationId);
      console.log('👥 User 2 se unió a la conversación');
      
      // Escuchar mensajes
      user2.on('new-message', (message) => {
        console.log('📨 User 2 recibió mensaje:', message);
        messagesReceived++;
      });

      // Si ambos están conectados, proceder con el test
      if (user1Connected) {
        setTimeout(() => runCompleteTest(), 1000);
      }
    });

    async function runCompleteTest() {
      try {
        console.log('\n📤 Iniciando test completo de mensajería...');
        
        // 1. Crear conversación via API
        console.log('1️⃣ Creando conversación via API...');
        const createConvResponse = await fetch(`${SERVER_URL}/api/chat/conversations/with/${testUserId2}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer fake-token-for-test` // Token falso para el test
          },
          body: JSON.stringify({})
        });
        
        if (!createConvResponse.ok) {
          console.log(`⚠️ Error creando conversación: ${createConvResponse.status}`);
          console.log('   Esto es normal si no hay autenticación real');
        } else {
          const convData = await createConvResponse.json();
          console.log('✅ Conversación creada:', convData.data?.conversationId);
        }

        // 2. Enviar mensaje via API
        console.log('\n2️⃣ Enviando mensaje via API...');
        const messageResponse = await fetch(`${SERVER_URL}/api/chat/conversations/${testConversationId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer fake-token-for-test`
          },
          body: JSON.stringify({
            content: 'Mensaje de prueba completo - ' + new Date().toISOString(),
            receiverId: testUserId2,
            type: 'text'
          })
        });

        if (!messageResponse.ok) {
          console.log(`⚠️ Error enviando mensaje: ${messageResponse.status}`);
          console.log('   Esto es normal si no hay autenticación real');
        } else {
          const messageData = await messageResponse.json();
          console.log('✅ Mensaje enviado via API:', messageData.data?.message?.messageId);
          testMessage = messageData.data?.message;
        }

        // 3. Verificar si el mensaje llegó via WebSocket
        console.log('\n3️⃣ Verificando recepción via WebSocket...');
        setTimeout(() => {
          console.log(`📊 Mensajes recibidos via WebSocket: ${messagesReceived}`);
          
          if (messagesReceived > 0) {
            console.log('✅ ¡Mensajes llegando correctamente via WebSocket!');
          } else {
            console.log('❌ Los mensajes NO están llegando via WebSocket');
            console.log('💡 Posibles problemas:');
            console.log('   1. El servidor no está emitiendo los mensajes');
            console.log('   2. Los usuarios no están en la conversación correcta');
            console.log('   3. Problema con la autenticación en el backend');
          }
        }, 2000);

      } catch (error) {
        console.error('❌ Error en test completo:', error.message);
      }
    }

    // Manejar errores de conexión
    user1.on('connect_error', (error) => {
      console.error('❌ Error de conexión User 1:', error.message);
    });

    user2.on('connect_error', (error) => {
      console.error('❌ Error de conexión User 2:', error.message);
    });

    // Manejar desconexiones
    user1.on('disconnect', () => {
      console.log('❌ User 1 desconectado');
    });

    user2.on('disconnect', () => {
      console.log('❌ User 2 desconectado');
    });

    // Timeout para la prueba
    setTimeout(() => {
      console.log('\n📊 Resultados finales:');
      console.log(`   User 1 conectado: ${user1Connected ? '✅' : '❌'}`);
      console.log(`   User 2 conectado: ${user2Connected ? '✅' : '❌'}`);
      console.log(`   Mensajes recibidos via WebSocket: ${messagesReceived}`);
      
      if (messagesReceived > 0) {
        console.log('\n✅ Sistema de mensajería funcionando correctamente');
      } else {
        console.log('\n❌ Problema identificado: Los mensajes no llegan via WebSocket');
        console.log('🔧 Solución: Revisar la emisión de mensajes en el controlador de chat');
      }

      // Limpiar conexiones
      user1.disconnect();
      user2.disconnect();
      
      resolve();
    }, 8000);
  });
}

// Ejecutar prueba
testCompleteMessaging().then(() => {
  console.log('\n✅ Prueba completa finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba completa:', error);
  process.exit(1);
});
