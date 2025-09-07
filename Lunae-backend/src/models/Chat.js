import { PutCommand, QueryCommand, GetCommand, UpdateCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';
import { User } from './Users.js';
import { getFlagFromAddress, extractCountryFromAddress } from '../utils/countryFlags.js';

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
   * Lista conversaciones del usuario autenticado con información del otro usuario
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
    const userConversations = result.Items || [];
    
    // Si no hay conversaciones, devolver vacío
    if (userConversations.length === 0) {
      return { items: [], nextKey: result.LastEvaluatedKey };
    }

    // Obtener información de los otros usuarios
    const otherUserIds = userConversations.map(conv => conv.otherUserId);
    console.log('🔍 listUserConversations: otherUserIds extraídos:', otherUserIds);
    console.log('🔍 listUserConversations: userConversations raw:', userConversations);
    
    const otherUsers = await this.getUsersByIds(otherUserIds);
    console.log('🔍 listUserConversations: otherUsers obtenidos:', otherUsers.length);
    console.log('🔍 listUserConversations: otherUsers detalle:', otherUsers.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      birthDate: u.birthDate,
      gender: u.gender,
      location: u.location
    })));

    // Obtener metadatos de conversación para cada conversación
    const conversationIds = userConversations.map(conv => conv.conversationId);
    console.log('🔍 listUserConversations: Obteniendo metadatos para conversaciones:', conversationIds);
    
    const conversationMetadata = await this.getConversationMetadata(conversationIds);
    console.log('🔍 listUserConversations: Metadatos obtenidos:', conversationMetadata.length);
    
    // Combinar información de conversación con datos del otro usuario y metadatos
    const enrichedConversations = userConversations.map(conv => {
      const otherUser = otherUsers.find(user => user.id === conv.otherUserId);
      const metadata = conversationMetadata.find(meta => meta.conversationId === conv.conversationId);
      
      console.log('🔍 listUserConversations: Procesando conversación:', {
        conversationId: conv.conversationId,
        otherUserId: conv.otherUserId,
        otherUserFound: !!otherUser,
        otherUserName: otherUser?.displayName || otherUser?.username,
        otherUserLocation: otherUser?.location,
        otherUserLocationType: typeof otherUser?.location,
        metadataFound: !!metadata,
        lastMessagePreview: metadata?.lastMessagePreview,
        lastMessageAt: metadata?.lastMessageAt
      });
      
      // Calcular edad si hay fecha de nacimiento
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
      
      // Extraer país y bandera de la ubicación usando la misma lógica que el frontend
      let country = 'Unknown';
      let countryFlag = '🌍';
      
      if (otherUser?.location) {
        console.log('🔍 listUserConversations: Procesando ubicación para usuario:', {
          userId: otherUser.id,
          location: otherUser.location,
          locationType: typeof otherUser.location
        });
        
        let addressString = '';
        
        if (typeof otherUser.location === 'string') {
          addressString = otherUser.location;
        } else if (otherUser.location.address) {
          addressString = otherUser.location.address;
        } else if (otherUser.location.country) {
          addressString = otherUser.location.country;
        }
        
        if (addressString) {
          // Usar la misma función que el frontend
          country = extractCountryFromAddress(addressString) || 'Unknown';
          countryFlag = getFlagFromAddress(addressString);
          
          console.log('🔍 listUserConversations: País y bandera extraídos:', {
            addressString: addressString,
            country: country,
            countryFlag: countryFlag
          });
        }
      } else {
        console.log('🔍 listUserConversations: No hay ubicación para usuario:', otherUser.id);
      }
      
      return {
        ...conv,
        // Incluir metadatos de conversación
        lastMessagePreview: metadata?.lastMessagePreview || '',
        lastMessageAt: metadata?.lastMessageAt || conv.createdAt,
        createdAt: metadata?.createdAt || conv.createdAt,
        updatedAt: metadata?.updatedAt || conv.updatedAt,
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
    });

    return { items: enrichedConversations, nextKey: result.LastEvaluatedKey };
  }

  /**
   * Obtiene múltiples usuarios por sus IDs usando BatchGet
   */
  static async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      console.log('🔍 getUsersByIds: No hay userIds para obtener');
      return [];
    }

    try {
      console.log('🔍 getUsersByIds: Obteniendo usuarios para IDs:', userIds);
      
      // Crear claves para BatchGet usando el formato correcto
      const keys = userIds.map(userId => ({
        PK: `USER#${String(userId)}`,
        SK: `PROFILE#${String(userId)}`
      }));

      console.log('🔍 getUsersByIds: Claves creadas:', keys);

      try {
        // Usar BatchGet (más eficiente) ahora que tenemos permisos
        const batchGetCommand = new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: keys
            }
          }
        });

        console.log('🔍 getUsersByIds: Ejecutando BatchGet con parámetros:', batchGetCommand);
        const result = await docClient.send(batchGetCommand);
        const users = result.Responses?.[TABLE_NAME] || [];
        
        console.log('🔍 getUsersByIds: Resultado BatchGet:', result);
        console.log('🔍 getUsersByIds: Usuarios obtenidos de BatchGet:', users.length);
        
        // Filtrar usuarios únicos por ID para evitar duplicados
        const uniqueUsers = users.filter((user, index, self) => 
          index === self.findIndex(u => u.id === user.id)
        );
        
        // Si BatchGet no devolvió usuarios, usar Query fallback
        if (uniqueUsers.length === 0) {
          console.log('⚠️ getUsersByIds: BatchGet no devolvió usuarios, intentando Query fallback...');
          return await this.getUsersByIdsFallback(userIds);
        }
        
        // Procesar usuarios obtenidos de BatchGet directamente
        console.log('🔍 getUsersByIds: Procesando usuarios de BatchGet:', uniqueUsers.length);
        
        // Los datos ya deberían estar en formato normal (no DynamoDB raw)
        // Convertir a objetos User para tener acceso a métodos de utilidad
        const userObjects = uniqueUsers.map(userData => {
          try {
            const user = new User(userData);
            console.log('🔍 getUsersByIds: Usuario convertido:', {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              birthDate: user.birthDate,
              gender: user.gender,
              location: user.location,
              profileImage: user.profileImage,
              description: user.description,
              isOnline: user.isOnline,
              lastConnection: user.lastConnection,
              profileCompleted: user.profileCompleted
            });
            return user;
          } catch (error) {
            console.error('❌ Error convirtiendo usuario:', error, userData);
            return null;
          }
        }).filter(user => user !== null);
        
        console.log('🔍 getUsersByIds: Usuarios finales:', userObjects.length);
        return userObjects;
        
      } catch (error) {
        console.error('❌ Error en BatchGet:', error);
        console.log('⚠️ getUsersByIds: Error en BatchGet, intentando Query fallback...');
        return await this.getUsersByIdsFallback(userIds);
      }
    } catch (error) {
      console.error('❌ Error obteniendo usuarios por IDs:', error);
      return [];
    }
  }

  /**
   * Obtiene metadatos de conversación para múltiples conversaciones
   */
  static async getConversationMetadata(conversationIds) {
    if (!conversationIds || conversationIds.length === 0) {
      console.log('🔍 getConversationMetadata: No hay conversationIds para obtener');
      return [];
    }

    try {
      console.log('🔍 getConversationMetadata: Obteniendo metadatos para conversaciones:', conversationIds);
      
      // Crear claves para BatchGet
      const keys = conversationIds.map(conversationId => ({
        PK: `CONV#${conversationId}`,
        SK: `META#${conversationId}`
      }));

      console.log('🔍 getConversationMetadata: Claves creadas:', keys);

      try {
        // Usar BatchGet para obtener metadatos
        const batchGetCommand = new BatchGetCommand({
          RequestItems: {
            [TABLE_NAME]: {
              Keys: keys
            }
          }
        });

        console.log('🔍 getConversationMetadata: Ejecutando BatchGet con parámetros:', batchGetCommand);
        const result = await docClient.send(batchGetCommand);
        const metadata = result.Responses?.[TABLE_NAME] || [];
        
        console.log('🔍 getConversationMetadata: Resultado BatchGet:', result);
        console.log('🔍 getConversationMetadata: Metadatos obtenidos de BatchGet:', metadata.length);
        
        // Log de los metadatos obtenidos
        metadata.forEach(meta => {
          console.log('🔍 getConversationMetadata: Metadatos de conversación:', {
            conversationId: meta.conversationId,
            lastMessagePreview: meta.lastMessagePreview,
            lastMessageAt: meta.lastMessageAt,
            createdAt: meta.createdAt,
            updatedAt: meta.updatedAt
          });
        });
        
        return metadata;
        
      } catch (error) {
        console.error('❌ Error en BatchGet para metadatos:', error);
        console.log('⚠️ getConversationMetadata: Error en BatchGet, intentando Query fallback...');
        return await this.getConversationMetadataFallback(conversationIds);
      }
    } catch (error) {
      console.error('❌ Error obteniendo metadatos de conversación:', error);
      return [];
    }
  }

  // Método fallback para obtener metadatos de conversación usando Query individual
  static async getConversationMetadataFallback(conversationIds) {
    console.log('🔍 getConversationMetadataFallback: Obteniendo metadatos con Query individual para conversaciones:', conversationIds);
    
    const metadata = [];
    for (const conversationId of conversationIds) {
      try {
        const queryCommand = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': `CONV#${conversationId}`,
            ':sk': `META#${conversationId}`
          }
        });
        
        const queryResult = await docClient.send(queryCommand);
        if (queryResult.Items && queryResult.Items.length > 0) {
          metadata.push(queryResult.Items[0]);
          console.log('🔍 getConversationMetadataFallback: Metadatos encontrados para conversación:', conversationId);
        } else {
          console.log('⚠️ getConversationMetadataFallback: Metadatos no encontrados para conversación:', conversationId);
        }
      } catch (queryError) {
        console.error('❌ Error en Query individual para metadatos de conversación:', conversationId, queryError);
      }
    }
    
    console.log('🔍 getConversationMetadataFallback: Total metadatos encontrados:', metadata.length);
    return metadata;
  }

  // Método fallback para obtener usuarios por IDs usando Query individual
  static async getUsersByIdsFallback(userIds) {
    console.log('🔍 getUsersByIdsFallback: Obteniendo usuarios con Query individual para IDs:', userIds);
    
    const users = [];
    for (const userId of userIds) {
      try {
        const queryCommand = new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND SK = :sk',
          ExpressionAttributeValues: {
            ':pk': `USER#${String(userId)}`,
            ':sk': `PROFILE#${String(userId)}`
          }
        });
        
        const queryResult = await docClient.send(queryCommand);
        if (queryResult.Items && queryResult.Items.length > 0) {
          users.push(queryResult.Items[0]);
          console.log('🔍 getUsersByIdsFallback: Usuario encontrado:', userId);
        } else {
          console.log('⚠️ getUsersByIdsFallback: Usuario no encontrado:', userId);
        }
      } catch (queryError) {
        console.error('❌ Error en Query individual para usuario:', userId, queryError);
      }
    }
    
    console.log('🔍 getUsersByIdsFallback: Total usuarios encontrados:', users.length);
    
    // Procesar usuarios obtenidos de Query directamente
    console.log('🔍 getUsersByIdsFallback: Procesando usuarios de Query:', users.length);
    
    // Los datos ya deberían estar en formato normal (no DynamoDB raw)
    // Convertir a objetos User para tener acceso a métodos de utilidad
    const userObjects = users.map(userData => {
      try {
        const user = new User(userData);
        console.log('🔍 getUsersByIdsFallback: Usuario convertido:', {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          birthDate: user.birthDate,
          gender: user.gender,
          location: user.location,
          profileImage: user.profileImage,
          description: user.description,
          isOnline: user.isOnline,
          lastConnection: user.lastConnection,
          profileCompleted: user.profileCompleted
        });
        return user;
      } catch (error) {
        console.error('❌ Error convirtiendo usuario en fallback:', error, userData);
        return null;
      }
    }).filter(user => user !== null);
    
    console.log('🔍 getUsersByIdsFallback: Usuarios finales:', userObjects.length);
    return userObjects;
  }
}

export default Chat;



