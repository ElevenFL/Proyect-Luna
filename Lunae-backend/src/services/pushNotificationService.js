import { Expo } from 'expo-server-sdk';
import { PushToken } from '../models/PushToken.js';

// Crear instancia de Expo SDK
const expo = new Expo();

/**
 * Servicio para enviar Push Notifications usando Expo
 */
export class PushNotificationService {
  /**
   * Envía una notificación push a un usuario específico
   */
  static async sendNotification(userId, title, body, data = {}, priority = 'high') {
    try {
      console.log(`📤 Enviando notificación a usuario ${userId}: ${title}`);

      // Obtener todos los tokens activos del usuario
      const tokens = await PushToken.getTokensByUserId(userId);

      if (tokens.length === 0) {
        console.log(`⚠️ Usuario ${userId} no tiene tokens registrados`);
        return { success: false, error: 'NO_TOKENS' };
      }

      // Filtrar solo tokens válidos de Expo
      const validTokens = tokens.filter(tokenData => 
        Expo.isExpoPushToken(tokenData.pushToken)
      );

      if (validTokens.length === 0) {
        console.log(`⚠️ Usuario ${userId} no tiene tokens válidos de Expo`);
        return { success: false, error: 'NO_VALID_TOKENS' };
      }

      // Crear mensajes de notificación
      const messages = validTokens.map(tokenData => ({
        to: tokenData.pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: {
          ...data,
          userId,
          timestamp: new Date().toISOString()
        },
        priority: priority,
        channelId: 'default',
      }));

      // Dividir en chunks (Expo recomienda máximo 100 notificaciones por chunk)
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];
      const invalidTokens = [];

      // Enviar cada chunk
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);

          // Verificar errores en tickets
          ticketChunk.forEach((ticket, index) => {
            if (ticket.status === 'error') {
              console.error(`❌ Error en ticket:`, ticket.message);
              
              // Si el token es inválido, marcarlo para desactivación
              if (
                ticket.details?.error === 'DeviceNotRegistered' ||
                ticket.message.includes('is not a registered push notification')
              ) {
                const message = chunk[index];
                invalidTokens.push(message.to);
              }
            }
          });
        } catch (error) {
          console.error('❌ Error enviando chunk de notificaciones:', error);
        }
      }

      // Desactivar tokens inválidos
      if (invalidTokens.length > 0) {
        console.log(`🧹 Desactivando ${invalidTokens.length} token(s) inválido(s)`);
        for (const token of invalidTokens) {
          await PushToken.deactivate(userId, token);
        }
      }

      // Actualizar lastUsed para tokens válidos
      for (const tokenData of validTokens) {
        if (!invalidTokens.includes(tokenData.pushToken)) {
          await PushToken.updateLastUsed(userId, tokenData.pushToken);
        }
      }

      console.log(`✅ Enviadas ${tickets.length} notificación(es) a usuario ${userId}`);
      return {
        success: true,
        ticketsCount: tickets.length,
        tickets,
        invalidTokens
      };
    } catch (error) {
      console.error('❌ Error en sendNotification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía notificaciones a múltiples usuarios
   */
  static async sendNotificationToMultipleUsers(userIds, title, body, data = {}) {
    try {
      const results = [];

      for (const userId of userIds) {
        const result = await this.sendNotification(userId, title, body, data);
        results.push({ userId, ...result });
      }

      console.log(`✅ Notificaciones enviadas a ${userIds.length} usuario(s)`);
      return results;
    } catch (error) {
      console.error('❌ Error en sendNotificationToMultipleUsers:', error);
      throw error;
    }
  }

  /**
   * Envía notificación de mensaje nuevo
   */
  static async sendNewMessageNotification(receiverId, senderName, messageContent, conversationId, senderId) {
    const truncatedContent = messageContent.length > 100 
      ? `${messageContent.substring(0, 100)}...` 
      : messageContent;

    return this.sendNotification(
      receiverId,
      `Nuevo mensaje de ${senderName}`,
      truncatedContent,
      {
        type: 'new-message',
        conversationId,
        senderId,
        senderName
      },
      'high'
    );
  }

  /**
   * Envía notificación de solicitud de amistad
   */
  static async sendFriendRequestNotification(receiverId, senderName, senderId, senderImage) {
    return this.sendNotification(
      receiverId,
      'Solicitud de amistad',
      `${senderName} quiere ser tu amiga`,
      {
        type: 'friend_request',
        senderId,
        senderName,
        senderImage
      },
      'high'
    );
  }

  /**
   * Envía notificación de solicitud de amistad aceptada
   */
  static async sendFriendRequestAcceptedNotification(receiverId, accepterName, accepterId, accepterImage) {
    return this.sendNotification(
      receiverId,
      'Solicitud aceptada',
      `${accepterName} aceptó tu solicitud de amistad`,
      {
        type: 'friend_request_accepted',
        accepterId,
        accepterName,
        accepterImage
      },
      'default'
    );
  }

  /**
   * Envía notificación de like
   */
  static async sendLikeNotification(receiverId, likerName, likerId) {
    return this.sendNotification(
      receiverId,
      'Nuevo like',
      `A ${likerName} le gustaste`,
      {
        type: 'like',
        likerId,
        likerName
      },
      'default'
    );
  }

  /**
   * Envía notificación de match
   */
  static async sendMatchNotification(receiverId, matchName, matchId) {
    return this.sendNotification(
      receiverId,
      '¡Match!',
      `Hiciste match con ${matchName}`,
      {
        type: 'match',
        matchId,
        matchName
      },
      'high'
    );
  }

  /**
   * Envía notificación de visita de perfil
   */
  static async sendProfileVisitNotification(receiverId, visitorName, visitorId) {
    return this.sendNotification(
      receiverId,
      'Visita de perfil',
      `${visitorName} visitó tu perfil`,
      {
        type: 'visit',
        visitorId,
        visitorName
      },
      'default'
    );
  }

  /**
   * Verifica el estado de los receipts de notificaciones enviadas
   * (Útil para hacer seguimiento de notificaciones entregadas)
   */
  static async checkReceiptStatus(ticketIds) {
    try {
      const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
      const receipts = [];

      for (const chunk of receiptIdChunks) {
        try {
          const receiptChunk = await expo.getPushNotificationReceiptsAsync(chunk);
          receipts.push(receiptChunk);
        } catch (error) {
          console.error('❌ Error obteniendo receipts:', error);
        }
      }

      return receipts;
    } catch (error) {
      console.error('❌ Error en checkReceiptStatus:', error);
      throw error;
    }
  }
}

export default PushNotificationService;

