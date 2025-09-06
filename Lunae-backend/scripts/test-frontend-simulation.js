import { Chat } from '../src/models/Chat.js';
import { io } from 'socket.io-client';
import fetch from 'node-fetch';

/**
 * Script que simula exactamente lo que hace el frontend
 */

const SERVER_URL = 'http://localhost:3000';

async function testFrontendSimulation() {
  console.log('🔍 Simulando comportamiento del frontend...\n');

  // Simular dos usuarios (como en el frontend real)
  const user1 = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const user2 = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  // Usar IDs reales de la base de datos
  const realUserId1 = 'user_1756909148762_l9xaf9ftl';
  const realUserId2 = 'user_1757111917744_l16l2hj4j';
  const realConversationId = 'user_1756909148762_l9xaf9ftl__user_1757111917744_l16l2hj4j';

  return new Promise((resolve, reject) => {
    let user1Connected = false;
    let user2Connected = false;
    let messagesReceived = 0;

    // Configurar User 1
    user1.on('connect', () => {
      console.log('✅ User 1 conectado:', user1.id);
      user1Connected = true;
      
      // Autenticar usuario 1
      user1.emit('authenticate', realUserId1);
      console.log('🔐 User 1 autenticado:', realUserId1);
      
      // Unirse a conversación
      user1.emit('join-conversation', realConversationId);
      console.log('👥 User 1 se unió a la conversación:', realConversationId);
      
      // Escuchar mensajes
      user1.on('new-message', (message) => {
        console.log('📨 User 1 recibió mensaje:', message);
        messagesReceived++;
      });

      // Si ambos están conectados, enviar mensaje
      if (user2Connected) {
        setTimeout(() => sendTestMessage(), 2000);
      }
    });

    // Configurar User 2
    user2.on('connect', () => {
      console.log('✅ User 2 conectado:', user2.id);
      user2Connected = true;
      
      // Autenticar usuario 2
      user2.emit('authenticate', realUserId2);
      console.log('🔐 User 2 autenticado:', realUserId2);
      
      // Unirse a conversación
      user2.emit('join-conversation', realConversationId);
      console.log('👥 User 2 se unió a la conversación:', realConversationId);
      
      // Escuchar mensajes
      user2.on('new-message', (message) => {
        console.log('📨 User 2 recibió mensaje:', message);
        messagesReceived++;
      });

      // Si ambos están conectados, enviar mensaje
      if (user1Connected) {
        setTimeout(() => sendTestMessage(), 2000);
      }
    });

    async function sendTestMessage() {
      try {
        console.log('\n📤 Enviando mensaje de prueba...');
        
        // Enviar mensaje directamente al modelo (como lo haría el controlador)
        const message = await Chat.sendMessage(realConversationId, {
          senderId: realUserId1,
          receiverId: realUserId2,
          content: 'Mensaje de prueba frontend simulation - ' + new Date().toISOString(),
          type: 'text'
        });
        
        console.log('✅ Mensaje guardado en DB:', message.messageId);
        console.log('   De:', message.senderId, '→ Para:', message.receiverId);
        console.log('   Contenido:', message.content);
        
        // Simular la emisión manual (como lo haría el controlador)
        console.log('\n📡 Simulando emisión manual...');
        
        // Obtener la instancia de io del servidor
        const { io: serverIo } = await import('../src/index.js');
        
        if (serverIo) {
          const room = serverIo.sockets.adapter.rooms.get(realConversationId);
          const roomSize = room ? room.size : 0;
          
          console.log(`🔍 Usuarios en sala ${realConversationId}: ${roomSize}`);
          console.log(`🔍 Total sockets conectados: ${serverIo.sockets.sockets.size}`);
          
          if (roomSize > 0) {
            serverIo.to(realConversationId).emit('new-message', message);
            console.log(`✅ Mensaje emitido a ${roomSize} usuarios`);
          } else {
            console.log(`⚠️ No hay usuarios en la sala`);
            console.log(`💡 Salas disponibles:`, Array.from(serverIo.sockets.adapter.rooms.keys()));
          }
        } else {
          console.log('❌ No se pudo obtener la instancia de io del servidor');
        }
        
      } catch (error) {
        console.error('❌ Error enviando mensaje:', error.message);
      }
    }

    // Manejar errores
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
      console.log('\n📊 Resultados:');
      console.log(`   User 1 conectado: ${user1Connected ? '✅' : '❌'}`);
      console.log(`   User 2 conectado: ${user2Connected ? '✅' : '❌'}`);
      console.log(`   Mensajes recibidos: ${messagesReceived}`);
      
      if (messagesReceived > 0) {
        console.log('\n✅ Los mensajes están llegando correctamente');
      } else {
        console.log('\n❌ Los mensajes NO están llegando');
        console.log('💡 El problema está en la emisión de mensajes');
      }

      // Limpiar conexiones
      user1.disconnect();
      user2.disconnect();
      
      resolve();
    }, 10000);
  });
}

// Ejecutar prueba
testFrontendSimulation().then(() => {
  console.log('\n✅ Simulación del frontend finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en simulación del frontend:', error);
  process.exit(1);
});
