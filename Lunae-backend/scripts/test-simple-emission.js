import { Chat } from '../src/models/Chat.js';
import { io } from 'socket.io-client';

/**
 * Script simple para probar la emisión de mensajes
 */

const SERVER_URL = 'http://localhost:3000';

async function testSimpleEmission() {
  console.log('🔍 Probando emisión simple de mensajes...\n');

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

      // Esperar un poco y enviar mensaje
      setTimeout(async () => {
        try {
          console.log('\n📤 Enviando mensaje de prueba...');
          
          // Enviar mensaje directamente al modelo
          const message = await Chat.sendMessage(realConversationId, {
            senderId: realUserId1,
            receiverId: realUserId2,
            content: 'Mensaje de prueba simple - ' + new Date().toISOString(),
            type: 'text'
          });
          
          console.log('✅ Mensaje guardado en DB:', message.messageId);
          console.log('   De:', message.senderId, '→ Para:', message.receiverId);
          console.log('   Contenido:', message.content);
          
          console.log('\n💡 Ahora revisa los logs del servidor para ver:');
          console.log('   1. Si se está emitiendo el mensaje');
          console.log('   2. Si hay usuarios en la sala');
          console.log('   3. Si hay errores en la emisión');
          
        } catch (error) {
          console.error('❌ Error enviando mensaje:', error.message);
        }
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
        console.log('💡 Revisa los logs del servidor para ver qué está pasando');
      }

      user.disconnect();
      resolve();
    }, 8000);
  });
}

// Ejecutar prueba
testSimpleEmission().then(() => {
  console.log('\n✅ Prueba simple finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba simple:', error);
  process.exit(1);
});
