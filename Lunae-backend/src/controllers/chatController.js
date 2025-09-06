import Chat from '../models/Chat.js';

export const getOrCreateConversation = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.user?.id || req.user?.userId || req.user?.PK?.replace('USER#', '');

    if (!currentUserId || !otherUserId) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros' });
    }

    const { conversationId, conversation } = await Chat.getOrCreateConversation(currentUserId, otherUserId);
    return res.json({ success: true, data: { conversationId, conversation } });
  } catch (error) {
    console.error('getOrCreateConversation error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = 'text', receiverId } = req.body;
    const senderId = req.user?.id || req.user?.userId;

    // Debug: Log para verificar la estructura del usuario (comentado para producción)
    // console.log('🔍 Backend Debug - sendMessage:', {
    //   'req.user?.id': req.user?.id,
    //   'senderId result': senderId,
    //   'conversationId': conversationId,
    //   'content': content.substring(0, 30) + '...',
    //   'req.user object': req.user
    // });

    if (!conversationId || !content || !receiverId) {
      return res.status(400).json({ success: false, message: 'Datos incompletos' });
    }

    const message = await Chat.sendMessage(conversationId, {
      senderId,
      receiverId,
      content,
      type
    });

    // Añadir conversationId al mensaje para el frontend
    message.conversationId = conversationId;

    // Emitir mensaje en tiempo real a la conversación
    const io = req.app.get('socketio');
    if (io) {
      // Verificar si hay usuarios en la sala
      const room = io.sockets.adapter.rooms.get(conversationId);
      const roomSize = room ? room.size : 0;
      
      console.log(`📨 Enviando mensaje a conversación ${conversationId}`);
      console.log(`🔍 Debug - Usuarios en sala: ${roomSize}`);
      console.log(`🔍 Debug - Total sockets conectados: ${io.sockets.sockets.size}`);
      
      // Emitir mensaje a la conversación específica
      io.to(conversationId).emit('new-message', message);
      console.log(`✅ Mensaje emitido a conversación ${conversationId}`);
      
      // También emitir directamente a los usuarios específicos de la conversación
      // para asegurar que reciban el mensaje aunque no estén en la sala
      const participants = [senderId, receiverId];
      participants.forEach(userId => {
        const userSocketId = Array.from(io.sockets.sockets.values())
          .find(socket => socket.userId === String(userId))?.id;
        
        if (userSocketId) {
          io.to(userSocketId).emit('new-message', message);
          console.log(`📤 Mensaje enviado directamente a usuario ${userId} (socket: ${userSocketId})`);
        } else {
          console.log(`⚠️ Usuario ${userId} no está conectado`);
        }
      });
      
      // Emitir evento de notificación para actualizar listas de conversaciones
      participants.forEach(userId => {
        const userSocketId = Array.from(io.sockets.sockets.values())
          .find(socket => socket.userId === String(userId))?.id;
        
        if (userSocketId) {
          io.to(userSocketId).emit('conversation-updated', {
            conversationId,
            lastMessage: message,
            updatedAt: message.createdAt
          });
          console.log(`📋 Notificación de conversación actualizada enviada a usuario ${userId}`);
        }
      });
      
      if (roomSize > 0) {
        console.log(`✅ Hay ${roomSize} usuarios en la sala`);
      } else {
        console.log(`⚠️ No hay usuarios en la sala ${conversationId}`);
        console.log(`💡 Salas disponibles:`, Array.from(io.sockets.adapter.rooms.keys()));
      }
    } else {
      console.error('❌ No se pudo obtener la instancia de socketio');
    }

    return res.status(201).json({ success: true, data: { message } });
  } catch (error) {
    console.error('sendMessage error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

export const listMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit, nextKey } = req.query;
    const result = await Chat.listMessages(conversationId, {
      limit: limit ? Number(limit) : 30,
      exclusiveStartKey: nextKey ? JSON.parse(String(nextKey)) : undefined,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('listMessages error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

export const listConversations = async (req, res) => {
  try {
    const currentUserId = req.user?.id || req.user?.userId;
    const { limit, nextKey } = req.query;
    const result = await Chat.listUserConversations(currentUserId, {
      limit: limit ? Number(limit) : 30,
      exclusiveStartKey: nextKey ? JSON.parse(String(nextKey)) : undefined,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('listConversations error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};


