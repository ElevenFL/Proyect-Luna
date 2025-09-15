import Chat from '../models/Chat.js';

export const getOrCreateConversation = async (req, res) => {
  try {
    console.log('🔍 getOrCreateConversation: Iniciando solicitud');
    console.log('🔍 getOrCreateConversation: req.params:', req.params);
    console.log('🔍 getOrCreateConversation: req.user:', req.user);
    
    const { otherUserId } = req.params;
    const currentUserId = req.user?.id || req.user?.userId || req.user?.PK?.replace('USER#', '');

    console.log('🔍 getOrCreateConversation: otherUserId:', otherUserId);
    console.log('🔍 getOrCreateConversation: currentUserId:', currentUserId);

    if (!currentUserId || !otherUserId) {
      console.log('❌ getOrCreateConversation: Faltan parámetros');
      return res.status(400).json({ success: false, message: 'Faltan parámetros' });
    }

    const { conversationId, conversation } = await Chat.getOrCreateConversation(currentUserId, otherUserId);
    console.log('✅ getOrCreateConversation: Conversación obtenida/creada:', conversationId);
    return res.json({ success: true, data: { conversationId, conversation } });
  } catch (error) {
    console.error('❌ getOrCreateConversation error:', error);
    console.error('❌ getOrCreateConversation error stack:', error.stack);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = 'text', receiverId } = req.body;
    const senderId = req.user?.id || req.user?.userId;

    // Validaciones mejoradas
    if (!conversationId || !content?.trim() || !receiverId || !senderId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Datos incompletos',
        missing: {
          conversationId: !conversationId,
          content: !content?.trim(),
          receiverId: !receiverId,
          senderId: !senderId
        }
      });
    }
    
    // Validación de longitud de contenido
    if (content.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es demasiado largo',
        maxLength: 1000,
        currentLength: content.trim().length
      });
    }
    
    // Rate limiting básico por usuario
    const userKey = `message_rate_${senderId}`;
    const rateLimitWindow = 60000; // 1 minuto
    const maxMessagesPerWindow = 30;
    
    // Nota: Aquí usarías un sistema de cache como Redis en producción
    // Por ahora, usamos un Map simple (se reinicia con el servidor)
    if (!global.messageRateLimit) {
      global.messageRateLimit = new Map();
    }
    
    const now = Date.now();
    const userRateData = global.messageRateLimit.get(userKey) || { messages: [], windowStart: now };
    
    // Limpiar mensajes fuera de la ventana
    userRateData.messages = userRateData.messages.filter(timestamp => now - timestamp < rateLimitWindow);
    
    if (userRateData.messages.length >= maxMessagesPerWindow) {
      return res.status(429).json({
        success: false,
        message: 'Demasiados mensajes enviados. Inténtalo en un momento.',
        rateLimited: true,
        retryAfter: Math.ceil((rateLimitWindow - (now - userRateData.messages[0])) / 1000)
      });
    }
    
    userRateData.messages.push(now);
    global.messageRateLimit.set(userKey, userRateData);

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
      console.log(`📤 Enviando mensaje a conversación ${conversationId}:`, {
        messageId: message.messageId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content?.substring(0, 50) + '...'
      });

      // Verificar si la sala existe y tiene usuarios
      const room = io.sockets.adapter.rooms.get(conversationId);
      const roomSize = room ? room.size : 0;
      console.log(`📊 Sala ${conversationId} tiene ${roomSize} usuarios conectados`);

      // Emitir a la sala de la conversación (usuarios que se unieron)
      io.to(conversationId).emit('new-message', message);
      
      // Emitir actualización de conversación a la sala
      io.to(conversationId).emit('conversation-updated', {
        conversationId,
        lastMessage: message,
        updatedAt: message.createdAt
      });

      // Si no hay usuarios en la sala, emitir directamente a los participantes
      if (roomSize === 0) {
        console.log(`⚠️ No hay usuarios en la sala ${conversationId}, emitiendo directamente a participantes`);
        
        const participants = [senderId, receiverId];
        
        participants.forEach(userId => {
          const userSockets = Array.from(io.sockets.sockets.values())
            .filter(socket => socket.userId === String(userId));
          
          console.log(`📱 Usuario ${userId} tiene ${userSockets.length} sockets conectados`);
          
          userSockets.forEach(socket => {
            console.log(`📤 Enviando mensaje directamente a socket ${socket.id} del usuario ${userId}`);
            socket.emit('new-message', message);
            socket.emit('conversation-updated', {
              conversationId,
              lastMessage: message,
              updatedAt: message.createdAt
            });
          });
        });
      } else {
        console.log(`✅ Mensaje enviado a sala ${conversationId} con ${roomSize} usuarios`);
      }
    } else {
      console.error('❌ Socket.IO no disponible para emitir mensaje');
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
    
    // Validar parámetros
    const messageLimit = Math.min(Math.max(Number(limit) || 30, 1), 100); // Límite entre 1 y 100
    
    // Manejar nextKey correctamente - debe ser un objeto de DynamoDB o undefined
    let exclusiveStartKey = undefined;
    if (nextKey) {
      try {
        // Si nextKey es un string JSON válido, parsearlo
        if (typeof nextKey === 'string' && nextKey.startsWith('{')) {
          exclusiveStartKey = JSON.parse(nextKey);
        } else {
          // Si es un string simple (UUID), no es válido para DynamoDB pagination
          console.warn('⚠️ nextKey no es un objeto de DynamoDB válido:', nextKey);
          exclusiveStartKey = undefined;
        }
      } catch (error) {
        console.warn('⚠️ Error parseando nextKey, ignorando paginación:', error.message);
        exclusiveStartKey = undefined;
      }
    }

    const result = await Chat.listMessages(conversationId, {
      limit: messageLimit,
      exclusiveStartKey: exclusiveStartKey,
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
    
    // Validar parámetros
    const conversationLimit = Math.min(Math.max(Number(limit) || 20, 1), 50); // Límite entre 1 y 50
    
    const result = await Chat.listUserConversations(currentUserId, {
      limit: conversationLimit,
      exclusiveStartKey: nextKey ? JSON.parse(String(nextKey)) : undefined,
    });
    
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('listConversations error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

// Nueva función para sincronización incremental
export const getNewMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { lastMessageId, limit } = req.query;
    const currentUserId = req.user?.id || req.user?.userId;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Falta conversationId' });
    }

    // Validar que el usuario pertenece a la conversación
    const conversation = await Chat.getConversationMetadata([conversationId]);
    if (!conversation.length || !conversation[0].participants?.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para esta conversación' });
    }

    const messageLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    
    // Obtener mensajes más recientes que lastMessageId
    const result = await Chat.listMessagesAfter(conversationId, {
      limit: messageLimit,
      afterMessageId: lastMessageId ? String(lastMessageId) : undefined,
    });
    
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('getNewMessages error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

// Nueva función para obtener estadísticas de conversación
export const getConversationStats = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user?.id || req.user?.userId;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Falta conversationId' });
    }

    // Validar que el usuario pertenece a la conversación
    const conversation = await Chat.getConversationMetadata([conversationId]);
    if (!conversation.length || !conversation[0].participants?.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para esta conversación' });
    }

    const stats = await Chat.getConversationStats(conversationId);
    
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('getConversationStats error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

// Nueva función para marcar mensajes como leídos
export const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { messageIds } = req.body;
    const currentUserId = req.user?.id || req.user?.userId;

    if (!conversationId || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, message: 'Datos incompletos' });
    }

    // Validar que el usuario pertenece a la conversación
    const conversation = await Chat.getConversationMetadata([conversationId]);
    if (!conversation.length || !conversation[0].participants?.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para esta conversación' });
    }

    await Chat.markMessagesAsRead(conversationId, messageIds, currentUserId);
    
    return res.json({ success: true, message: 'Mensajes marcados como leídos' });
  } catch (error) {
    console.error('markMessagesAsRead error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};

// Nueva función para obtener información del otro usuario en una conversación
export const getOtherUserInfo = async (req, res) => {
  try {
    console.log('🔍 getOtherUserInfo: Iniciando solicitud');
    console.log('🔍 getOtherUserInfo: req.params:', req.params);
    console.log('🔍 getOtherUserInfo: req.user:', req.user);
    
    const { conversationId } = req.params;
    const currentUserId = req.user?.id || req.user?.userId;

    console.log('🔍 getOtherUserInfo: conversationId:', conversationId);
    console.log('🔍 getOtherUserInfo: currentUserId:', currentUserId);

    if (!conversationId || !currentUserId) {
      console.log('❌ getOtherUserInfo: Faltan parámetros');
      return res.status(400).json({ success: false, message: 'Faltan parámetros' });
    }

    // Obtener metadatos de la conversación
    const conversationMetadata = await Chat.getConversationMetadata([conversationId]);
    if (!conversationMetadata.length) {
      return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
    }

    const conversation = conversationMetadata[0];
    
    // Validar que el usuario pertenece a la conversación
    if (!conversation.participants?.includes(currentUserId)) {
      return res.status(403).json({ success: false, message: 'No autorizado para esta conversación' });
    }

    // Encontrar el ID del otro usuario
    const otherUserId = conversation.participants.find(id => String(id) !== String(currentUserId));
    if (!otherUserId) {
      return res.status(400).json({ success: false, message: 'No se pudo identificar al otro usuario' });
    }

    // Obtener información del otro usuario
    const otherUser = await Chat.getUsersByIds([otherUserId]);
    if (!otherUser.length) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const userInfo = otherUser[0];
    
    // Calcular edad si tiene fecha de nacimiento
    let age = null;
    if (userInfo.birthDate) {
      const birthDate = new Date(userInfo.birthDate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Extraer país y bandera
    let country = 'Unknown';
    let countryFlag = '🌍';
    
    if (userInfo.location) {
      let addressString = '';
      
      if (typeof userInfo.location === 'string') {
        addressString = userInfo.location;
      } else if (userInfo.location.address) {
        addressString = userInfo.location.address;
      } else if (userInfo.location.country) {
        addressString = userInfo.location.country;
      }
      
      if (addressString) {
        const { getFlagFromAddress, extractCountryFromAddress } = await import('../utils/countryFlags.js');
        country = extractCountryFromAddress(addressString) || 'Unknown';
        countryFlag = getFlagFromAddress(addressString);
      }
    }

    // Preparar respuesta con información del usuario
    const userResponse = {
      id: userInfo.id,
      name: userInfo.displayName || userInfo.username || `Usuario ${userInfo.id.slice(-4)}`,
      username: userInfo.username,
      email: userInfo.email,
      profileImage: userInfo.profileImage,
      age: age,
      gender: userInfo.gender || 'other',
      country: country,
      countryFlag: countryFlag,
      description: userInfo.description || 'Usuario de Luna',
      isOnline: userInfo.isOnline || false,
      lastSeen: userInfo.lastConnection,
      lastConnection: userInfo.lastConnection,
      birthDate: userInfo.birthDate,
      location: userInfo.location,
      profileCompleted: userInfo.profileCompleted || false
    };

    return res.json({ success: true, data: { otherUser: userResponse } });
  } catch (error) {
    console.error('getOtherUserInfo error', error);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
};