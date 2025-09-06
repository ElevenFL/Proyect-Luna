import { User } from '../src/models/Users.js';
import { Chat } from '../src/models/Chat.js';
import { io } from 'socket.io-client';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

/**
 * Script para probar la API real con autenticación
 */

const SERVER_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

async function testRealApi() {
  console.log('🔍 Probando API real con autenticación...\n');

  try {
    // 1. Crear usuarios de prueba
    console.log('1️⃣ Creando usuarios de prueba...');
    
    const testUser1 = await User.create({
      username: 'test_api_user_1',
      email: 'test1@example.com',
      amplifySub: 'test_sub_1',
      active: true,
      profileCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    const testUser2 = await User.create({
      username: 'test_api_user_2',
      email: 'test2@example.com',
      amplifySub: 'test_sub_2',
      active: true,
      profileCompleted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Usuarios creados:', testUser1.id, testUser2.id);
    
    // 2. Crear token JWT
    const token = jwt.sign(
      { userId: testUser1.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log('✅ Token JWT creado');
    
    // 3. Crear cliente WebSocket
    const user = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });
    
    return new Promise((resolve, reject) => {
      let userConnected = false;
      let messagesReceived = 0;
      let conversationId = null;

      // Configurar cliente
      user.on('connect', () => {
        console.log('✅ Cliente conectado:', user.id);
        userConnected = true;
        
        // Autenticar usuario
        user.emit('authenticate', testUser1.id);
        console.log('🔐 Usuario autenticado:', testUser1.id);
        
        // Escuchar mensajes
        user.on('new-message', (message) => {
          console.log('📨 Mensaje recibido via WebSocket:', message);
          messagesReceived++;
        });

        // Esperar un poco y probar la API
        setTimeout(async () => {
          try {
            console.log('\n2️⃣ Probando API de chat...');
            
            // Crear conversación via API
            console.log('📤 Creando conversación via API...');
            const createConvResponse = await fetch(`${SERVER_URL}/api/chat/conversations/with/${testUser2.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({})
            });
            
            if (createConvResponse.ok) {
              const convData = await createConvResponse.json();
              conversationId = convData.data?.conversationId;
              console.log('✅ Conversación creada via API:', conversationId);
              
              // Unirse a la conversación
              user.emit('join-conversation', conversationId);
              console.log('👥 Usuario se unió a la conversación:', conversationId);
              
              // Esperar un poco y enviar mensaje
              setTimeout(async () => {
                try {
                  console.log('\n📤 Enviando mensaje via API...');
                  const messageResponse = await fetch(`${SERVER_URL}/api/chat/conversations/${conversationId}/messages`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      content: 'Mensaje de prueba via API real - ' + new Date().toISOString(),
                      receiverId: testUser2.id,
                      type: 'text'
                    })
                  });

                  if (messageResponse.ok) {
                    const messageData = await messageResponse.json();
                    console.log('✅ Mensaje enviado via API:', messageData.data?.message?.messageId);
                    console.log('💡 Revisa los logs del servidor para ver la emisión');
                  } else {
                    const errorText = await messageResponse.text();
                    console.log('❌ Error enviando mensaje:', errorText);
                  }
                  
                } catch (error) {
                  console.error('❌ Error enviando mensaje via API:', error.message);
                }
              }, 1000);
              
            } else {
              const errorText = await createConvResponse.text();
              console.log('❌ Error creando conversación:', errorText);
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
          console.log('\n✅ Los mensajes están llegando correctamente');
        } else {
          console.log('\n❌ Los mensajes NO están llegando');
          console.log('💡 El problema está en la emisión de mensajes en el controlador');
        }

        user.disconnect();
        resolve();
      }, 10000);
    });
    
  } catch (error) {
    console.error('❌ Error en test real API:', error.message);
  }
}

// Ejecutar prueba
testRealApi().then(() => {
  console.log('\n✅ Prueba de API real finalizada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error en prueba de API real:', error);
  process.exit(1);
});
