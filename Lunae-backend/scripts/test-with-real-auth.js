import { Chat } from '../src/models/Chat.js';
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

/**
 * Script para probar con autenticación real
 */

const SERVER_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

async function testWithRealAuth() {
  console.log('🔍 Probando con autenticación real...\n');

  // Crear cliente WebSocket
  const user = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const testUserId1 = 'test_auth_user_1';
  const testUserId2 = 'test_auth_user_2';

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

      // Esperar un poco y luego probar con autenticación real
      setTimeout(async () => {
        try {
          console.log('\n📤 Probando con autenticación real...');
          
          // 1. Crear conversación directamente en DB
          const { conversationId: convId } = await Chat.getOrCreateConversation(testUserId1, testUserId2);
          conversationId = convId;
          console.log('✅ Conversación creada:', conversationId);
          
          // 2. Unirse a la conversación
          user.emit('join-conversation', conversationId);
          console.log('👥 Usuario se unió a la conversación:', conversationId);
          
          // 3. Crear token JWT real
          const token = jwt.sign(
            { userId: testUserId1 },
            JWT_SECRET,
            { expiresIn: '1h' }
          );
          console.log('🔑 Token JWT creado');
          
          // 4. Enviar mensaje via API con token real
          setTimeout(async () => {
            try {
              console.log('\n📤 Enviando mensaje via API con token real...');
              const messageResponse = await fetch(`${SERVER_URL}/api/chat/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  content: 'Mensaje de prueba con auth real - ' + new Date().toISOString(),
                  receiverId: testUserId2,
                  type: 'text'
                })
              });

              if (messageResponse.ok) {
                const messageData = await messageResponse.json();
                console.log('✅ Mensaje enviado via API:', messageData.data?.message?.messageId);
                console.log('💡 Revisa los logs del servidor para ver la emisión');
              } else {
                console.log(`⚠️ Error enviando mensaje: ${messageResponse.status}`);
                const errorText = await messageResponse.text();
                console.log('   Error:', errorText);
              }
              
            } catch (error) {
              console.error('❌ Error enviando mensaje via API:', error.message);
            }
          }, 1000);
          
        } catch (error) {
          console.error('❌ Error en test con auth real:', error.message);
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
        console.log('💡 El problema está en la emisión de mensajes en el controlador');
      }

      user.disconnect();
      resolve();
    }, 10000);
  });
}

// Ejecutar prueba
testWithRealAuth().then(() => {
  console.log('\n✅ Prueba con auth real finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba con auth real:', error);
  process.exit(1);
});
