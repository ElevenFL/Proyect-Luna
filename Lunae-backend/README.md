# Lunae Backend

Backend para la aplicación de citas Lunae, construido con Node.js, Express y DynamoDB.

## 🚀 Características

- **Autenticación JWT** con manejo de sesiones seguras
- **API RESTful** para gestión de usuarios y perfiles
- **Almacenamiento de imágenes** en AWS S3 con URLs presignadas
- **Base de datos NoSQL** usando DynamoDB para escalabilidad
- **Validación de datos** robusta y manejo de errores
- **Sistema de bloqueo** por intentos fallidos de login
- **Middleware de autenticación** para proteger rutas

## 🛠️ Tecnologías

- **Runtime**: Node.js
- **Framework**: Express.js
- **Base de Datos**: AWS DynamoDB
- **Almacenamiento**: AWS S3
- **Autenticación**: JWT (JSON Web Tokens)
- **Validación**: bcryptjs para hash de contraseñas
- **CORS**: Soporte para desarrollo y producción

## 📋 Prerrequisitos

- Node.js 18+ 
- Cuenta de AWS con acceso a DynamoDB y S3
- Credenciales de AWS configuradas

## 🔧 Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd Lunae-backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
# Editar .env con tus credenciales de AWS
```

4. **Configurar DynamoDB**
```bash
npm run setup-dynamodb
```

5. **Iniciar el servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## ⚙️ Configuración

### Variables de Entorno

```bash
# Servidor
PORT=3000
NODE_ENV=development

# AWS
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# DynamoDB
DYNAMODB_TABLE_NAME=Users

# S3
AWS_S3_BUCKET=your-bucket-name

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:19006
```

### Estructura de la Base de Datos

La tabla `Users` en DynamoDB incluye:

- **Partition Key**: `id` (String)
- **Índices Globales Secundarios**:
  - `email-index`: Para búsquedas por email
  - `username-index`: Para búsquedas por username

## 📚 API Endpoints

### Autenticación
- `POST /api/users/register` - Registrar nuevo usuario
- `POST /api/users/login` - Iniciar sesión
- `GET /api/users/profile` - Obtener perfil del usuario autenticado

### Perfil
- `GET /api/profile` - Obtener perfil completo
- `PUT /api/profile` - Actualizar perfil

### Imágenes
- `POST /api/images/upload-url` - Generar URL de subida
- `GET /api/images/download/:imageKey` - Generar URL de descarga
- `DELETE /api/images/:imageKey` - Eliminar imagen
- `GET /api/images/list` - Listar imágenes

## 🔐 Autenticación

El sistema usa JWT para autenticación. Incluye el token en el header:

```bash
Authorization: Bearer <your-jwt-token>
```

### Características de Seguridad

- **Hash de contraseñas**: bcrypt con salt de 10 rondas
- **Bloqueo temporal**: 5 intentos fallidos bloquean la cuenta por 1 hora
- **Tokens JWT**: Expiración configurable con invalidación por cambio de contraseña
- **Middleware de autenticación**: Protección automática de rutas

## 🗄️ Operaciones de Base de Datos

### Crear Usuario
```javascript
const user = await User.create({
  username: 'usuario123',
  email: 'usuario@example.com',
  password: 'contraseña123'
});
```

### Buscar Usuario
```javascript
// Por ID
const user = await User.findById('user_id');

// Por email
const user = await User.findByEmail('usuario@example.com');

// Por username
const user = await User.findByUsername('usuario123');
```

### Actualizar Usuario
```javascript
const user = await User.findById('user_id');
await user.update({
  displayName: 'Nuevo Nombre',
  birthDate: '1990-01-01'
});
```

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor con nodemon

# Producción
npm start            # Servidor estático

# Configuración
npm run setup-aws    # Configurar AWS
npm run setup-env    # Configurar variables de entorno
npm run setup-dynamodb # Configurar tabla DynamoDB

# Utilidades
npm run test-server  # Servidor de prueba
npm run quick-start  # Configuración rápida
```

## 📁 Estructura del Proyecto

```
src/
├── config/          # Configuración de AWS y base de datos
├── controllers/     # Lógica de negocio
├── middleware/      # Middleware personalizado
├── models/          # Modelos de datos (DynamoDB)
├── routes/          # Definición de rutas
└── index.js         # Punto de entrada

scripts/             # Scripts de configuración
```

## 🔍 Monitoreo y Debugging

### Logs del Servidor
- Todos los requests se registran con timestamp
- Errores detallados en consola
- Health check endpoint en `/health`

### Métricas de DynamoDB
- Monitorear uso de capacidad
- Revisar índices y consultas
- Alertas de costo recomendadas

## 🚨 Solución de Problemas

### Error de Conexión a DynamoDB
1. Verificar credenciales de AWS
2. Confirmar región configurada
3. Verificar permisos de IAM

### Error de Tabla No Encontrada
```bash
npm run setup-dynamodb
```

### Error de Autenticación
1. Verificar JWT_SECRET en .env
2. Confirmar formato del token
3. Revisar expiración del token

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama para feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

## 📞 Soporte

Para soporte técnico o preguntas:
- Revisar logs del servidor
- Consultar documentación de DynamoDB
- Verificar configuración de AWS

---

**Nota**: Este proyecto ha sido migrado de MongoDB a DynamoDB para mejor integración con AWS y escalabilidad.
