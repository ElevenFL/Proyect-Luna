import { Chat } from '../src/models/Chat.js';
import { io } from 'socket.io-client';

/**
 * Script para probar el envío real de mensajes
 */

const SERVER_URL = 'http://localhost:3000';

async function testRealMessage() {
  console.log('🔍 Probando envío real de mensajes...\n');

  // Crear cliente WebSocket
  const user = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const testUserId1 = 'test_real_user_1';
  const testUserId2 = 'test_real_user_2';

  return new Promise((resolve, reject) => {
    let userConnected = false;
    let messagesReceived = 0;
    let conversationId = null;

    // Configurar cliente
    user.on('connect', () => {
      console.log('✅ Cliente conectado:', user.id);
      userConnected = true;
      
      // Autenticar usuario
      user.emit('authenticate', testUserId1);
      console.log('🔐 Usuario autenticado');
      
      // Escuchar mensajes
      user.on('new-message', (message) => {
        console.log('📨 Mensaje recibido via WebSocket:', message);
        messagesReceived++;
      });

      // Esperar un poco y luego crear conversación y enviar mensaje
      setTimeout(async () => {
        try {
          console.log('\n📤 Creando conversación y enviando mensaje...');
          
          // 1. Crear conversación
          const { conversationId: convId } = await Chat.getOrCreateConversation(testUserId1, testUserId2);
          conversationId = convId;
          console.log('✅ Conversación creada/obtenida:', conversationId);
          
          // 2. Unirse a la conversación
          user.emit('join-conversation', conversationId);
          console.log('👥 Usuario se unió a la conversación:', conversationId);
          
          // 3. Esperar un poco y enviar mensaje
          setTimeout(async () => {
            try {
              const message = await Chat.sendMessage(conversationId, {
                senderId: testUserId1,
                receiverId: testUserId2,
                content: 'Mensaje de prueba real - ' + new Date().toISOString(),
                type: 'text'
              });
              
              console.log('✅ Mensaje guardado en DB:', message.messageId);
              console.log('   De:', message.senderId, '→ Para:', message.receiverId);
              console.log('   Contenido:', message.content);
              console.log('\n💡 Revisa los logs del servidor para ver si se emitió el mensaje');
              
            } catch (error) {
              console.error('❌ Error enviando mensaje:', error.message);
            }
          }, 1000);
          
        } catch (error) {
          console.error('❌ Error creando conversación:', error.message);
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
      console.log(`   Conversación: ${conversationId || 'No creada'}`);
      console.log(`   Mensajes recibidos: ${messagesReceived}`);
      
      if (messagesReceived > 0) {
        console.log('\n✅ Los mensajes están llegando correctamente');
      } else {
        console.log('\n❌ Los mensajes NO están llegando');
        console.log('💡 Revisa los logs del servidor para ver:');
        console.log('   1. Si se está emitiendo el mensaje');
        console.log('   2. Si hay usuarios en la sala de la conversación');
        console.log('   3. Si hay errores en la emisión');
      }

      user.disconnect();
      resolve();
    }, 8000);
  });
}

// Ejecutar prueba
testRealMessage().then(() => {
  console.log('\n✅ Prueba real finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba real:', error);
  process.exit(1);
});
