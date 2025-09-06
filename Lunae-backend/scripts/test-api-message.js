import { io } from 'socket.io-client';
import fetch from 'node-fetch';

/**
 * Script para probar el envío de mensajes via API real
 */

const SERVER_URL = 'http://localhost:3000';

async function testApiMessage() {
  console.log('🔍 Probando envío de mensajes via API real...\n');

  // Crear cliente WebSocket
  const user = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });

  const testUserId1 = 'test_api_user_1';
  const testUserId2 = 'test_api_user_2';

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

      // Esperar un poco y luego probar la API
      setTimeout(async () => {
        try {
          console.log('\n📤 Probando API de chat...');
          
          // 1. Crear conversación via API
          console.log('1️⃣ Creando conversación via API...');
          const createConvResponse = await fetch(`${SERVER_URL}/api/chat/conversations/with/${testUserId2}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer fake-token-for-test`
            },
            body: JSON.stringify({})
          });
          
          if (createConvResponse.ok) {
            const convData = await createConvResponse.json();
            conversationId = convData.data?.conversationId;
            console.log('✅ Conversación creada via API:', conversationId);
            
            // 2. Unirse a la conversación
            user.emit('join-conversation', conversationId);
            console.log('👥 Usuario se unió a la conversación:', conversationId);
            
            // 3. Esperar un poco y enviar mensaje via API
            setTimeout(async () => {
              try {
                console.log('\n2️⃣ Enviando mensaje via API...');
                const messageResponse = await fetch(`${SERVER_URL}/api/chat/conversations/${conversationId}/messages`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer fake-token-for-test`
                  },
                  body: JSON.stringify({
                    content: 'Mensaje de prueba via API - ' + new Date().toISOString(),
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
            
          } else {
            console.log(`⚠️ Error creando conversación: ${createConvResponse.status}`);
            const errorText = await createConvResponse.text();
            console.log('   Error:', errorText);
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
      console.log(`   Conversación: ${conversationId || 'No creada'}`);
      console.log(`   Mensajes recibidos: ${messagesReceived}`);
      
      if (messagesReceived > 0) {
        console.log('\n✅ Los mensajes están llegando correctamente via API');
      } else {
        console.log('\n❌ Los mensajes NO están llegando via API');
        console.log('💡 Esto confirma que el problema está en:');
        console.log('   1. La emisión de mensajes en el controlador');
        console.log('   2. Los usuarios no se están uniendo a las salas correctas');
        console.log('   3. Problema con la configuración de WebSocket');
      }

      user.disconnect();
      resolve();
    }, 10000);
  });
}

// Ejecutar prueba
testApiMessage().then(() => {
  console.log('\n✅ Prueba de API finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba de API:', error);
  process.exit(1);
});
