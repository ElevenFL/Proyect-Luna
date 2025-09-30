import { getApp } from '../index.js';

/**
 * Obtiene la instancia de Socket.IO desde la aplicación Express
 */
export const getSocketIO = () => {
  try {
    // Importar dinámicamente para evitar dependencias circulares
    const app = getApp();
    if (!app) {
      console.error('❌ No se pudo obtener la instancia de la aplicación');
      return null;
    }
    
    const io = app.get('socketio');
    if (!io) {
      console.error('❌ Socket.IO no está configurado en la aplicación');
      return null;
    }
    
    return io;
  } catch (error) {
    console.error('❌ Error obteniendo Socket.IO:', error);
    return null;
  }
};

/**
 * Envía una notificación de solicitud de amistad por WebSocket
 */
export const sendFriendRequestNotification = async (receiverId, senderInfo) => {
  try {
    const io = getSocketIO();
    if (!io) {
      console.log('⚠️ Socket.IO no disponible, saltando notificación WebSocket');
      return false;
    }

    const notificationData = {
      type: 'friend_request',
      id: `fr_${Date.now()}`,
      title: 'Solicitud de amistad',
      message: `${senderInfo.name} quiere ser tu amiga`,
      userId: senderInfo.id,
      userName: senderInfo.name,
      userImage: senderInfo.profileImage,
      timestamp: new Date().toISOString(),
      isRead: false,
      friendRequestId: senderInfo.friendRequestId
    };

    // Enviar notificación al usuario receptor
    io.to(`user_${receiverId}`).emit('notification', notificationData);
    
    console.log(`🔔 Notificación de solicitud de amistad enviada a usuario ${receiverId}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación de solicitud de amistad:', error);
    return false;
  }
};

/**
 * Envía una notificación de aceptación de solicitud de amistad por WebSocket
 */
export const sendFriendRequestAcceptedNotification = async (senderId, receiverInfo) => {
  try {
    const io = getSocketIO();
    if (!io) {
      console.log('⚠️ Socket.IO no disponible, saltando notificación WebSocket');
      return false;
    }

    const notificationData = {
      type: 'friend_request_accepted',
      id: `fr_accepted_${Date.now()}`,
      title: 'Solicitud aceptada',
      message: `${receiverInfo.name} aceptó tu solicitud de amistad`,
      userId: receiverInfo.id,
      userName: receiverInfo.name,
      userImage: receiverInfo.profileImage,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    // Enviar notificación al usuario que envió la solicitud
    io.to(`user_${senderId}`).emit('notification', notificationData);
    
    console.log(`🔔 Notificación de solicitud aceptada enviada a usuario ${senderId}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando notificación de solicitud aceptada:', error);
    return false;
  }
};






