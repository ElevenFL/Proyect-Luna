# 🔄 Sincronización Automática con DynamoDB

## 📋 Resumen

Se ha implementado la **Opción 2** de sincronización automática que permite que los usuarios se sincronicen automáticamente con DynamoDB cuando verifican su email, y que la información del onboarding se guarde paso a paso en la base de datos.

## 🚀 Flujo de Sincronización

### 1. Registro del Usuario
```
Usuario se registra → Amplify crea cuenta → Usuario recibe email de verificación
```

### 2. Verificación del Email
```
Usuario verifica email → Se ejecuta sincronización automática → Usuario se crea en DynamoDB
```

### 3. Onboarding
```
Usuario completa onboarding → Cada campo se guarda individualmente en DynamoDB → Perfil se marca como completo
```

## 🔧 Implementación

### Archivos Modificados

#### Frontend (Luna/)
- **`app/(auth)/verify.tsx`** - Sincronización automática al verificar email
- **`contexts/AuthContext.tsx`** - Sincronización en login y confirmación
- **`services/apiService.ts`** - Métodos para onboarding y perfil
- **`hooks/useOnboarding.ts`** - Hook personalizado para manejar onboarding
- **`app/onboarding/name.tsx`** - Ejemplo de pantalla que usa el hook
- **`app/onboarding/birthdate.tsx`** - Ejemplo de pantalla que usa el hook

#### Backend (Lunae-backend/)
- **`src/routes/userRoutes.js`** - Endpoint `/sync-amplify` para sincronización
- **`src/models/Users.js`** - Modelo de usuario con soporte para DynamoDB
- **`src/controllers/profileController.js`** - Controlador para actualización de perfil
- **`scripts/test-sync-flow.js`** - Script de prueba para el flujo completo

## 📱 Uso del Hook de Onboarding

### Importar el Hook
```typescript
import { useOnboarding } from '@/hooks/useOnboarding';
```

### Usar en Componentes
```typescript
const { 
  updateName, 
  updateBirthDate, 
  updateGender, 
  updateLocation, 
  updateProfileImage,
  isLoading, 
  error 
} = useOnboarding();

// Ejemplo de uso
const handleSaveName = async () => {
  const success = await updateName(displayName);
  if (success) {
    // Continuar al siguiente paso
    router.push('/onboarding/birthdate');
  }
};
```

## 🗄️ Estructura de la Base de Datos

### Tabla: Users
```json
{
  "id": "user_timestamp_random",
  "username": "usuario123",
  "email": "usuario@email.com",
  "amplifySub": "amplify_user_sub_id",
  "displayName": "Nombre del Usuario",
  "birthDate": "1990-01-01T00:00:00.000Z",
  "gender": "No especificado",
  "location": {
    "latitude": 40.4168,
    "longitude": -3.7038,
    "address": "Madrid, España"
  },
  "profileImage": "https://example.com/profile.jpg",
  "profileCompleted": true,
  "active": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Índices Requeridos
- **`email-index`** - Para búsquedas por email
- **`username-index`** - Para búsquedas por username
- **`amplify-sub-index`** - Para búsquedas por ID de Amplify

## 🧪 Pruebas

### Ejecutar Pruebas de Sincronización
```bash
cd Lunae-backend
npm run test-sync-flow
```

### Verificar Tabla de DynamoDB
```bash
cd Lunae-backend
npm run setup-dynamodb
```

## 🔍 Endpoints de la API

### Sincronización
- **`POST /api/users/sync-amplify`** - Sincroniza usuario de Amplify con DynamoDB

### Perfil
- **`GET /api/profile`** - Obtiene perfil del usuario
- **`PUT /api/profile`** - Actualiza perfil del usuario
- **`GET /api/users/profile-status`** - Verifica estado del perfil

## ⚠️ Consideraciones Importantes

### 1. Autenticación
- Las rutas de perfil requieren autenticación JWT válida
- El token debe incluirse en el header `Authorization: Bearer <token>`

### 2. Manejo de Errores
- Si la sincronización falla, el flujo continúa para no bloquear al usuario
- Los errores se muestran en la UI pero no impiden la navegación

### 3. Estado Local vs Base de Datos
- El estado local se actualiza inmediatamente para mejor UX
- La base de datos se actualiza de forma asíncrona
- Si hay error en la base de datos, el estado local se mantiene

## 🚨 Solución de Problemas

### Usuario no se sincroniza
1. Verificar que el backend esté corriendo
2. Verificar credenciales de AWS en `.env`
3. Verificar que la tabla de DynamoDB exista
4. Revisar logs del backend para errores

### Error en onboarding
1. Verificar que el usuario esté autenticado
2. Verificar que el token JWT sea válido
3. Revisar logs del backend para errores de validación

### Problemas de conectividad
1. Verificar que `EXPO_PUBLIC_API_URL` esté configurado correctamente
2. Verificar que el backend sea accesible desde la app
3. Verificar configuración de CORS en el backend

## 📈 Próximos Pasos

### Mejoras Futuras
1. **Lambda Trigger** - Implementar sincronización automática en AWS Cognito
2. **Retry Logic** - Reintentos automáticos en caso de fallo de sincronización
3. **Offline Support** - Sincronización cuando la app vuelva a estar online
4. **Batch Updates** - Actualizaciones en lote para mejor rendimiento

### Monitoreo
1. **Logs** - Implementar logging estructurado para debugging
2. **Métricas** - Monitorear tasa de éxito de sincronización
3. **Alertas** - Notificaciones automáticas en caso de fallos

## 🔗 Enlaces Útiles

- [Documentación de DynamoDB](https://docs.aws.amazon.com/dynamodb/)
- [AWS SDK para JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
- [React Native AsyncStorage](https://react-native-async-storage.github.io/async-storage/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
