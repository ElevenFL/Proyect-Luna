/**
 * Script de prueba para verificar la funcionalidad de mensajería en tiempo real
 * Este script simula el envío de mensajes y verifica que se emitan correctamente via WebSocket
 */

import { io } from 'socket.io-client';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';
const WS_BASE = 'http://localhost:3000';

// Configuración de prueba
const TEST_USERS = {
  user1: {
    id: 'test-user-1',
    token: 'test-token-1'
  },
  user2: {
    id: 'test-user-2', 
    token: 'test-token-2'
  }
};

let user1Socket = null;
let user2Socket = null;
let conversationId = null;
let messagesReceived = [];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTestConversation() {
  console.log('🔄 Creando conversación de prueba...');
  
  try {
    const response = await fetch(`${API_BASE}/chat/conversations/with/${TEST_USERS.user2.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_USERS.user1.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (data.success) {
      conversationId = data.data.conversationId;
      console.log(`✅ Conversación creada: ${conversationId}`);
      return true;
    } else {
      console.error('❌ Error creando conversación:', data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Error en request:', error.message);
    return false;
  }
}

async function connectWebSockets() {
  console.log('🔌 Conectando WebSockets...');
  
  return new Promise((resolve, reject) => {
    let connectedCount = 0;
    
    // Conectar usuario 1
    user1Socket = io(WS_BASE, {
      transports: ['websocket', 'polling']
    });
    
    user1Socket.on('connect', () => {
      console.log('✅ Usuario 1 conectado:', user1Socket.id);
      user1Socket.emit('authenticate', TEST_USERS.user1.id);
      connectedCount++;
      if (connectedCount === 2) resolve();
    });
    
    user1Socket.on('new-message', (message) => {
      console.log('📨 Usuario 1 recibió mensaje:', {
        messageId: message.messageId,
        senderId: message.senderId,
        content: message.content.substring(0, 30) + '...',
        conversationId: message.conversationId
      });
      messagesReceived.push({ user: 'user1', message });
    });
    
    user1Socket.on('conversation-updated', (data) => {
      console.log('📋 Usuario 1 - Conversación actualizada:', {
        conversationId: data.conversationId,
        lastMessage: data.lastMessage?.content?.substring(0, 30) + '...'
      });
    });
    
    // Conectar usuario 2
    user2Socket = io(WS_BASE, {
      transports: ['websocket', 'polling']
    });
    
    user2Socket.on('connect', () => {
      console.log('✅ Usuario 2 conectado:', user2Socket.id);
      user2Socket.emit('authenticate', TEST_USERS.user2.id);
      connectedCount++;
      if (connectedCount === 2) resolve();
    });
    
    user2Socket.on('new-message', (message) => {
      console.log('📨 Usuario 2 recibió mensaje:', {
        messageId: message.messageId,
        senderId: message.senderId,
        content: message.content.substring(0, 30) + '...',
        conversationId: message.conversationId
      });
      messagesReceived.push({ user: 'user2', message });
    });
    
    user2Socket.on('conversation-updated', (data) => {
      console.log('📋 Usuario 2 - Conversación actualizada:', {
        conversationId: data.conversationId,
        lastMessage: data.lastMessage?.content?.substring(0, 30) + '...'
      });
    });
    
    // Timeout de conexión
    setTimeout(() => {
      if (connectedCount < 2) {
        reject(new Error('Timeout conectando WebSockets'));
      }
    }, 10000);
  });
}

async function joinConversation() {
  console.log('👥 Uniendo usuarios a la conversación...');
  
  user1Socket.emit('join-conversation', conversationId);
  user2Socket.emit('join-conversation', conversationId);
  
  await delay(1000); // Esperar a que se unan
  console.log('✅ Usuarios unidos a la conversación');
}

async function sendTestMessage(senderId, content) {
  console.log(`📤 Enviando mensaje desde ${senderId}: "${content}"`);
  
  try {
    const response = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_USERS[senderId].token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        receiverId: senderId === 'user1' ? TEST_USERS.user2.id : TEST_USERS.user1.id,
        type: 'text'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log(`✅ Mensaje enviado exitosamente: ${data.data.message.messageId}`);
      return data.data.message;
    } else {
      console.error('❌ Error enviando mensaje:', data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ Error en request:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Iniciando pruebas de mensajería en tiempo real...\n');
  
  try {
    // 1. Crear conversación
    const conversationCreated = await createTestConversation();
    if (!conversationCreated) {
      throw new Error('No se pudo crear la conversación');
    }
    
    // 2. Conectar WebSockets
    await connectWebSockets();
    
    // 3. Unir a la conversación
    await joinConversation();
    
    // 4. Enviar mensajes de prueba
    console.log('\n📨 Enviando mensajes de prueba...');
    
    const message1 = await sendTestMessage('user1', 'Hola, este es un mensaje de prueba 1');
    await delay(2000); // Esperar a que se procese
    
    const message2 = await sendTestMessage('user2', 'Hola, este es un mensaje de prueba 2');
    await delay(2000);
    
    const message3 = await sendTestMessage('user1', 'Mensaje de prueba 3 - ¿funciona el sistema?');
    await delay(2000);
    
    // 5. Verificar resultados
    console.log('\n📊 Resultados de las pruebas:');
    console.log(`📨 Total mensajes recibidos: ${messagesReceived.length}`);
    console.log(`👤 Mensajes recibidos por usuario 1: ${messagesReceived.filter(m => m.user === 'user1').length}`);
    console.log(`👤 Mensajes recibidos por usuario 2: ${messagesReceived.filter(m => m.user === 'user2').length}`);
    
    // Verificar que cada usuario recibió los mensajes del otro
    const user1Received = messagesReceived.filter(m => m.user === 'user1');
    const user2Received = messagesReceived.filter(m => m.user === 'user2');
    
    const user1FromUser2 = user1Received.filter(m => m.message.senderId === TEST_USERS.user2.id);
    const user2FromUser1 = user2Received.filter(m => m.message.senderId === TEST_USERS.user1.id);
    
    console.log(`\n✅ Usuario 1 recibió ${user1FromUser2.length} mensajes de Usuario 2`);
    console.log(`✅ Usuario 2 recibió ${user2FromUser1.length} mensajes de Usuario 1`);
    
    // Verificar que todos los mensajes tienen conversationId
    const messagesWithConvId = messagesReceived.filter(m => m.message.conversationId);
    console.log(`✅ ${messagesWithConvId.length}/${messagesReceived.length} mensajes tienen conversationId`);
    
    if (user1FromUser2.length >= 1 && user2FromUser1.length >= 2 && messagesWithConvId.length === messagesReceived.length) {
      console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
      console.log('✅ Los mensajes se cargan automáticamente cuando se guardan en la base de datos');
    } else {
      console.log('\n❌ Algunas pruebas fallaron');
    }
    
  } catch (error) {
    console.error('\n❌ Error en las pruebas:', error.message);
  } finally {
    // Cleanup
    console.log('\n🧹 Limpiando conexiones...');
    if (user1Socket) user1Socket.disconnect();
    if (user2Socket) user2Socket.disconnect();
    console.log('✅ Conexiones cerradas');
  }
}

// Ejecutar pruebas
runTests().then(() => {
  console.log('\n🏁 Pruebas completadas');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Error fatal:', error);
  process.exit(1);
});

