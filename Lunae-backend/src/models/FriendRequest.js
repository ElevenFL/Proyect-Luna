import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../config/db.js";

// Usar la misma Single Table que los otros modelos
const TABLE_NAME = 'Lunea-chat';

export class FriendRequest {
  constructor(data) {
    this.id = data.id;
    this.senderId = data.senderId;
    this.receiverId = data.receiverId;
    this.status = data.status || 'pending'; // pending, accepted, rejected
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    // Estructura para Single Table Design (PK/SK)
    this.PK = `FRIEND_REQUEST#${this.senderId}`;
    this.SK = `TO#${this.receiverId}`;
    this.entityType = 'FriendRequest';
  }

  /**
   * Crear una nueva solicitud de amistad
   */
  static async create(friendRequestData) {
    try {
      const friendRequest = new FriendRequest({
        id: `fr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...friendRequestData
      });

      const params = {
        TableName: TABLE_NAME,
        Item: friendRequest
      };

      await docClient.send(new PutCommand(params));
      console.log('✅ Solicitud de amistad creada:', friendRequest.id);
      return friendRequest;
    } catch (error) {
      console.error('❌ Error creando solicitud de amistad:', error);
      throw error;
    }
  }

  /**
   * Obtener una solicitud de amistad por ID
   */
  static async findById(id) {
    try {
      // Para encontrar por ID, necesitamos hacer un scan ya que el ID no es parte de la clave primaria
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: 'id = :id AND entityType = :entityType',
        ExpressionAttributeValues: {
          ':id': id,
          ':entityType': 'FriendRequest'
        }
      };

      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'entityType-index', // Asumiendo que tienes este índice
        KeyConditionExpression: 'entityType = :entityType',
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: {
          ':entityType': 'FriendRequest',
          ':id': id
        }
      }));
      
      return result.Items && result.Items.length > 0 ? new FriendRequest(result.Items[0]) : null;
    } catch (error) {
      console.error('❌ Error obteniendo solicitud de amistad:', error);
      throw error;
    }
  }

  /**
   * Obtener solicitudes de amistad enviadas por un usuario
   */
  static async findBySenderId(senderId) {
    try {
      const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `FRIEND_REQUEST#${senderId}`
        }
      };

      const result = await docClient.send(new QueryCommand(params));
      return result.Items ? result.Items.map(item => new FriendRequest(item)) : [];
    } catch (error) {
      console.error('❌ Error obteniendo solicitudes enviadas:', error);
      throw error;
    }
  }

  /**
   * Obtener solicitudes de amistad recibidas por un usuario
   */
  static async findByReceiverId(receiverId) {
    try {
      // Para obtener solicitudes recibidas, necesitamos usar un GSI o hacer scan
      // Asumiendo que tienes un GSI en receiverId
      const params = {
        TableName: TABLE_NAME,
        IndexName: 'receiverId-index', // Necesitarás crear este GSI
        KeyConditionExpression: 'receiverId = :receiverId',
        FilterExpression: 'entityType = :entityType',
        ExpressionAttributeValues: {
          ':receiverId': receiverId,
          ':entityType': 'FriendRequest'
        }
      };

      const result = await docClient.send(new QueryCommand(params));
      return result.Items ? result.Items.map(item => new FriendRequest(item)) : [];
    } catch (error) {
      console.error('❌ Error obteniendo solicitudes recibidas:', error);
      throw error;
    }
  }

  /**
   * Verificar si ya existe una solicitud entre dos usuarios
   */
  static async findExistingRequest(senderId, receiverId) {
    try {
      // Usar GetCommand con la clave primaria compuesta
      const params = {
        TableName: TABLE_NAME,
        Key: {
          PK: `FRIEND_REQUEST#${senderId}`,
          SK: `TO#${receiverId}`
        }
      };

      const result = await docClient.send(new GetCommand(params));
      return result.Item ? new FriendRequest(result.Item) : null;
    } catch (error) {
      console.error('❌ Error verificando solicitud existente:', error);
      throw error;
    }
  }

  /**
   * Actualizar el estado de una solicitud de amistad
   */
  async updateStatus(newStatus) {
    try {
      const params = {
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK 
        },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': newStatus,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      const result = await docClient.send(new UpdateCommand(params));
      this.status = newStatus;
      this.updatedAt = result.Attributes.updatedAt;
      
      console.log('✅ Estado de solicitud actualizado:', this.id, '->', newStatus);
      return this;
    } catch (error) {
      console.error('❌ Error actualizando estado de solicitud:', error);
      throw error;
    }
  }

  /**
   * Eliminar una solicitud de amistad
   */
  async delete() {
    try {
      const params = {
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK 
        }
      };

      await docClient.send(new DeleteCommand(params));
      console.log('✅ Solicitud de amistad eliminada:', this.id);
      return true;
    } catch (error) {
      console.error('❌ Error eliminando solicitud de amistad:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las solicitudes de amistad (para administración)
   */
  static async findAll() {
    try {
      // Usar Query para obtener solo FriendRequests usando el patrón de PK
      const params = {
        TableName: TABLE_NAME,
        IndexName: 'entityType-index', // Asumiendo que tienes este índice
        KeyConditionExpression: 'entityType = :entityType',
        ExpressionAttributeValues: {
          ':entityType': 'FriendRequest'
        }
      };

      const result = await docClient.send(new QueryCommand(params));
      return result.Items ? result.Items.map(item => new FriendRequest(item)) : [];
    } catch (error) {
      console.error('❌ Error obteniendo todas las solicitudes:', error);
      throw error;
    }
  }

  /**
   * Obtener solicitudes recibidas usando un enfoque alternativo (sin GSI)
   */
  static async findByReceiverIdAlternative(receiverId) {
    try {
      // Usar scan con filtro si no tienes GSI en receiverId
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: 'receiverId = :receiverId AND entityType = :entityType',
        ExpressionAttributeValues: {
          ':receiverId': receiverId,
          ':entityType': 'FriendRequest'
        }
      };

      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'entityType-index',
        KeyConditionExpression: 'entityType = :entityType',
        FilterExpression: 'receiverId = :receiverId',
        ExpressionAttributeValues: {
          ':entityType': 'FriendRequest',
          ':receiverId': receiverId
        }
      }));
      
      return result.Items ? result.Items.map(item => new FriendRequest(item)) : [];
    } catch (error) {
      console.error('❌ Error obteniendo solicitudes recibidas (alternativo):', error);
      throw error;
    }
  }

  /**
   * Verificar si ya existe una solicitud en cualquier dirección
   */
  static async findExistingRequestBidirectional(senderId, receiverId) {
    try {
      // Verificar en ambas direcciones
      const [request1, request2] = await Promise.all([
        this.findExistingRequest(senderId, receiverId),
        this.findExistingRequest(receiverId, senderId)
      ]);

      return request1 || request2;
    } catch (error) {
      console.error('❌ Error verificando solicitud bidireccional:', error);
      throw error;
    }
  }

  /**
   * Convertir a formato JSON para respuesta API
   */
  toJSON() {
    return {
      id: this.id,
      senderId: this.senderId,
      receiverId: this.receiverId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

