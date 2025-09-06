import { io } from 'socket.io-client';

/**
 * Script para debuggear el servidor de WebSocket
 */

const SERVER_URL = 'http://localhost:3000';

async function testWebSocketDebug() {
  console.log('🔍 Debuggeando servidor de WebSocket...\n');

  // Crear cliente WebSocket
  const user = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  // Usar IDs reales de la base de datos
  const realUserId1 = 'user_1756909148762_l9xaf9ftl';
  const realUserId2 = 'user_1757111917744_l16l2hj4j';
  const realConversationId = 'user_1756909148762_l9xaf9ftl__user_1757111917744_l16l2hj4j';

  return new Promise((resolve, reject) => {
    let userConnected = false;
    let messagesReceived = 0;

    // Configurar cliente
    user.on('connect', () => {
      console.log('✅ Cliente conectado:', user.id);
      userConnected = true;
      
      // Autenticar usuario
      user.emit('authenticate', realUserId1);
      console.log('🔐 Usuario autenticado:', realUserId1);
      
      // Unirse a conversación
      user.emit('join-conversation', realConversationId);
      console.log('👥 Usuario se unió a la conversación:', realConversationId);
      
      // Escuchar mensajes
      user.on('new-message', (message) => {
        console.log('📨 Mensaje recibido via WebSocket:', message);
        messagesReceived++;
      });

      // Escuchar todos los eventos para debug
      user.onAny((eventName, ...args) => {
        console.log(`🔍 Evento recibido: ${eventName}`, args);
      });

      // Esperar un poco y enviar mensaje de prueba
      setTimeout(() => {
        console.log('\n📤 Enviando mensaje de prueba directo...');
        
        // Enviar mensaje directo al servidor (esto no debería funcionar, pero es para debug)
        user.emit('new-message', {
          messageId: 'test-message-' + Date.now(),
          senderId: realUserId1,
          receiverId: realUserId2,
          content: 'Mensaje de prueba directo - ' + new Date().toISOString(),
          type: 'text',
          createdAt: new Date().toISOString()
        });
        
        console.log('💡 Mensaje de prueba enviado directamente al servidor');
        
      }, 2000);
    });

    // Manejar errores
    user.on('connect_error', (error) => {
      console.error('❌ Error de conexión:', error.message);
    });

    user.on('disconnect', () => {
      console.log('❌ Cliente desconectado');
    });

    // Timeout para la prueba
    setTimeout(() => {
      console.log('\n📊 Resultados:');
      console.log(`   Cliente conectado: ${userConnected ? '✅' : '❌'}`);
      console.log(`   Mensajes recibidos: ${messagesReceived}`);
      
      if (messagesReceived > 0) {
        console.log('\n✅ Los mensajes están llegando correctamente');
      } else {
        console.log('\n❌ Los mensajes NO están llegando');
        console.log('💡 El problema está en la emisión de mensajes en el controlador');
      }

      user.disconnect();
      resolve();
    }, 8000);
  });
}

// Ejecutar prueba
testWebSocketDebug().then(() => {
  console.log('\n✅ Debug de WebSocket finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en debug de WebSocket:', error);
  process.exit(1);
});
