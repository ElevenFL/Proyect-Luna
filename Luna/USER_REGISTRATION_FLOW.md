# Flujo de Registro de Usuarios - Lunae

## Descripción General

Este documento describe el flujo completo de registro de usuarios implementado en la aplicación Lunae, que incluye:

1. **Registro inicial** con AWS Amplify
2. **Verificación del email** con código de confirmación
3. **Sincronización automática** con el backend personalizado (DynamoDB)
4. **Redirección al onboarding** para completar el perfil
5. **Acceso al home** una vez completado el perfil

## Arquitectura

### Frontend (React Native + Expo)
- **AuthContext**: Maneja la autenticación y sincronización
- **Amplify**: Autenticación principal con AWS Cognito
- **Backend personalizado**: Sincronización y datos de usuario

### Backend (Node.js + Express + DynamoDB)
- **DynamoDB**: Base de datos principal para usuarios
- **Sincronización**: API para sincronizar usuarios de Amplify
- **Perfiles**: Gestión del estado de completitud del perfil

## Flujo de Registro

### 1. Registro Inicial
```typescript
// Usuario se registra con username, email y password
const result = await Auth.signUp({
  username: username,
  password: password,
  options: {
    userAttributes: { email: email }
  }
});
```

### 2. Verificación del Email
```typescript
// Usuario ingresa código de 6 dígitos
const confirmResult = await Auth.confirmSignUp({
  username: storedUsername,
  confirmationCode: code
});
```

### 3. Sincronización Automática
```typescript
// Después de la verificación, se sincroniza con el backend
const syncResponse = await ApiService.syncAmplifyUser(
  username,
  email,
  sub // ID único de Amplify
);
```

### 4. Redirección al Onboarding
```typescript
// Si el perfil no está completo, se redirige al onboarding
if (!user.profileCompleted) {
  router.replace('/onboarding/welcome');
}
```

### 5. Completar Perfil
El usuario debe completar:
- Nombre completo
- Fecha de nacimiento
- Género
- Ubicación
- Foto de perfil

### 6. Acceso al Home
```typescript
// Una vez completado el perfil, se redirige al home
if (user.profileCompleted) {
  router.replace('/(tabs)');
}
```

## Configuración Requerida

### Variables de Entorno Frontend (.env)
```bash
EXPO_PUBLIC_API_URL=http://192.168.1.11:3000/api
EXPO_PUBLIC_AWS_REGION=us-east-2
EXPO_PUBLIC_USER_POOL_ID=your_user_pool_id
EXPO_PUBLIC_USER_POOL_CLIENT_ID=your_user_pool_client_id
```

### Variables de Entorno Backend (.env)
```bash
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
DYNAMODB_TABLE_NAME=Users
JWT_SECRET=your_jwt_secret
```

## Estructura de la Base de Datos

### Tabla Users (DynamoDB)
```json
{
  "id": "user_1234567890_abc123",
  "username": "usuario123",
  "email": "usuario@email.com",
  "amplifySub": "amplify_user_id",
  "profileCompleted": false,
  "active": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Índices Globales Secundarios
- `email-index`: Búsqueda por email
- `username-index`: Búsqueda por username
- `amplify-sub-index`: Búsqueda por ID de Amplify

## API Endpoints

### POST /api/users/sync-amplify
Sincroniza un usuario de Amplify con DynamoDB.

**Request:**
```json
{
  "username": "usuario123",
  "email": "usuario@email.com",
  "sub": "amplify_user_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Usuario sincronizado exitosamente",
  "user": {
    "id": "user_1234567890_abc123",
    "username": "usuario123",
    "email": "usuario@email.com",
    "profileCompleted": false
  }
}
```

### GET /api/users/profile-status
Verifica el estado del perfil del usuario autenticado.

**Response:**
```json
{
  "success": true,
  "message": "Perfil del usuario verificado",
  "user": {
    "id": "user_1234567890_abc123",
    "username": "usuario123",
    "email": "usuario@email.com",
    "profileCompleted": false
  }
}
```

## Manejo de Errores

### Errores de Sincronización
- Si la sincronización falla, se continúa con el flujo normal
- Los datos se obtienen de Amplify como respaldo
- Se registran los errores para debugging

### Errores de Verificación
- Código incorrecto: Solicitar nuevo código
- Código expirado: Reenviar código
- Usuario ya verificado: Redirigir al login

## Seguridad

### Autenticación
- **Amplify**: Maneja la autenticación principal
- **JWT**: Tokens para comunicación con el backend
- **Validación**: Verificación de campos en frontend y backend

### Autorización
- **Middleware de autenticación** en rutas protegidas
- **Verificación de tokens** en cada request
- **Control de acceso** basado en estado del perfil

## Testing

### Flujo de Prueba
1. Registrar usuario nuevo
2. Verificar email con código
3. Verificar redirección al onboarding
4. Completar perfil paso a paso
5. Verificar redirección al home
6. Verificar datos sincronizados en DynamoDB

### Casos de Error
- Email ya registrado
- Username ya en uso
- Código de verificación incorrecto
- Código de verificación expirado
- Error de conexión con el backend

## Mantenimiento

### Monitoreo
- Logs de sincronización
- Métricas de usuarios registrados
- Estado de la base de datos

### Actualizaciones
- Mantener compatibilidad con Amplify
- Actualizar índices de DynamoDB según sea necesario
- Revisar y actualizar validaciones

## Troubleshooting

### Problemas Comunes
1. **Usuario no se sincroniza**: Verificar conexión con DynamoDB
2. **Error de verificación**: Verificar configuración de Amplify
3. **Redirección incorrecta**: Verificar estado del perfil en la base de datos

### Logs de Debug
```typescript
console.log('Error sincronizando con el backend:', syncError);
console.log('Usuario autenticado después de verificación, redirigiendo al onboarding');
console.log('AuthGuard: Usuario sin perfil completo, redirigiendo al onboarding');
```
