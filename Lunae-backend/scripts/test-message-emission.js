import { Chat } from '../src/models/Chat.js';
import { io } from 'socket.io-client';

/**
 * Script para probar específicamente la emisión de mensajes
 */

const SERVER_URL = 'http://localhost:3000';

async function testMessageEmission() {
  console.log('🔍 Probando emisión de mensajes...\n');

  // Crear cliente WebSocket
  const user = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const testUserId1 = 'test_emission_user_1';
  const testUserId2 = 'test_emission_user_2';
  const testConversationId = 'test_emission_user_1__test_emission_user_2';

  return new Promise((resolve, reject) => {
    let userConnected = false;
    let messagesReceived = 0;

    // Configurar cliente
    user.on('connect', () => {
      console.log('✅ Cliente conectado:', user.id);
      userConnected = true;
      
      // Autenticar usuario
      user.emit('authenticate', testUserId1);
      console.log('🔐 Usuario autenticado');
      
      // Unirse a conversación
      user.emit('join-conversation', testConversationId);
      console.log('👥 Usuario se unió a la conversación');
      
      // Escuchar mensajes
      user.on('new-message', (message) => {
        console.log('📨 Mensaje recibido:', message);
        messagesReceived++;
      });

      // Esperar un poco y luego simular envío de mensaje
      setTimeout(async () => {
        try {
          console.log('\n📤 Simulando envío de mensaje...');
          
          // 1. Crear conversación
          const { conversationId } = await Chat.getOrCreateConversation(testUserId1, testUserId2);
          console.log('✅ Conversación creada/obtenida:', conversationId);
          
          // 2. Enviar mensaje
          const message = await Chat.sendMessage(conversationId, {
            senderId: testUserId1,
            receiverId: testUserId2,
            content: 'Mensaje de prueba de emisión - ' + new Date().toISOString(),
            type: 'text'
          });
          
          console.log('✅ Mensaje guardado en DB:', message.messageId);
          console.log('   De:', message.senderId, '→ Para:', message.receiverId);
          console.log('   Contenido:', message.content);
          
          // 3. Simular emisión manual (como lo haría el controlador)
          console.log('\n📡 Simulando emisión manual...');
          
          // Obtener la instancia de io del servidor
          // Esto es lo que debería hacer el controlador
          const io = global.io || require('../src/index.js').io;
          
          if (io) {
            io.to(conversationId).emit('new-message', message);
            console.log(`✅ Mensaje emitido a conversación ${conversationId}`);
          } else {
            console.log('❌ No se pudo obtener la instancia de io');
          }
          
        } catch (error) {
          console.error('❌ Error en simulación:', error.message);
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
        console.log('\n✅ La emisión de mensajes funciona correctamente');
      } else {
        console.log('\n❌ Los mensajes no se están emitiendo');
        console.log('💡 El problema está en la emisión desde el controlador');
      }

      user.disconnect();
      resolve();
    }, 10000);
  });
}

// Ejecutar prueba
testMessageEmission().then(() => {
  console.log('\n✅ Prueba de emisión finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba de emisión:', error);
  process.exit(1);
});
