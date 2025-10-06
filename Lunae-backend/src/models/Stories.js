import { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { docClient } from '../config/db.js';

const TABLE_NAME = 'Lunea-chat'; // Usar la tabla existente

// Cliente DynamoDB solo para operaciones de tabla (CreateTable, DescribeTable)
const tableClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export class Story {
  constructor(data = {}) {
    try {
      this.id = data.id || this.generateId();
      this.userId = data.userId;
      this.userName = data.userName;
      this.userProfileImage = data.userProfileImage;
      this.content = data.content || {}; // { type: 'image'|'text', data: string, description?: string }
      this.location = data.location;
      this.createdAt = data.createdAt || new Date().toISOString();
      this.expiresAt = data.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 horas
      this.isViewed = data.isViewed || false;
      this.viewedBy = data.viewedBy || []; // Array de userIds que han visto el story
      this.likes = data.likes || []; // Array de userIds que han dado like
      this.reactions = data.reactions || []; // Array de { userId, type, timestamp }
      this.comments = data.comments || []; // Array de { id, userId, userName, userProfileImage, content, timestamp }
      
      // Estructura para tabla Lunea-chat (PK/SK)
      this.PK = `STORY#${this.id}`;
      this.SK = `USER#${this.userId}`;
    } catch (error) {
      console.error('❌ Error en constructor de Story:', error);
      throw error;
    }
  }

  generateId() {
    try {
      return `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      console.error('❌ Error generando ID de story:', error);
      throw error;
    }
  }

  // Convertir a formato DynamoDB
  toDynamoDB() {
    try {
      const item = { ...this };
      
      // Convertir fechas a strings ISO para almacenamiento
      if (item.createdAt instanceof Date) {
        item.createdAt = item.createdAt.toISOString();
      } else if (typeof item.createdAt === 'string') {
        // Asegurar formato ISO válido
        item.createdAt = new Date(item.createdAt).toISOString();
      }
      
      if (item.expiresAt instanceof Date) {
        item.expiresAt = item.expiresAt.toISOString();
      } else if (typeof item.expiresAt === 'string') {
        // Asegurar formato ISO válido
        item.expiresAt = new Date(item.expiresAt).toISOString();
      }

      // Asegurar que PK y SK estén presentes
      if (!item.PK) {
        item.PK = `STORY#${item.id}`;
      }
      if (!item.SK) {
        item.SK = `USER#${item.userId}`;
      }

      return item;
    } catch (error) {
      console.error('❌ Error convirtiendo story a formato DynamoDB:', error);
      throw error;
    }
  }

  // Convertir desde formato DynamoDB
  static fromDynamoDB(item) {
    try {
      if (!item) return null;
      
      // Convertir strings ISO a objetos Date
      if (item.createdAt) {
        const originalCreatedAt = item.createdAt;
        item.createdAt = new Date(item.createdAt);
        
        // Validar que la conversión fue exitosa
        if (isNaN(item.createdAt.getTime())) {
          console.error(`⚠️ Fecha createdAt inválida: ${originalCreatedAt}`);
          item.createdAt = new Date(); // Fallback a fecha actual
        }
      }
      
      if (item.expiresAt) {
        const originalExpiresAt = item.expiresAt;
        item.expiresAt = new Date(item.expiresAt);
        
        // Validar que la conversión fue exitosa
        if (isNaN(item.expiresAt.getTime())) {
          console.error(`⚠️ Fecha expiresAt inválida: ${originalExpiresAt}`);
          item.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Fallback a 24h
        }
      }

      // Extraer ID del PK si está disponible
      if (item.PK && item.PK.startsWith('STORY#')) {
        item.id = item.PK.replace('STORY#', '');
      }

      return new Story(item);
    } catch (error) {
      console.error('❌ Error convirtiendo desde formato DynamoDB:', error);
      throw error;
    }
  }

  // Métodos estáticos para operaciones de base de datos
  static async create(storyData) {
    try {
      const story = new Story(storyData);
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: story.toDynamoDB()
      });

      await docClient.send(command);
      console.log('✅ Story creado exitosamente en DynamoDB:', story.id);
      return story;
    } catch (error) {
      console.error('❌ Error creando story en DynamoDB:', error);
      throw error;
    }
  }

  static async findById(id, userId = null) {
    try {
      if (!userId) {
        // Si no se proporciona userId, buscar en todos los stories activos
        const allStories = await this.findActiveStories();
        const story = allStories.find(s => s.id === id);
        
        if (story) {
          console.log(`✅ Story encontrado por ID: ${id}`);
        } else {
          console.log(`⚠️ Story no encontrado por ID: ${id}`);
        }
        return story;
      }

      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: `STORY#${id}`,
          SK: `USER#${userId}`
        }
      });

      const result = await docClient.send(command);
      if (result.Item) {
        console.log(`✅ Story encontrado por ID: ${id}`);
      } else {
        console.log(`⚠️ Story no encontrado por ID: ${id}`);
      }
      return Story.fromDynamoDB(result.Item);
    } catch (error) {
      console.error('❌ Error buscando story por ID:', error);
      throw error;
    }
  }

  static async findByUserId(userId) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'SK = :sk',
        FilterExpression: 'begins_with(PK, :pk)',
        ExpressionAttributeValues: {
          ':sk': `USER#${userId}`,
          ':pk': 'STORY#'
        },
        ScanIndexForward: false // Ordenar por fecha descendente
      });

      const result = await docClient.send(command);
      console.log(`🔍 Encontrados ${result.Items.length} stories para usuario ${userId}`);
      return result.Items.map(item => Story.fromDynamoDB(item));
    } catch (error) {
      console.error('❌ Error buscando stories por userId:', error);
      throw error;
    }
  }

  static async findActiveStories(userIds = []) {
    try {
      const now = new Date().toISOString();
      const stories = [];

      // Si se proporcionan userIds específicos, buscar solo esos
      if (userIds.length > 0) {
        for (const userId of userIds) {
          const userStories = await this.findByUserId(userId);
          stories.push(...userStories);
        }
      } else {
        // Buscar todos los stories activos
        const command = new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: 'begins_with(PK, :pk) AND expiresAt > :now',
          ExpressionAttributeValues: {
            ':pk': 'STORY#',
            ':now': now
          }
        });

        const result = await docClient.send(command);
        console.log(`📊 DynamoDB Scan encontró ${result.Items.length} items`);
        stories.push(...result.Items.map(item => Story.fromDynamoDB(item)));
      }

      // Filtrar solo stories activos (no expirados)
      const activeStories = stories.filter(story => {
        const isActive = new Date(story.expiresAt) > new Date();
        if (!isActive) {
          console.log(`⏰ Story ${story.id} expirado: ${story.expiresAt}`);
        }
        return isActive;
      });

      // Ordenar por fecha de creación (más recientes primero)
      activeStories.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`🔍 Encontrados ${activeStories.length} stories activos (de ${stories.length} totales)`);
      if (activeStories.length > 0) {
        console.log(`📅 Story más reciente: ${activeStories[0].userName} - ${activeStories[0].createdAt}`);
        console.log(`📅 Story más antiguo: ${activeStories[activeStories.length - 1].userName} - ${activeStories[activeStories.length - 1].createdAt}`);
      }
      
      return activeStories;
    } catch (error) {
      console.error('❌ Error buscando stories activos:', error);
      throw error;
    }
  }

  static async findStoriesByFriends(userId, friendIds) {
    try {
      const stories = [];
      
      for (const friendId of friendIds) {
        const friendStories = await this.findByUserId(friendId);
        stories.push(...friendStories);
      }

      // Filtrar solo stories activos
      const activeStories = stories.filter(story => 
        new Date(story.expiresAt) > new Date()
      );

      // Ordenar por fecha de creación (más recientes primero)
      activeStories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      console.log(`🔍 Encontrados ${activeStories.length} stories de amigos para usuario ${userId}`);
      return activeStories;
    } catch (error) {
      console.error('❌ Error buscando stories de amigos:', error);
      throw error;
    }
  }

  // Métodos de instancia
  async save() {
    try {
      this.updatedAt = new Date().toISOString();
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: this.toDynamoDB()
      });

      await docClient.send(command);
      console.log(`✅ Story guardado exitosamente: ${this.id}`);
      return this;
    } catch (error) {
      console.error('❌ Error guardando story:', error);
      throw error;
    }
  }

  async markAsViewed(viewerId) {
    try {
      if (!this.viewedBy.includes(viewerId)) {
        this.viewedBy.push(viewerId);
        this.isViewed = true;
        
        const command = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { 
            PK: this.PK,
            SK: this.SK
          },
          UpdateExpression: 'SET viewedBy = :viewedBy, isViewed = :isViewed',
          ExpressionAttributeValues: {
            ':viewedBy': this.viewedBy,
            ':isViewed': this.isViewed
          },
          ReturnValues: 'ALL_NEW'
        });

        const result = await docClient.send(command);
        Object.assign(this, Story.fromDynamoDB(result.Attributes));
        console.log(`✅ Story ${this.id} marcado como visto por usuario ${viewerId}`);
      }
      return this;
    } catch (error) {
      console.error('❌ Error marcando story como visto:', error);
      throw error;
    }
  }

  async addLike(userId) {
    try {
      if (!this.likes.includes(userId)) {
        this.likes.push(userId);
        
        const command = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { 
            PK: this.PK,
            SK: this.SK
          },
          UpdateExpression: 'SET likes = :likes',
          ExpressionAttributeValues: {
            ':likes': this.likes
          },
          ReturnValues: 'ALL_NEW'
        });

        const result = await docClient.send(command);
        Object.assign(this, Story.fromDynamoDB(result.Attributes));
        console.log(`✅ Like agregado al story ${this.id} por usuario ${userId}`);
      }
      return this;
    } catch (error) {
      console.error('❌ Error agregando like al story:', error);
      throw error;
    }
  }

  async removeLike(userId) {
    try {
      this.likes = this.likes.filter(id => id !== userId);
      
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK
        },
        UpdateExpression: 'SET likes = :likes',
        ExpressionAttributeValues: {
          ':likes': this.likes
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await docClient.send(command);
      Object.assign(this, Story.fromDynamoDB(result.Attributes));
      console.log(`✅ Like removido del story ${this.id} por usuario ${userId}`);
      return this;
    } catch (error) {
      console.error('❌ Error removiendo like del story:', error);
      throw error;
    }
  }

  async addReaction(userId, reactionType) {
    try {
      const reaction = {
        userId,
        type: reactionType,
        timestamp: new Date().toISOString()
      };

      // Remover reacción anterior del mismo usuario si existe
      this.reactions = this.reactions.filter(r => r.userId !== userId);
      this.reactions.push(reaction);
      
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK
        },
        UpdateExpression: 'SET reactions = :reactions',
        ExpressionAttributeValues: {
          ':reactions': this.reactions
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await docClient.send(command);
      Object.assign(this, Story.fromDynamoDB(result.Attributes));
      console.log(`✅ Reacción ${reactionType} agregada al story ${this.id} por usuario ${userId}`);
      return this;
    } catch (error) {
      console.error('❌ Error agregando reacción al story:', error);
      throw error;
    }
  }

  async delete() {
    try {
      const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK
        }
      });

      await docClient.send(command);
      console.log(`✅ Story eliminado exitosamente: ${this.id}`);
      return true;
    } catch (error) {
      console.error('❌ Error eliminando story:', error);
      throw error;
    }
  }

  // Método estático para limpiar stories expirados
  static async cleanupExpiredStories() {
    try {
      const now = new Date().toISOString();
      
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND expiresAt <= :now',
        ExpressionAttributeValues: {
          ':pk': 'STORY#',
          ':now': now
        }
      });

      const result = await docClient.send(command);
      const expiredStories = result.Items;

      console.log(`🧹 Encontrados ${expiredStories.length} stories expirados para limpiar`);

      // Eliminar stories expirados en lotes
      const deletePromises = expiredStories.map(story => {
        const deleteCommand = new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { 
            PK: story.PK,
            SK: story.SK
          }
        });
        return docClient.send(deleteCommand);
      });

      await Promise.all(deletePromises);
      console.log(`✅ ${expiredStories.length} stories expirados eliminados`);
      return expiredStories.length;
    } catch (error) {
      console.error('❌ Error limpiando stories expirados:', error);
      throw error;
    }
  }

  // Método para verificar si un story ha sido visto por un usuario
  hasBeenViewedBy(userId) {
    return this.viewedBy.includes(userId);
  }

  // Método para verificar si un usuario ha dado like
  hasBeenLikedBy(userId) {
    return this.likes.includes(userId);
  }

  // Método para obtener reacción de un usuario
  getReactionBy(userId) {
    return this.reactions.find(r => r.userId === userId);
  }

  // Métodos para manejar comentarios
  async addComment(userId, userName, userProfileImage, content) {
    try {
      const comment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        userName,
        userProfileImage,
        content: content.trim(),
        timestamp: new Date().toISOString()
      };

      this.comments.push(comment);
      
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK
        },
        UpdateExpression: 'SET comments = :comments',
        ExpressionAttributeValues: {
          ':comments': this.comments
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await docClient.send(command);
      Object.assign(this, Story.fromDynamoDB(result.Attributes));
      console.log(`✅ Comentario agregado al story ${this.id} por usuario ${userId}`);
      return comment;
    } catch (error) {
      console.error('❌ Error agregando comentario al story:', error);
      throw error;
    }
  }

  async removeComment(commentId, userId) {
    try {
      const comment = this.comments.find(c => c.id === commentId);
      if (!comment) {
        throw new Error('Comentario no encontrado');
      }

      // Solo el autor del comentario o el autor del story puede eliminarlo
      if (comment.userId !== userId && this.userId !== userId) {
        throw new Error('No tienes permisos para eliminar este comentario');
      }

      this.comments = this.comments.filter(c => c.id !== commentId);
      
      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK
        },
        UpdateExpression: 'SET comments = :comments',
        ExpressionAttributeValues: {
          ':comments': this.comments
        },
        ReturnValues: 'ALL_NEW'
      });

      const result = await docClient.send(command);
      Object.assign(this, Story.fromDynamoDB(result.Attributes));
      console.log(`✅ Comentario ${commentId} eliminado del story ${this.id}`);
      return true;
    } catch (error) {
      console.error('❌ Error eliminando comentario del story:', error);
      throw error;
    }
  }

  // Método para obtener comentarios ordenados por fecha
  getComments() {
    return this.comments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // Método para obtener estadísticas del story
  getStats() {
    return {
      views: this.viewedBy.length,
      likes: this.likes.length,
      reactions: this.reactions.length,
      comments: this.comments.length,
      isExpired: new Date(this.expiresAt) <= new Date()
    };
  }
}

// Exportar la clase y funciones helper para compatibilidad
export const createStory = (data) => new Story(data);
export const findStoryById = (id) => Story.findById(id);
export const findStoriesByUserId = (userId) => Story.findByUserId(userId);
export const findActiveStories = (userIds) => Story.findActiveStories(userIds);
export const findStoriesByFriends = (userId, friendIds) => Story.findStoriesByFriends(userId, friendIds);
export const cleanupExpiredStories = () => Story.cleanupExpiredStories();
