# Migración de MongoDB a DynamoDB

## Resumen de Cambios

Este proyecto ha sido migrado de MongoDB a DynamoDB para aprovechar la integración nativa con AWS y mejorar la escalabilidad.

## Cambios Principales

### 1. Dependencias
- **Eliminadas**: `mongoose` (ya no se usa)
- **Agregadas**: 
  - `@aws-sdk/client-dynamodb`
  - `@aws-sdk/lib-dynamodb`

### 2. Configuración de Base de Datos
- **Antes**: `src/config/db.js` usaba Mongoose para conectar a MongoDB
- **Ahora**: Usa el SDK de AWS para conectar a DynamoDB

### 3. Modelo de Usuario
- **Antes**: Schema de Mongoose con middleware y métodos
- **Ahora**: Clase ES6 con métodos estáticos para operaciones de DynamoDB

### 4. Operaciones de Base de Datos
- **Antes**: Métodos de Mongoose como `find()`, `findOne()`, `save()`
- **Ahora**: Métodos personalizados que usan comandos de DynamoDB

## Estructura de la Tabla DynamoDB

### Tabla: `Users`
- **Partition Key**: `id` (String)
- **Índices Globales Secundarios**:
  - `email-index`: Para búsquedas por email
  - `username-index`: Para búsquedas por username

### Campos Principales
```json
{
  "id": "user_timestamp_random",
  "username": "string",
  "email": "string",
  "password": "hashed_string",
  "displayName": "string",
  "birthDate": "ISO_date_string",
  "gender": "string",
  "location": {
    "latitude": "number",
    "longitude": "number",
    "address": "string"
  },
  "profileImage": "string",
  "profileImageKey": "string",
  "profileCompleted": "boolean",
  "passwordChangedAt": "ISO_date_string",
  "active": "boolean",
  "lastLogin": "ISO_date_string",
  "loginAttempts": "number",
  "lockUntil": "ISO_date_string",
  "createdAt": "ISO_date_string",
  "updatedAt": "ISO_date_string"
}
```

## Configuración Requerida

### Variables de Entorno
```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-2

# DynamoDB
DYNAMODB_TABLE_NAME=Users

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h
```

### Configuración de DynamoDB
```bash
npm run setup-dynamodb
```

## Diferencias en el Código

### Antes (MongoDB/Mongoose)
```javascript
// Crear usuario
const user = new User(data);
await user.save();

// Buscar usuario
const user = await User.findOne({ email: 'test@example.com' });

// Actualizar usuario
const updatedUser = await User.findByIdAndUpdate(id, data, { new: true });
```

### Ahora (DynamoDB)
```javascript
// Crear usuario
const user = await User.create(data);

// Buscar usuario
const user = await User.findByEmail('test@example.com');

// Actualizar usuario
const user = await User.findById(id);
await user.update(data);
```

## Ventajas de la Migración

1. **Integración AWS**: Mejor integración con otros servicios AWS
2. **Escalabilidad**: Escalado automático sin configuración manual
3. **Costo**: Pago por uso en lugar de instancias fijas
4. **Mantenimiento**: Sin necesidad de gestionar servidores de base de datos
5. **Backup**: Backups automáticos y punto en el tiempo

## Consideraciones

1. **Índices**: DynamoDB requiere índices para consultas eficientes
2. **Consultas**: Las consultas complejas pueden requerir múltiples operaciones
3. **Transacciones**: Limitaciones en transacciones multi-tabla
4. **Costo**: El costo puede variar según el patrón de acceso

## Próximos Pasos

1. Configurar la tabla DynamoDB usando `npm run setup-dynamodb`
2. Probar las operaciones CRUD básicas
3. Monitorear el uso y costo de DynamoDB
4. Optimizar índices según el patrón de acceso
5. Implementar métricas y alertas de costo

## Soporte

Para problemas o preguntas sobre la migración, revisar:
- [Documentación oficial de DynamoDB](https://docs.aws.amazon.com/dynamodb/)
- [SDK de AWS para JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
- Logs del servidor para errores específicos
