import { getApp } from '../index.js';
import { PushNotificationService } from '../services/pushNotificationService.js';

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
 * Envía una notificación de solicitud de amistad por WebSocket y Push
 */
export const sendFriendRequestNotification = async (receiverId, senderInfo) => {
  try {
    const io = getSocketIO();
    let webSocketSent = false;
    let receiverOnline = false;

    // Intentar enviar por WebSocket
    if (io) {
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
      webSocketSent = true;
      
      // Verificar si el usuario está conectado
      receiverOnline = Array.from(io.sockets.sockets.values())
        .some(socket => socket.userId === String(receiverId));

      console.log(`🔔 Notificación WebSocket de solicitud de amistad enviada a usuario ${receiverId}`);
    } else {
      console.log('⚠️ Socket.IO no disponible, saltando notificación WebSocket');
    }

    // Si el usuario NO está conectado, enviar push notification
    if (!receiverOnline) {
      console.log(`📱 Usuario ${receiverId} offline, enviando push notification`);
      
      try {
        await PushNotificationService.sendFriendRequestNotification(
          receiverId,
          senderInfo.name,
          senderInfo.id,
          senderInfo.profileImage
        );
      } catch (pushError) {
        console.error('❌ Error enviando push notification de solicitud de amistad:', pushError);
        // No interrumpir el flujo si falla el push
      }
    } else {
      console.log(`✅ Usuario ${receiverId} está conectado, omitiendo push notification`);
    }

    return webSocketSent;
  } catch (error) {
    console.error('❌ Error enviando notificación de solicitud de amistad:', error);
    return false;
  }
};

/**
 * Envía una notificación de aceptación de solicitud de amistad por WebSocket y Push
 */
export const sendFriendRequestAcceptedNotification = async (senderId, receiverInfo) => {
  try {
    const io = getSocketIO();
    let webSocketSent = false;
    let senderOnline = false;

    // Intentar enviar por WebSocket
    if (io) {
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
      webSocketSent = true;

      // Verificar si el usuario está conectado
      senderOnline = Array.from(io.sockets.sockets.values())
        .some(socket => socket.userId === String(senderId));
      
      console.log(`🔔 Notificación WebSocket de solicitud aceptada enviada a usuario ${senderId}`);
    } else {
      console.log('⚠️ Socket.IO no disponible, saltando notificación WebSocket');
    }

    // Si el usuario NO está conectado, enviar push notification
    if (!senderOnline) {
      console.log(`📱 Usuario ${senderId} offline, enviando push notification`);
      
      try {
        await PushNotificationService.sendFriendRequestAcceptedNotification(
          senderId,
          receiverInfo.name,
          receiverInfo.id,
          receiverInfo.profileImage
        );
      } catch (pushError) {
        console.error('❌ Error enviando push notification de solicitud aceptada:', pushError);
        // No interrumpir el flujo si falla el push
      }
    } else {
      console.log(`✅ Usuario ${senderId} está conectado, omitiendo push notification`);
    }

    return webSocketSent;
  } catch (error) {
    console.error('❌ Error enviando notificación de solicitud aceptada:', error);
    return false;
  }
};




















