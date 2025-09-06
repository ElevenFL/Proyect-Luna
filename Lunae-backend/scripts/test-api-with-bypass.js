import { io } from 'socket.io-client';
import fetch from 'node-fetch';

/**
 * Script para probar la API con bypass de autenticación
 */

const SERVER_URL = 'http://localhost:3000';

async function testApiWithBypass() {
  console.log('🔍 Probando API con bypass de autenticación...\n');

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

      // Esperar un poco y probar la API
      setTimeout(async () => {
        try {
          console.log('\n📤 Probando API de chat...');
          
          // Enviar mensaje via API (sin autenticación real)
          console.log('1️⃣ Enviando mensaje via API...');
          const messageResponse = await fetch(`${SERVER_URL}/api/chat/conversations/${realConversationId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer fake-token-for-test`
            },
            body: JSON.stringify({
              content: 'Mensaje de prueba via API - ' + new Date().toISOString(),
              receiverId: realUserId2,
              type: 'text'
            })
          });

          console.log(`📊 Respuesta de la API: ${messageResponse.status}`);
          
          if (messageResponse.ok) {
            const messageData = await messageResponse.json();
            console.log('✅ Mensaje enviado via API:', messageData.data?.message?.messageId);
            console.log('💡 Revisa los logs del servidor para ver la emisión');
          } else {
            const errorText = await messageResponse.text();
            console.log('⚠️ Error en API:', errorText);
            console.log('💡 Esto es normal si no hay autenticación real');
          }
          
        } catch (error) {
          console.error('❌ Error en test de API:', error.message);
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
        console.log('💡 El problema está en la emisión de mensajes en el controlador');
      }

      user.disconnect();
      resolve();
    }, 8000);
  });
}

// Ejecutar prueba
testApiWithBypass().then(() => {
  console.log('\n✅ Prueba de API con bypass finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba de API con bypass:', error);
  process.exit(1);
});
