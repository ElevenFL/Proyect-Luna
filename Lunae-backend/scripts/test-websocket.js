import { io } from 'socket.io-client';

/**
 * Script para probar la funcionalidad de WebSockets
 */

const SERVER_URL = 'http://localhost:3000';

async function testWebSocket() {
  console.log('🔌 Probando conexión WebSocket...\n');

  // Crear dos clientes simulando dos usuarios
  const user1 = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const user2 = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const testUserId1 = 'test_user_websocket_1';
  const testUserId2 = 'test_user_websocket_2';
  const testConversationId = 'test_user_websocket_1__test_user_websocket_2';

  return new Promise((resolve, reject) => {
    let user1Connected = false;
    let user2Connected = false;
    let messagesReceived = 0;

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

      // Si ambos están conectados, enviar mensaje de prueba
      if (user2Connected) {
        setTimeout(() => {
          console.log('\n📤 Enviando mensaje de prueba...');
          // Simular envío de mensaje (esto normalmente se haría via API)
          console.log('💡 Nota: El envío real se hace via API, no via WebSocket');
        }, 1000);
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

      // Si ambos están conectados, enviar mensaje de prueba
      if (user1Connected) {
        setTimeout(() => {
          console.log('\n📤 Enviando mensaje de prueba...');
          // Simular envío de mensaje (esto normalmente se haría via API)
          console.log('💡 Nota: El envío real se hace via API, no via WebSocket');
        }, 1000);
      }
    });

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
      console.log('\n📊 Resultados de la prueba:');
      console.log(`   User 1 conectado: ${user1Connected ? '✅' : '❌'}`);
      console.log(`   User 2 conectado: ${user2Connected ? '✅' : '❌'}`);
      console.log(`   Mensajes recibidos: ${messagesReceived}`);
      
      if (user1Connected && user2Connected) {
        console.log('\n✅ WebSocket básico funcionando correctamente');
        console.log('💡 El problema puede estar en:');
        console.log('   1. La emisión de mensajes desde el backend');
        console.log('   2. Los IDs de usuario no coinciden');
        console.log('   3. Los usuarios no se unen a las conversaciones correctas');
      } else {
        console.log('\n❌ Problema con la conexión WebSocket');
      }

      // Limpiar conexiones
      user1.disconnect();
      user2.disconnect();
      
      resolve();
    }, 5000);
  });
}

// Ejecutar prueba
testWebSocket().then(() => {
  console.log('\n✅ Prueba de WebSocket finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba de WebSocket:', error);
  process.exit(1);
});
