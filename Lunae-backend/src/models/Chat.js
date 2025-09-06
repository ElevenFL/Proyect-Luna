import { PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

// Usamos la misma Single Table que Usuarios
const TABLE_NAME = 'Lunea-chat';

/**
 * Utilidades para componer claves y IDs
 */
const buildConversationId = (userIdA, userIdB) => {
  // ID determinístico ordenando alfabéticamente para que A-B == B-A
  const [a, b] = [String(userIdA), String(userIdB)].sort();
  return `${a}__${b}`;
};

const pkForConversation = (conversationId) => `CONV#${conversationId}`;
const skForConversationMeta = (conversationId) => `META#${conversationId}`;
const skForMessage = (createdAtIso, messageId) => `MSG#${createdAtIso}#${messageId}`;
const skForUserConversation = (conversationId) => `CONV#${conversationId}`;

export class Chat {
  /**
   * Crea (si no existe) y devuelve la conversación entre dos usuarios
   */
  static async getOrCreateConversation(currentUserId, otherUserId) {
    const conversationId = buildConversationId(currentUserId, otherUserId);
    const PK = pkForConversation(conversationId);
    const SK = skForConversationMeta(conversationId);

    // Intentar leer metadata
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK }
    });

    const { Item } = await docClient.send(getCommand);
    if (Item) {
      return { conversationId, conversation: Item };
    }

    // Crear metadata de conversación
    const now = new Date().toISOString();
    const metaItem = {
      PK,
      SK,
      entityType: 'Conversation',
      conversationId,
      participants: [String(currentUserId), String(otherUserId)],
      createdAt: now,
      updatedAt: now,
      lastMessagePreview: '',
      lastMessageAt: now
    };

    // Escribir metadatos de conversación
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: metaItem
    }));

    // Crear referencias por usuario para listar conversaciones rápido
    const userRefs = [String(currentUserId), String(otherUserId)].map((userId) => ({
      PK: `USER#${userId}`,
      SK: skForUserConversation(conversationId),
      entityType: 'UserConversation',
      conversationId,
      otherUserId: userId === String(currentUserId) ? String(otherUserId) : String(currentUserId),
      createdAt: now,
      updatedAt: now
    }));

    for (const ref of userRefs) {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: ref }));
    }

    return { conversationId, conversation: metaItem };
  }

  /**
   * Envía un mensaje en una conversación
   */
  static async sendMessage(conversationId, { senderId, receiverId, content, type = 'text' }) {
    const now = new Date().toISOString();
    const messageId = uuidv4();
    const PK = pkForConversation(conversationId);
    const SK = skForMessage(now, messageId);

    // Debug: Log para verificar qué se está almacenando (comentado para producción)
    // console.log('🔍 Chat Model Debug - sendMessage:', {
    //   'senderId original': senderId,
    //   'senderId type': typeof senderId,
    //   'receiverId': receiverId,
    //   'conversationId': conversationId,
    //   'messageId': messageId
    // });

    const messageItem = {
      PK,
      SK,
      entityType: 'Message',
      conversationId,
      messageId,
      senderId: String(senderId),
      receiverId: String(receiverId),
      content,
      type,
      createdAt: now,
      read: false
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: messageItem }));

    // Actualizar metadatos de la conversación (preview y timestamp)
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK: skForConversationMeta(conversationId) },
      UpdateExpression: 'SET lastMessagePreview = :preview, lastMessageAt = :at, updatedAt = :at',
      ExpressionAttributeValues: {
        ':preview': type === 'text' ? content.slice(0, 120) : `[${type}]`,
        ':at': now
      }
    }));

    return messageItem;
  }

  /**
   * Lista mensajes de una conversación (paginado por fecha ascendente)
   */
  static async listMessages(conversationId, { limit = 30, exclusiveStartKey } = {}) {
    const PK = pkForConversation(conversationId);
    const query = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :msgPrefix)',
      ExpressionAttributeValues: {
        ':pk': PK,
        ':msgPrefix': 'MSG#'
      },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: true // ascendente
    });

    const result = await docClient.send(query);
    
    // Debug: Log para verificar qué mensajes se están devolviendo (comentado para producción)
    // console.log('🔍 Chat Model Debug - listMessages:', {
    //   'conversationId': conversationId,
    //   'messages count': result.Items?.length || 0,
    //   'sample messages': result.Items?.slice(0, 2).map(msg => ({
    //     'messageId': msg.messageId,
    //     'senderId': msg.senderId,
    //     'senderId type': typeof msg.senderId,
    //     'receiverId': msg.receiverId,
    //     'content': msg.content?.substring(0, 20) + '...'
    //   })) || []
    // });
    
    return { items: result.Items || [], nextKey: result.LastEvaluatedKey };
  }

  /**
   * Lista conversaciones del usuario autenticado
   */
  static async listUserConversations(userId, { limit = 30, exclusiveStartKey } = {}) {
    const query = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :convPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${String(userId)}`,
        ':convPrefix': 'CONV#'
      },
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false // convs más recientes primero si tuviéramos sort por tiempo, aquí es por SK
    });

    const result = await docClient.send(query);
    return { items: result.Items || [], nextKey: result.LastEvaluatedKey };
  }
}

export default Chat;



