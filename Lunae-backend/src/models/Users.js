import { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { docClient } from '../config/db.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const TABLE_NAME = 'Lunea-chat'; // Usar la tabla existente

// Cliente DynamoDB solo para operaciones de tabla (CreateTable, DescribeTable)
const tableClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export class User {
  constructor(data = {}) {
    try {
      // Si se proporciona un amplifySub, usarlo como ID
      if (data.amplifySub && !data.id) {
        this.id = data.amplifySub;
      } else {
        this.id = data.id || this.generateId(data.amplifySub);
      }
      this.username = data.username;
      this.email = data.email;
      this.password = data.password;
      this.displayName = data.displayName;
      this.birthDate = data.birthDate;
      this.gender = data.gender;
      this.location = data.location;
      this.profileImage = data.profileImage;
      this.profileImageKey = data.profileImageKey;
      this.profileCompleted = data.profileCompleted || false;
      this.description = data.description;
      this.passwordChangedAt = data.passwordChangedAt;
      this.active = data.active !== undefined ? data.active : true;
      this.lastLogin = data.lastLogin;
      this.loginAttempts = data.loginAttempts || 0;
      this.lockUntil = data.lockUntil;
      this.amplifySub = data.amplifySub; // ID único de Amplify
      this.createdAt = data.createdAt || new Date().toISOString();
      this.updatedAt = data.updatedAt || new Date().toISOString();
      
      // Campos de conexión
      this.isOnline = data.isOnline || false;
      this.lastConnection = data.lastConnection;
      this.connectionPriority = data.connectionPriority;
      
      // Estructura para tabla Lunea-chat (PK/SK)
      this.PK = `USER#${this.id}`;
      this.SK = `PROFILE#${this.id}`;
    } catch (error) {
      console.error('❌ Error en constructor de Usuario:', error);
      throw error;
    }
  }

  generateId(amplifySub = null) {
    try {
      // Si se proporciona un amplifySub, usarlo como ID
      if (amplifySub) {
        return amplifySub;
      }
      // Si no, generar un ID tradicional
      return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      console.error('❌ Error generando ID:', error);
      throw error;
    }
  }

  // Convertir a formato DynamoDB
  toDynamoDB() {
    try {
      const item = { ...this };
      
      // Convertir fechas a strings ISO
      if (item.birthDate) {
        item.birthDate = new Date(item.birthDate).toISOString();
      }
      if (item.passwordChangedAt) {
        item.passwordChangedAt = new Date(item.passwordChangedAt).toISOString();
      }
      if (item.lastLogin) {
        item.lastLogin = new Date(item.lastLogin).toISOString();
      }
      if (item.lockUntil) {
        item.lockUntil = new Date(item.lockUntil).toISOString();
      }

      // Asegurar que PK y SK estén presentes
      if (!item.PK) {
        item.PK = `USER#${item.id}`;
      }
      if (!item.SK) {
        item.SK = `PROFILE#${item.id}`;
      }

      return item;
    } catch (error) {
      console.error('❌ Error convirtiendo usuario a formato DynamoDB:', error);
      throw error;
    }
  }

  // Convertir desde formato DynamoDB
  static fromDynamoDB(item) {
    try {
      if (!item) return null;
      
      // Convertir strings ISO a fechas
      if (item.birthDate) {
        item.birthDate = new Date(item.birthDate);
      }
      if (item.passwordChangedAt) {
        item.passwordChangedAt = new Date(item.passwordChangedAt);
      }
      if (item.lastLogin) {
        item.lastLogin = new Date(item.lastLogin);
      }
      if (item.lockUntil) {
        item.lockUntil = new Date(item.lockUntil);
      }

      // Extraer ID del PK si está disponible
      if (item.PK && item.PK.startsWith('USER#')) {
        item.id = item.PK.replace('USER#', '');
      }

      return new User(item);
    } catch (error) {
      console.error('❌ Error convirtiendo desde formato DynamoDB:', error);
      throw error;
    }
  }

  // Método estático para crear la tabla si no existe
  static async ensureTableExists() {
    try {
      // Verificar si la tabla existe
      const describeCommand = new DescribeTableCommand({
        TableName: TABLE_NAME
      });
      
      await tableClient.send(describeCommand);
      console.log(`✅ Tabla '${TABLE_NAME}' ya existe`);
      return true;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`📋 Creando tabla '${TABLE_NAME}'...`);
        
        try {
          const createTableCommand = new CreateTableCommand({
            TableName: TABLE_NAME,
            KeySchema: [
              { AttributeName: 'PK', KeyType: 'HASH' }, // Partition key
              { AttributeName: 'SK', KeyType: 'RANGE' }  // Sort key
            ],
            AttributeDefinitions: [
              { AttributeName: 'PK', AttributeType: 'S' },
              { AttributeName: 'SK', AttributeType: 'S' },
              { AttributeName: 'email', AttributeType: 'S' },
              { AttributeName: 'username', AttributeType: 'S' },
              { AttributeName: 'amplifySub', AttributeType: 'S' }
            ],
            BillingMode: 'PAY_PER_REQUEST', // On-demand billing
            GlobalSecondaryIndexes: [
              {
                IndexName: 'email-index',
                KeySchema: [
                  { AttributeName: 'email', KeyType: 'HASH' }
                ],
                Projection: {
                  ProjectionType: 'ALL'
                }
              },
              {
                IndexName: 'username-index',
                KeySchema: [
                  { AttributeName: 'username', KeyType: 'HASH' }
                ],
                Projection: {
                  ProjectionType: 'ALL'
                }
              },
              {
                IndexName: 'amplifySub-index',
                KeySchema: [
                  { AttributeName: 'amplifySub', KeyType: 'HASH' }
                ],
                Projection: {
                  ProjectionType: 'ALL'
                }
              }
            ]
          });

          await tableClient.send(createTableCommand);
          console.log(`✅ Tabla '${TABLE_NAME}' creada exitosamente`);
          
          // Esperar a que la tabla esté activa
          await this.waitForTableActive();
          return true;
        } catch (createError) {
          console.error('❌ Error creando tabla:', createError);
          throw createError;
        }
      } else {
        console.error('❌ Error verificando tabla:', error);
        throw error;
      }
    }
  }

  // Esperar a que la tabla esté activa
  static async waitForTableActive() {
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const describeCommand = new DescribeTableCommand({
          TableName: TABLE_NAME
        });
        
        const { Table } = await tableClient.send(describeCommand);
        
        if (Table.TableStatus === 'ACTIVE') {
          console.log('✅ Tabla está activa y lista para usar');
          return true;
        }
        
        console.log(`⏳ Estado de la tabla: ${Table.TableStatus}`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
        attempts++;
        
      } catch (error) {
        console.error('Error verificando estado de la tabla:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Timeout esperando que la tabla esté activa');
  }

  // Métodos estáticos para operaciones de base de datos
  static async create(userData) {
    try {
      // Asegurar que la tabla existe antes de crear el usuario
      await this.ensureTableExists();
      
      const user = new User(userData);
      
      // Hash password antes de guardar
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        user.passwordChangedAt = new Date(Date.now() - 1000);
      }

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: user.toDynamoDB()
      });

      await docClient.send(command);
      console.log('✅ Usuario creado exitosamente en DynamoDB:', user.id);
      console.log('📄 Datos del usuario:', JSON.stringify(user.toDynamoDB(), null, 2));
      return user;
    } catch (error) {
      console.error('❌ Error creando usuario en DynamoDB:', error);
      
      // Manejar errores específicos de DynamoDB
      if (error.name === 'ResourceNotFoundException') {
        console.error('💡 La tabla no existe. Intentando crearla...');
        try {
          await this.ensureTableExists();
          // Reintentar la creación del usuario
          return await this.create(userData);
        } catch (retryError) {
          console.error('❌ Error en reintento:', retryError);
          throw retryError;
        }
      } else if (error.name === 'AccessDeniedException') {
        console.error('💡 Error de permisos. Verifica las credenciales de AWS.');
        throw new Error('Error de permisos en DynamoDB. Verifica las credenciales de AWS.');
      } else if (error.name === 'UnrecognizedClientException') {
        console.error('💡 Error de configuración del cliente. Verifica la región y credenciales.');
        throw new Error('Error de configuración del cliente DynamoDB.');
      }
      
      throw error;
    }
  }

  static async findById(id) {
    try {
      // Asegurar que la tabla existe
      await this.ensureTableExists();
      
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: `USER#${id}`,
          SK: `PROFILE#${id}`
        }
      });

      const result = await docClient.send(command);
      if (result.Item) {
        console.log(`✅ Usuario encontrado por ID: ${id}`);
      } else {
        console.log(`⚠️ Usuario no encontrado por ID: ${id}`);
      }
      return User.fromDynamoDB(result.Item);
    } catch (error) {
      console.error('❌ Error buscando usuario por ID:', error);
      throw error;
    }
  }

  static async findOne(query) {
    try {
      // Asegurar que la tabla existe
      await this.ensureTableExists();
      
      // Para DynamoDB, necesitamos usar índices o scan
      // Por ahora, implementamos búsqueda básica
      if (query.email) {
        return await User.findByEmail(query.email);
      }
      if (query.username) {
        return await User.findByUsername(query.username);
      }
      if (query.$or) {
        // Buscar por username o email
        for (const condition of query.$or) {
          if (condition.username) {
            const user = await User.findByUsername(condition.username);
            if (user) return user;
          }
          if (condition.email) {
            const user = await User.findByEmail(condition.email);
            if (user) return user;
          }
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error en findOne:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      // Asegurar que la tabla existe
      await this.ensureTableExists();
      
      // Usar Query con el índice de email
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      });

      const result = await docClient.send(command);
      if (result.Items.length > 0) {
        console.log(`✅ Usuario encontrado por email: ${email}`);
        return User.fromDynamoDB(result.Items[0]);
      } else {
        console.log(`⚠️ Usuario no encontrado por email: ${email}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error buscando usuario por email:', error);
      throw error;
    }
  }

  static async findByUsername(username) {
    try {
      // Asegurar que la tabla existe
      await this.ensureTableExists();
      
      // Usar Query con el índice de username
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'username-index',
        KeyConditionExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':username': username
        }
      });

      const result = await docClient.send(command);
      if (result.Items.length > 0) {
        console.log(`✅ Usuario encontrado por username: ${username}`);
        return User.fromDynamoDB(result.Items[0]);
      } else {
        console.log(`⚠️ Usuario no encontrado por username: ${username}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error buscando usuario por username:', error);
      throw error;
    }
  }

  static async findByAmplifySub(amplifySub) {
    try {
      // Asegurar que la tabla existe
      await this.ensureTableExists();
      
      // Usar Query con el índice de amplifySub
      const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'amplifySub-index',
        KeyConditionExpression: 'amplifySub = :amplifySub',
        ExpressionAttributeValues: {
          ':amplifySub': amplifySub
        }
      });

      const result = await docClient.send(command);
      if (result.Items.length > 0) {
        console.log(`✅ Usuario encontrado por amplifySub: ${amplifySub}`);
        return User.fromDynamoDB(result.Items[0]);
      } else {
        console.log(`⚠️ Usuario no encontrado por amplifySub: ${amplifySub}`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error buscando usuario por amplifySub:', error);
      throw error;
    }
  }

  static async find(query = {}) {
    try {
      // Asegurar que la tabla existe
      await this.ensureTableExists();
      
      // Implementar scan con filtros básicos
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'active = :active',
        ExpressionAttributeValues: {
          ':active': true
        }
      });

      const result = await docClient.send(command);
      console.log(`🔍 Encontrados ${result.Items.length} usuarios en DynamoDB`);
      return result.Items.map(item => User.fromDynamoDB(item));
    } catch (error) {
      console.error('❌ Error buscando usuarios:', error);
      throw error;
    }
  }

  // Obtener usuarios ordenados por estado de conexión
  static async findUsersOrderedByConnection() {
    try {
      const users = await this.find();
      
      // Ordenar por estado de conexión: online primero, luego por última conexión
      return users.sort((a, b) => {
        // Primero, usuarios online
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        
        // Si ambos están en el mismo estado, ordenar por connectionPriority o lastConnection
        const aTime = a.connectionPriority || (a.lastConnection ? new Date(a.lastConnection).getTime() : 0);
        const bTime = b.connectionPriority || (b.lastConnection ? new Date(b.lastConnection).getTime() : 0);
        return bTime - aTime; // Más reciente primero
      });
    } catch (error) {
      console.error('❌ Error obteniendo usuarios ordenados por conexión:', error);
      throw error;
    }
  }

  // Actualizar estado de conexión de un usuario
  async updateConnectionStatus(isOnline, lastConnection = null) {
    try {
      const updates = {
        isOnline,
        connectionPriority: Date.now(),
        updatedAt: new Date().toISOString()
      };
      
      if (lastConnection) {
        updates.lastConnection = lastConnection;
      } else if (!isOnline) {
        updates.lastConnection = new Date().toISOString();
      }
      
      await this.update(updates);
      console.log(`✅ Estado de conexión actualizado para usuario ${this.id}: ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
      console.error('❌ Error actualizando estado de conexión:', error);
      throw error;
    }
  }

  // Métodos de instancia
  async save() {
    try {
      // Asegurar que la tabla existe
      await User.ensureTableExists();
      
      this.updatedAt = new Date().toISOString();
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: this.toDynamoDB()
      });

      await docClient.send(command);
      console.log(`✅ Usuario guardado exitosamente: ${this.id}`);
      return this;
    } catch (error) {
      console.error('❌ Error guardando usuario:', error);
      throw error;
    }
  }

  async update(updateData) {
    try {
      // Asegurar que la tabla existe
      await User.ensureTableExists();
      
      // Construir expresión de actualización dinámica
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updateData).forEach((key, index) => {
        if (key !== 'id') { // No permitir actualizar el ID
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          
          updateExpressions.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          
          // Convertir fechas a strings ISO si es necesario
          let value = updateData[key];
          if (value instanceof Date) {
            value = value.toISOString();
          } else if (key === 'birthDate' && value) {
            // Si birthDate es un string de fecha, convertirlo a ISO
            try {
              value = new Date(value).toISOString();
            } catch (dateError) {
              console.warn(`⚠️ Error convirtiendo birthDate: ${value}`, dateError);
              // Mantener el valor original si no se puede convertir
            }
          }
          
          expressionAttributeValues[attrValue] = value;
        }
      });

      if (updateExpressions.length === 0) return this;

      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
      });

      const result = await docClient.send(command);
      Object.assign(this, User.fromDynamoDB(result.Attributes));
      console.log(`✅ Usuario actualizado exitosamente: ${this.id}`);
      return this;
    } catch (error) {
      console.error('❌ Error actualizando usuario:', error);
      throw error;
    }
  }

  async delete() {
    try {
      // Asegurar que la tabla existe
      await User.ensureTableExists();
      
      const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { 
          PK: this.PK,
          SK: this.SK
        }
      });

      await docClient.send(command);
      console.log(`✅ Usuario eliminado exitosamente: ${this.id}`);
      return true;
    } catch (error) {
      console.error('❌ Error eliminando usuario:', error);
      throw error;
    }
  }

  // Métodos de autenticación
  async comparePassword(candidatePassword) {
    try {
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      console.error('❌ Error comparando contraseña:', error);
      throw error;
    }
  }

  async incrementLoginAttempts() {
    try {
      if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = undefined;
      } else {
        this.loginAttempts += 1;
        
        if (this.loginAttempts >= 5) {
          this.lockUntil = Date.now() + 3600000; // 1 hora
        }
      }
      
      await this.save();
    } catch (error) {
      console.error('❌ Error incrementando intentos de login:', error);
      throw error;
    }
  }

  isLocked() {
    try {
      return this.lockUntil && this.lockUntil > Date.now();
    } catch (error) {
      console.error('❌ Error verificando si el usuario está bloqueado:', error);
      return false;
    }
  }

  async resetLoginAttempts() {
    try {
      this.loginAttempts = 0;
      this.lockUntil = undefined;
      this.lastLogin = Date.now();
      await this.save();
    } catch (error) {
      console.error('❌ Error reseteando intentos de login:', error);
      throw error;
    }
  }

  async deactivate() {
    try {
      this.active = false;
      await this.save();
    } catch (error) {
      console.error('❌ Error desactivando usuario:', error);
      throw error;
    }
  }

  async reactivate() {
    try {
      this.active = true;
      this.loginAttempts = 0;
      this.lockUntil = undefined;
      await this.save();
    } catch (error) {
      console.error('❌ Error reactivando usuario:', error);
      throw error;
    }
  }

  // Método para seleccionar campos específicos (simular select de Mongoose)
  select(fields) {
    try {
      const selectedUser = {};
      const excludeFields = fields.startsWith('-') ? fields.substring(1).split(' ') : [];
      
      if (excludeFields.length > 0) {
        Object.keys(this).forEach(key => {
          if (!excludeFields.includes(key)) {
            selectedUser[key] = this[key];
          }
        });
      } else {
        const includeFields = fields.split(' ');
        includeFields.forEach(field => {
          if (this[field] !== undefined) {
            selectedUser[field] = this[field];
          }
        });
      }
      
      return selectedUser;
    } catch (error) {
      console.error('❌ Error seleccionando campos del usuario:', error);
      throw error;
    }
  }
}

// Exportar la clase y una función helper para compatibilidad
export const createUser = (data) => new User(data);
export const findUserById = (id) => User.findById(id);
export const findUserByEmail = (email) => User.findByEmail(email);
export const findUserByUsername = (username) => User.findByUsername(username);
export const findUsers = (query) => User.find(query);
