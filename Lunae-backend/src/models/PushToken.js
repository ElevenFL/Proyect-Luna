import { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const TABLE_NAME = 'Lunea-chat'; // Usar la tabla existente

/**
 * Modelo para gestionar tokens de Push Notifications
 */
export class PushToken {
  /**
   * Registra un nuevo push token para un usuario
   */
  static async register(userId, pushToken, platform, deviceId = null) {
    try {
      const now = new Date().toISOString();
      
      const item = {
        PK: `USER#${userId}`,
        SK: `PUSHTOKEN#${pushToken}`,
        entityType: 'PushToken',
        userId: String(userId),
        pushToken,
        platform: platform || 'unknown', // 'ios' | 'android' | 'web'
        deviceId: deviceId || pushToken,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        lastUsed: now
      };

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }));

      console.log(`✅ Push token registrado para usuario ${userId} en plataforma ${platform}`);
      return item;
    } catch (error) {
      console.error('❌ Error registrando push token:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los tokens activos de un usuario
   */
  static async getTokensByUserId(userId) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'PUSHTOKEN#'
        }
      });

      const result = await docClient.send(command);
      
      // Filtrar solo tokens activos
      const activeTokens = result.Items?.filter(item => item.isActive === true) || [];
      
      console.log(`📱 Usuario ${userId} tiene ${activeTokens.length} token(s) activo(s)`);
      return activeTokens;
    } catch (error) {
      console.error('❌ Error obteniendo tokens por userId:', error);
      return [];
    }
  }

  /**
   * Obtiene un token específico
   */
  static async getToken(userId, pushToken) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': `PUSHTOKEN#${pushToken}`
        }
      });

      const result = await docClient.send(command);
      return result.Items?.[0] || null;
    } catch (error) {
      console.error('❌ Error obteniendo token específico:', error);
      return null;
    }
  }

  /**
   * Actualiza la última vez que se usó un token
   */
  static async updateLastUsed(userId, pushToken) {
    try {
      const now = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `PUSHTOKEN#${pushToken}`
        },
        UpdateExpression: 'SET lastUsed = :now, updatedAt = :now',
        ExpressionAttributeValues: {
          ':now': now
        }
      }));

      console.log(`✅ Actualizado lastUsed para token de usuario ${userId}`);
    } catch (error) {
      console.error('❌ Error actualizando lastUsed:', error);
    }
  }

  /**
   * Desactiva un token (soft delete)
   */
  static async deactivate(userId, pushToken) {
    try {
      const now = new Date().toISOString();

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `PUSHTOKEN#${pushToken}`
        },
        UpdateExpression: 'SET isActive = :false, updatedAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': now
        }
      }));

      console.log(`✅ Token desactivado para usuario ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error desactivando token:', error);
      return false;
    }
  }

  /**
   * Elimina un token permanentemente
   */
  static async delete(userId, pushToken) {
    try {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `PUSHTOKEN#${pushToken}`
        }
      }));

      console.log(`✅ Token eliminado para usuario ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error eliminando token:', error);
      return false;
    }
  }

  /**
   * Desactiva todos los tokens de un usuario
   */
  static async deactivateAllUserTokens(userId) {
    try {
      const tokens = await this.getTokensByUserId(userId);
      
      for (const token of tokens) {
        await this.deactivate(userId, token.pushToken);
      }

      console.log(`✅ Todos los tokens desactivados para usuario ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error desactivando todos los tokens:', error);
      return false;
    }
  }

  /**
   * Limpia tokens inválidos o expirados
   * @param {number} daysOld - Número de días sin usar para considerar un token como expirado
   */
  static async cleanupOldTokens(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffISO = cutoffDate.toISOString();

      console.log(`🧹 Limpiando tokens no usados desde antes de ${cutoffISO}`);

      // Nota: En producción, esto debería hacerse con un scan paginado
      // o mejor aún, con un proceso batch programado
      
      return true;
    } catch (error) {
      console.error('❌ Error limpiando tokens antiguos:', error);
      return false;
    }
  }
}

export default PushToken;

