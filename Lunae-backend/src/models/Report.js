import { PutCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../config/db.js';

const TABLE_NAME = 'Lunea-chat'; // Usar la misma tabla

export class Report {
  constructor(data = {}) {
    try {
      this.id = data.id || this.generateId();
      this.reporterId = data.reporterId; // Usuario que reporta
      this.reportedUserId = data.reportedUserId; // Usuario reportado
      this.category = data.category; // Categoría del reporte
      this.reason = data.reason || ''; // Razón del reporte
      this.status = data.status || 'pending'; // pending, reviewed, resolved
      this.createdAt = data.createdAt || new Date().toISOString();
      this.updatedAt = data.updatedAt || new Date().toISOString();
      this.reviewedBy = data.reviewedBy || null;
      this.reviewedAt = data.reviewedAt || null;
      this.notes = data.notes || '';
      
      // Estructura para tabla Lunea-chat (PK/SK)
      this.PK = `REPORT#${this.reportedUserId}`;
      this.SK = `REPORT#${this.id}`;
    } catch (error) {
      console.error('❌ Error en constructor de Report:', error);
      throw error;
    }
  }

  generateId() {
    try {
      return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      console.error('❌ Error generando ID de reporte:', error);
      throw error;
    }
  }

  // Convertir a formato DynamoDB
  toDynamoDB() {
    try {
      const item = { ...this };
      
      // Asegurar que PK y SK estén presentes
      if (!item.PK) {
        item.PK = `REPORT#${item.reportedUserId}`;
      }
      if (!item.SK) {
        item.SK = `REPORT#${item.id}`;
      }

      return item;
    } catch (error) {
      console.error('❌ Error convirtiendo reporte a formato DynamoDB:', error);
      throw error;
    }
  }

  // Convertir desde formato DynamoDB
  static fromDynamoDB(item) {
    try {
      if (!item) return null;
      
      // Extraer IDs del PK/SK si están disponibles
      if (item.SK && item.SK.startsWith('REPORT#')) {
        item.id = item.SK.replace('REPORT#', '');
      }
      if (item.PK && item.PK.startsWith('REPORT#')) {
        item.reportedUserId = item.PK.replace('REPORT#', '');
      }

      return new Report(item);
    } catch (error) {
      console.error('❌ Error convirtiendo desde formato DynamoDB:', error);
      throw error;
    }
  }

  // Métodos estáticos para operaciones de base de datos
  static async create(reportData) {
    try {
      const report = new Report(reportData);
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: report.toDynamoDB()
      });

      await docClient.send(command);
      console.log('✅ Reporte creado exitosamente:', report.id);
      console.log('📄 Datos del reporte:', JSON.stringify(report.toDynamoDB(), null, 2));
      return report;
    } catch (error) {
      console.error('❌ Error creando reporte en DynamoDB:', error);
      throw error;
    }
  }

  static async findById(reportedUserId, reportId) {
    try {
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: `REPORT#${reportedUserId}`,
          SK: `REPORT#${reportId}`
        }
      });

      const result = await docClient.send(command);
      if (result.Item) {
        console.log(`✅ Reporte encontrado: ${reportId}`);
      } else {
        console.log(`⚠️ Reporte no encontrado: ${reportId}`);
      }
      return Report.fromDynamoDB(result.Item);
    } catch (error) {
      console.error('❌ Error buscando reporte por ID:', error);
      throw error;
    }
  }

  // Obtener todos los reportes de un usuario reportado
  static async findByReportedUser(reportedUserId) {
    try {
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `REPORT#${reportedUserId}`,
          ':sk': 'REPORT#'
        }
      });

      const result = await docClient.send(command);
      console.log(`✅ Encontrados ${result.Items.length} reportes para usuario ${reportedUserId}`);
      return result.Items.map(item => Report.fromDynamoDB(item));
    } catch (error) {
      console.error('❌ Error buscando reportes por usuario reportado:', error);
      throw error;
    }
  }

  // Obtener todos los reportes hechos por un usuario
  static async findByReporter(reporterId) {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk) AND reporterId = :reporterId',
        ExpressionAttributeValues: {
          ':pk': 'REPORT#',
          ':sk': 'REPORT#',
          ':reporterId': reporterId
        }
      });

      const result = await docClient.send(command);
      console.log(`✅ Encontrados ${result.Items.length} reportes hechos por usuario ${reporterId}`);
      return result.Items.map(item => Report.fromDynamoDB(item));
    } catch (error) {
      console.error('❌ Error buscando reportes por reportero:', error);
      throw error;
    }
  }

  // Obtener todos los reportes
  static async findAll() {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'REPORT#',
          ':sk': 'REPORT#'
        }
      });

      const result = await docClient.send(command);
      console.log(`✅ Encontrados ${result.Items.length} reportes en total`);
      return result.Items.map(item => Report.fromDynamoDB(item));
    } catch (error) {
      console.error('❌ Error buscando todos los reportes:', error);
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
      console.log(`✅ Reporte guardado exitosamente: ${this.id}`);
      return this;
    } catch (error) {
      console.error('❌ Error guardando reporte:', error);
      throw error;
    }
  }
}

// Exportar función helper para compatibilidad
export const createReport = (data) => Report.create(data);
export const findReportsByReportedUser = (userId) => Report.findByReportedUser(userId);
export const findReportsByReporter = (userId) => Report.findByReporter(userId);
export const findAllReports = () => Report.findAll();



