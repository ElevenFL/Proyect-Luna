import { PutCommand, QueryCommand, GetCommand, UpdateCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { User } from './Users.js';
import { getFlagFromAddress, extractCountryFromAddress } from '../utils/countryFlags.js';

// Usamos la misma Single Table que Usuarios
const TABLE_NAME = 'Lunea-chat';

/**
 * Función para deserializar datos de DynamoDB
 * Convierte el formato de DynamoDB (L, S, N, etc.) a tipos JavaScript nativos
 */
const deserializeDynamoItem = (item) => {
  if (!item) return item;
  
  const deserialized = {};
  for (const [key, value] of Object.entries(item)) {
    if (value && typeof value === 'object') {
      if (value.L) {
        // Lista - deserializar cada elemento
        deserialized[key] = value.L.map(item => {
          if (item.S) return item.S;
          if (item.N) return Number(item.N);
          if (item.BOOL !== undefined) return item.BOOL;
          return deserializeDynamoItem(item);
        });
      } else if (value.S) {
        // String
        deserialized[key] = value.S;
      } else if (value.N) {
        // Number
        deserialized[key] = Number(value.N);
      } else if (value.BOOL !== undefined) {
        // Boolean
        deserialized[key] = value.BOOL;
      } else if (value.M) {
        // Map
        deserialized[key] = deserializeDynamoItem(value.M);
      } else {
        // Ya deserializado o tipo no reconocido
        deserialized[key] = value;
      }
    } else {
      deserialized[key] = value;
    }
  }
  return deserialized;
};

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
    try {
      console.log('🔍 Chat.getOrCreateConversation: Iniciando con:', { currentUserId, otherUserId });
      
      const conversationId = buildConversationId(currentUserId, otherUserId);
      const PK = pkForConversation(conversationId);
      const SK = skForConversationMeta(conversationId);

      console.log('🔍 Chat.getOrCreateConversation: Keys generadas:', { conversationId, PK, SK });

      // Intentar leer metadata
      const getCommand = new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK }
      });

      console.log('🔍 Chat.getOrCreateConversation: Ejecutando GetCommand...');
      const { Item } = await docClient.send(getCommand);
      
      if (Item) {
        console.log('✅ Chat.getOrCreateConversation: Conversación encontrada');
        // Deserializar si es necesario
        const deserializedItem = Item.participants && Item.participants.L ? deserializeDynamoItem(Item) : Item;
        return { conversationId, conversation: deserializedItem };
      }

      console.log('🔧 Chat.getOrCreateConversation: Creando nueva conversación...');
      
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

      console.log('🔧 Chat.getOrCreateConversation: Metadata creada:', metaItem);

      // Usar transacciones para atomicidad
      const batchWrites = [];
      
      // Metadatos de conversación
      batchWrites.push({
        PutRequest: {
          Item: metaItem
        }
      });

      // Referencias por usuario
      [String(currentUserId), String(otherUserId)].forEach((userId) => {
        batchWrites.push({
          PutRequest: {
            Item: {
              PK: `USER#${userId}`,
              SK: skForUserConversation(conversationId),
              entityType: 'UserConversation',
              conversationId,
              otherUserId: userId === String(currentUserId) ? String(otherUserId) : String(currentUserId),
              createdAt: now,
              updatedAt: now
            }
          }
        });
      });

      console.log('🔧 Chat.getOrCreateConversation: Ejecutando BatchWrite con', batchWrites.length, 'items');

      // Usar BatchWriteCommand para mejor rendimiento (ahora que tenemos los permisos)
      const { BatchWriteCommand } = await import('@aws-sdk/lib-dynamodb');
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batchWrites
        }
      }));

      console.log('✅ Chat.getOrCreateConversation: Nueva conversación creada:', conversationId);
      return { conversationId, conversation: metaItem };
    } catch (error) {
      console.error('❌ Chat.getOrCreateConversation: Error:', error);
      console.error('❌ Chat.getOrCreateConversation: Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Envía un mensaje en una conversación
   */
  static async sendMessage(conversationId, { senderId, receiverId, content, type = 'text' }) {
    const now = new Date().toISOString();
    const messageId = uuidv4();
    const PK = pkForConversation(conversationId);
    const SK = skForMessage(now, messageId);

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

    // Usar transacción para atomicidad
    const batchWrites = [
      {
        PutRequest: {
          Item: messageItem
        }
      }
    ];

    // Actualizar metadatos de conversación
    const updateCommand = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK, SK: skForConversationMeta(conversationId) },
      UpdateExpression: 'SET lastMessagePreview = :preview, lastMessageAt = :at, updatedAt = :at',
      ExpressionAttributeValues: {
        ':preview': type === 'text' ? content.slice(0, 120) : `[${type}]`,
        ':at': now
      },
      ReturnValues: 'NONE'
    });

    // Ejecutar en paralelo
    await Promise.all([
      docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: messageItem })),
      docClient.send(updateCommand)
    ]);

    return messageItem;
  }

  /**
   * Lista mensajes de una conversación (optimizado)
   */
  static async listMessages(conversationId, { limit = 30, exclusiveStartKey } = {}) {
    const PK = pkForConversation(conversationId);
    
    // Usar índice GSI si está disponible para mejor rendimiento
    const query = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :msgPrefix)',
      ExpressionAttributeValues: {
        ':pk': PK,
        ':msgPrefix': 'MSG#'
      },
      Limit: Math.min(limit, 100), // Máximo 100 mensajes por consulta
      ExclusiveStartKey: exclusiveStartKey,
      ScanIndexForward: false, // descendente por fecha - mensajes más recientes primero
      ProjectionExpression: 'messageId, senderId, receiverId, content, #type, createdAt, #read, entityType, conversationId',
      ExpressionAttributeNames: {
        '#type': 'type',
        '#read': 'read'
      }
    });

    const result = await docClient.send(query);
    
    return { 
      items: result.Items || [], 
      nextKey: result.LastEvaluatedKey,
      count: result.Count
    };
  }

  /**
   * Lista mensajes después de un messageId específico (para sincronización incremental)
   */
  static async listMessagesAfter(conversationId, { limit = 20, afterMessageId } = {}) {
    const PK = pkForConversation(conversationId);
    
    let queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :msgPrefix)',
      ExpressionAttributeValues: {
        ':pk': PK,
        ':msgPrefix': 'MSG#'
      },
      Limit: Math.min(limit, 50),
      ScanIndexForward: false, // Más recientes primero
      ProjectionExpression: 'messageId, senderId, receiverId, content, #type, createdAt, #read, entityType, conversationId',
      ExpressionAttributeNames: {
        '#type': 'type',
        '#read': 'read'
      }
    };

    // Si hay afterMessageId, buscar desde ese punto
    if (afterMessageId) {
      // Primero obtener el timestamp del mensaje de referencia
      const allMessages = await this.listMessages(conversationId, { limit: 1000 });
      const afterMessage = allMessages.items.find(m => m.messageId === afterMessageId);
      
      if (afterMessage) {
        queryParams.KeyConditionExpression += ' AND SK > :afterSK';
        queryParams.ExpressionAttributeValues[':afterSK'] = `MSG#${afterMessage.createdAt}`;
      }
    }

    const result = await docClient.send(new QueryCommand(queryParams));
    
    return { 
      items: result.Items || [], 
      nextKey: result.LastEvaluatedKey,
      count: result.Count
    };
  }

  /**
   * Lista conversaciones del usuario con optimizaciones mejoradas
   */
  static async listUserConversations(userId, { limit = 20, exclusiveStartKey } = {}) {
    try {
      // Reducir límite para mejorar rendimiento
      const optimizedLimit = Math.min(limit, 20);
      
      // Usar batch para obtener conversaciones más eficientemente
      const query = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :convPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${String(userId)}`,
          ':convPrefix': 'CONV#'
        },
        Limit: optimizedLimit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false,
        // Optimizaciones de rendimiento
        ReturnConsumedCapacity: 'NONE',
        ProjectionExpression: 'conversationId, otherUserId, createdAt, updatedAt, lastMessageAt'
      });

      const result = await docClient.send(query);
      const userConversations = result.Items || [];
      
      if (userConversations.length === 0) {
        return { items: [], nextKey: result.LastEvaluatedKey };
      }

      // Obtener información en paralelo con timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout en operaciones paralelas')), 10000); // 10s timeout
      });

      const dataPromise = Promise.all([
        this.getUsersByIds(userConversations.map(conv => conv.otherUserId)),
        this.getConversationMetadata(userConversations.map(conv => conv.conversationId))
      ]);

      const [otherUsers, conversationMetadata] = await Promise.race([dataPromise, timeoutPromise]);

      // Crear mapas para búsqueda rápida
      const userMap = new Map(otherUsers.map(user => [user.id, user]));
      const metadataMap = new Map(conversationMetadata.map(meta => [meta.conversationId, meta]));

      // Procesar conversaciones de forma más eficiente
      const enrichedConversations = await Promise.all(
        userConversations.map(async conv => {
          const otherUser = userMap.get(conv.otherUserId);
          const metadata = metadataMap.get(conv.conversationId);
          
          return await this.enrichConversationData(conv, otherUser, metadata, userId);
        })
      );

      return { items: enrichedConversations, nextKey: result.LastEvaluatedKey };
    } catch (error) {
      console.error('❌ Error en listUserConversations:', error);
      // Retornar datos básicos en caso de error para no bloquear la UI
      return { items: [], nextKey: null, error: error.message };
    }
  }

  /**
   * Obtiene múltiples usuarios por sus IDs (optimizado con BatchGet)
   */
  static async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    // Eliminar duplicados
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    
    try {
      // Usar BatchGet para obtener múltiples usuarios eficientemente
      const keys = uniqueUserIds.map(userId => ({
        PK: `USER#${String(userId)}`,
        SK: `PROFILE#${String(userId)}`
      }));

      // BatchGet tiene límite de 100 items
      const batches = [];
      for (let i = 0; i < keys.length; i += 100) {
        batches.push(keys.slice(i, i + 100));
      }

      const allUsers = [];
      for (const batch of batches) {
        const batchGetCommand = new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: batch,
              ProjectionExpression: 'id, username, displayName, profileImage, birthDate, gender, #location, description, isOnline, lastConnection, profileCompleted',
              ExpressionAttributeNames: {
                '#location': 'location'
              }
            }
          }
        });

        const batchResult = await docClient.send(batchGetCommand);
        const users = batchResult.Responses?.[TABLE_NAME] || [];
        allUsers.push(...users);
      }

      // Convertir a objetos User
      return allUsers.map(userData => new User(userData)).filter(Boolean);
      
    } catch (error) {
      console.error('❌ Error en BatchGet de usuarios:', error);
      return [];
    }
  }

  /**
   * Obtiene metadatos de múltiples conversaciones (optimizado)
   */
  static async getConversationMetadata(conversationIds) {
    if (!conversationIds || conversationIds.length === 0) {
      return [];
    }

    try {
      const keys = conversationIds.map(conversationId => ({
        PK: `CONV#${conversationId}`,
        SK: `META#${conversationId}`
      }));

      const batchGetCommand = new BatchGetCommand({
        RequestItems: {
          [TABLE_NAME]: {
            Keys: keys,
            ProjectionExpression: 'conversationId, lastMessagePreview, lastMessageAt, createdAt, updatedAt, participants'
          }
        }
      });

      const result = await docClient.send(batchGetCommand);
      const items = result.Responses?.[TABLE_NAME] || [];
      
      // Deserializar los datos si es necesario
      return items.map(item => {
        // Log para debugging
        console.log('🔍 Chat: Datos de conversación obtenidos:', {
          conversationId: item.conversationId,
          participants: item.participants,
          participantsType: typeof item.participants,
          isArray: Array.isArray(item.participants),
          hasLProperty: item.participants && item.participants.L
        });
        
        // Verificar si necesita deserialización (formato DynamoDB crudo)
        if (item.participants && item.participants.L) {
          console.log('🔧 Chat: Deserializando datos de DynamoDB para conversación:', item.conversationId);
          const deserialized = deserializeDynamoItem(item);
          console.log('✅ Chat: Datos deserializados:', {
            conversationId: deserialized.conversationId,
            participants: deserialized.participants
          });
          return deserialized;
        }
        
        // Si ya está deserializado pero está vacío, verificar si es un problema de datos
        if (Array.isArray(item.participants) && item.participants.length === 0) {
          console.warn('⚠️ Chat: Conversación con participants vacío:', item.conversationId);
        }
        
        return item;
      });
      
    } catch (error) {
      console.error('❌ Error en BatchGet de metadatos:', error);
      return [];
    }
  }

  /**
   * Enriquece los datos de conversación con información del usuario y metadatos
   */
  static async enrichConversationData(conv, otherUser, metadata, currentUserId) {
    // Asegurar que los participants estén presentes
    let participants = [];
    if (metadata && metadata.participants && Array.isArray(metadata.participants)) {
      participants = metadata.participants;
    } else if (conv && conv.participants && Array.isArray(conv.participants)) {
      participants = conv.participants;
    }
    
    // Log para debugging
    if (participants.length === 0) {
      console.warn('⚠️ Chat: enrichConversationData - participants vacío para conversación:', conv.conversationId, {
        metadataParticipants: metadata?.participants,
        convParticipants: conv?.participants
      });
    }
    
    // Calcular mensajes no leídos desde la base de datos
    let unreadCount = 0;
    try {
      unreadCount = await this.getUnreadCountForUser(conv.conversationId, currentUserId);
    } catch (error) {
      console.error('❌ Chat: Error calculando mensajes no leídos:', error);
      unreadCount = 0;
    }
    
    // Calcular edad
    let age = null;
    if (otherUser?.birthDate) {
      const birthDate = new Date(otherUser.birthDate);
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
    
    if (otherUser?.location) {
      let addressString = '';
      
      if (typeof otherUser.location === 'string') {
        addressString = otherUser.location;
      } else if (otherUser.location.address) {
        addressString = otherUser.location.address;
      } else if (otherUser.location.country) {
        addressString = otherUser.location.country;
      }
      
      if (addressString) {
        country = extractCountryFromAddress(addressString) || 'Unknown';
        countryFlag = getFlagFromAddress(addressString);
      }
    }

    return {
      ...conv,
      participants: participants, // Asegurar que participants esté incluido
      lastMessagePreview: metadata?.lastMessagePreview || '',
      lastMessageAt: metadata?.lastMessageAt || conv.createdAt,
      createdAt: metadata?.createdAt || conv.createdAt,
      updatedAt: metadata?.updatedAt || conv.updatedAt,
      unreadCount: unreadCount, // Incluir contador de mensajes no leídos
      otherUser: otherUser ? {
        id: otherUser.id,
        name: otherUser.displayName || otherUser.username || `Usuario ${conv.otherUserId.slice(-4)}`,
        username: otherUser.username,
        email: otherUser.email,
        profileImage: otherUser.profileImage,
        age: age,
        gender: otherUser.gender || 'other',
        country: country,
        countryFlag: countryFlag,
        description: otherUser.description || 'Usuario de Luna',
        isOnline: otherUser.isOnline || false,
        lastSeen: otherUser.lastConnection,
        lastConnection: otherUser.lastConnection,
        birthDate: otherUser.birthDate,
        location: otherUser.location,
        profileCompleted: otherUser.profileCompleted || false
      } : {
        id: conv.otherUserId,
        name: `Usuario ${conv.otherUserId.slice(-4)}`,
        username: `user_${conv.otherUserId.slice(-4)}`,
        age: null,
        gender: 'other',
        country: 'Unknown',
        countryFlag: '🌍',
        description: 'Usuario de Luna',
        isOnline: false,
        profileCompleted: false
      }
    };
  }

  /**
   * Obtiene estadísticas de una conversación
   */
  static async getConversationStats(conversationId) {
    const PK = pkForConversation(conversationId);
    
    // Contar mensajes totales
    const countQuery = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :msgPrefix)',
      ExpressionAttributeValues: {
        ':pk': PK,
        ':msgPrefix': 'MSG#'
      },
      Select: 'COUNT'
    });

    // Obtener último mensaje
    const lastMessageQuery = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :msgPrefix)',
      ExpressionAttributeValues: {
        ':pk': PK,
        ':msgPrefix': 'MSG#'
      },
      ScanIndexForward: false,
      Limit: 1
    });

    const [countResult, lastMessageResult] = await Promise.all([
      docClient.send(countQuery),
      docClient.send(lastMessageQuery)
    ]);

    return {
      totalMessages: countResult.Count || 0,
      lastMessage: lastMessageResult.Items?.[0] || null,
      conversationId
    };
  }

  /**
   * Obtiene el número de mensajes no leídos para un usuario en una conversación
   */
  static async getUnreadCountForUser(conversationId, userId) {
    try {
      const PK = pkForConversation(conversationId);
      
      // Consultar mensajes no leídos del otro usuario (no del usuario actual)
      const query = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :msgPrefix)',
        FilterExpression: 'senderId <> :userId AND #read = :read',
        ExpressionAttributeValues: {
          ':pk': PK,
          ':msgPrefix': 'MSG#',
          ':userId': String(userId),
          ':read': false
        },
        ExpressionAttributeNames: {
          '#read': 'read'
        },
        Select: 'COUNT'
      });

      const result = await docClient.send(query);
      return result.Count || 0;
    } catch (error) {
      console.error('❌ Chat: Error obteniendo contador de mensajes no leídos:', error);
      return 0;
    }
  }

  /**
   * Marca mensajes como leídos (batch operation)
   */
  static async markMessagesAsRead(conversationId, messageIds, userId) {
    if (!messageIds || messageIds.length === 0) return;

    const PK = pkForConversation(conversationId);
    
    try {
      // Obtener mensajes recientes para encontrar los que necesitamos actualizar
      const recentMessages = await this.listMessages(conversationId, { limit: 100 });
      const messagesToUpdate = recentMessages.items.filter(msg => 
        messageIds.includes(msg.messageId) && !msg.read
      );

      if (messagesToUpdate.length === 0) {
        console.log('⚠️ Chat: No se encontraron mensajes no leídos para actualizar');
        return;
      }

      // Usar UpdateCommand individual para cada mensaje
      const updatePromises = messagesToUpdate.map(message => {
        const updateCommand = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { 
            PK, 
            SK: `MSG#${message.createdAt}#${message.messageId}` 
          },
          UpdateExpression: 'SET #read = :read',
          ExpressionAttributeNames: { '#read': 'read' },
          ExpressionAttributeValues: { ':read': true },
          ReturnValues: 'NONE'
        });

        return docClient.send(updateCommand);
      });

      // Ejecutar todas las actualizaciones en paralelo
      await Promise.all(updatePromises);

      console.log(`✅ Chat: ${messagesToUpdate.length} mensajes marcados como leídos en conversación ${conversationId}`);
    } catch (error) {
      console.error('❌ Chat: Error marcando mensajes como leídos:', error);
      throw error;
    }
  }
}

export default Chat;