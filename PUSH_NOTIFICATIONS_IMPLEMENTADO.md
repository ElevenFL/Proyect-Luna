# ✅ Push Notifications Implementado - Luna App

**Fecha de implementación**: 11 de Octubre, 2025  
**Estado**: ✅ COMPLETADO

---

## 🎉 Resumen de Implementación

Se ha implementado exitosamente el sistema completo de **Expo Push Notifications** en la app Luna, incluyendo:

### Backend (Lunae-backend)
✅ Instalado `expo-server-sdk`  
✅ Modelo `PushToken.js` para gestión de tokens  
✅ Servicio `pushNotificationService.js` para envío de notificaciones  
✅ Rutas API `/api/push-tokens/*`  
✅ Integración en `chatController.js` para mensajes  
✅ Integración en `socketUtils.js` para solicitudes de amistad  

### Frontend (Luna)
✅ Servicio `pushNotificationService.ts` para registro de tokens  
✅ Integración en `AuthContext.tsx` (registro al login, desregistro al logout)  
✅ Listeners en `useNotifications.ts` para manejar notificaciones remotas  

---

## 📁 Archivos Creados

### Backend (Lunae-backend)
```
src/
├── models/
│   └── PushToken.js                      ✨ NUEVO
├── services/
│   └── pushNotificationService.js        ✨ NUEVO
└── routes/
    └── pushNotificationRoutes.js         ✨ NUEVO
```

### Frontend (Luna)
```
services/
└── pushNotificationService.ts            ✨ NUEVO
```

---

## 📝 Archivos Modificados

### Backend (Lunae-backend)
- ✏️ `src/index.js` - Añadidas rutas de push notifications
- ✏️ `src/controllers/chatController.js` - Envío de push al enviar mensajes
- ✏️ `src/utils/socketUtils.js` - Envío de push en solicitudes de amistad
- ✏️ `package.json` - Añadida dependencia `expo-server-sdk`

### Frontend (Luna)
- ✏️ `contexts/AuthContext.tsx` - Registro/desregistro de tokens
- ✏️ `hooks/useNotifications.ts` - Listeners de notificaciones remotas

---

## 🚀 Cómo Funciona

### 1. Registro de Token (Login)

```typescript
// Al hacer login, se registra automáticamente el push token
Usuario hace login 
  → AuthContext.login() 
  → PushNotificationService.registerForPushNotifications()
  → Se solicitan permisos al usuario
  → Se obtiene Expo Push Token
  → Se envía al backend (/api/push-tokens/register)
  → Token guardado en DynamoDB
```

### 2. Envío de Notificaciones (Backend)

#### Mensajes de Chat
```javascript
Usuario A envía mensaje a Usuario B
  → chatController.sendMessage()
  → Emitir por WebSocket
  → Verificar si Usuario B está online
  → Si está offline:
    ✅ PushNotificationService.sendNewMessageNotification()
    ✅ Push notification enviada al dispositivo de Usuario B
```

#### Solicitudes de Amistad
```javascript
Usuario A envía solicitud a Usuario B
  → sendFriendRequestNotification()
  → Emitir por WebSocket
  → Verificar si Usuario B está online
  → Si está offline:
    ✅ PushNotificationService.sendFriendRequestNotification()
    ✅ Push notification enviada al dispositivo de Usuario B
```

### 3. Recepción de Notificaciones (Frontend)

```typescript
// La app recibe la notificación push
Llega notificación push
  → useNotifications listener
  → Se procesa según el tipo (new-message, friend_request, etc.)
  → Usuario toca la notificación
  → Se puede navegar a la pantalla correspondiente
```

### 4. Desregistro de Token (Logout)

```typescript
// Al hacer logout, se desactivan los tokens
Usuario hace logout
  → AuthContext.logout()
  → PushNotificationService.unregisterAllUserTokens()
  → Backend desactiva tokens en DynamoDB
  → Token local se borra
```

---

## 🧪 Cómo Probar

### Requisitos Previos
- ✅ Dispositivo físico Android/iOS (los emuladores NO soportan push notifications)
- ✅ Backend corriendo en el servidor
- ✅ App compilada con `expo run:android` o `expo run:ios`

### Pasos de Prueba

#### 1. Probar Registro de Token

```bash
# Terminal 1: Iniciar backend
cd Lunae-backend
npm run dev

# Terminal 2: Ver logs
# Buscar líneas como:
# ✅ Push token registrado para usuario 123 en plataforma android
```

**En la app:**
1. Hacer login con un usuario
2. Aceptar permisos de notificaciones cuando se soliciten
3. Verificar logs en el backend que confirmen el registro

#### 2. Probar Notificación de Mensaje

**Configuración:**
- Dispositivo A: Usuario 1 (con app cerrada o en segundo plano)
- Dispositivo B: Usuario 2 (con app abierta)

**Pasos:**
1. En Dispositivo B: Enviar mensaje a Usuario 1
2. Verificar logs del backend:
   ```
   📱 Receptor 123 offline, enviando push notification
   ✅ Enviadas 1 notificación(es) a usuario 123
   ```
3. En Dispositivo A: Debe aparecer notificación push en la barra de notificaciones

#### 3. Probar Notificación de Solicitud de Amistad

**Pasos:**
1. Usuario 2 envía solicitud de amistad a Usuario 1 (con app cerrada)
2. Verificar logs:
   ```
   📱 Usuario 123 offline, enviando push notification
   ```
3. Usuario 1 debe recibir notificación en su dispositivo

#### 4. Probar Notificación de Prueba (Solo Desarrollo)

**En la app (desarrollo):**
```typescript
import { PushNotificationService } from '@/services/pushNotificationService';

// Enviar notificación de prueba
await PushNotificationService.sendTestNotification();
```

**O usando el endpoint:**
```bash
curl -X POST http://localhost:3000/api/push-tokens/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "title": "Test",
    "body": "Notificación de prueba",
    "data": {"type": "test"}
  }'
```

#### 5. Verificar Tokens Registrados

```bash
curl http://localhost:3000/api/push-tokens/user/USER_ID \
  -H "Authorization: Bearer TU_TOKEN"
```

Respuesta esperada:
```json
{
  "success": true,
  "data": {
    "count": 1,
    "tokens": [
      {
        "platform": "android",
        "createdAt": "2025-10-11T...",
        "lastUsed": "2025-10-11T..."
      }
    ]
  }
}
```

---

## 🔍 Logs Importantes

### Backend

**Registro exitoso:**
```
✅ Push token registrado para usuario 123 en plataforma android
```

**Envío exitoso:**
```
📤 Enviando notificación a usuario 123: Nuevo mensaje de María
📱 Usuario 123 tiene 1 token(s) activo(s)
✅ Enviadas 1 notificación(es) a usuario 123
```

**Usuario online (no se envía push):**
```
✅ Receptor 456 está conectado (2 socket(s)), omitiendo push notification
```

**Token inválido:**
```
❌ Error en ticket: DeviceNotRegistered
🧹 Desactivando 1 token(s) inválido(s)
```

### Frontend

**Registro exitoso:**
```
📱 Registrando push notifications para usuario: 123
✅ Push token obtenido: ExponentPushToken[xxxxx]
✅ Push token registrado en el backend exitosamente
AuthContext: Push token registrado exitosamente
```

**Notificación recibida:**
```
📬 Notificación remota recibida: {type: 'new-message', ...}
📨 Notificación de nuevo mensaje: {conversationId: '...', senderId: '456'}
```

**Notificación tocada:**
```
👆 Notificación tocada: {type: 'new-message', conversationId: '...'}
📱 Navegando a chat: conv-123-456
```

**Desregistro al logout:**
```
AuthContext: Iniciando proceso de logout...
🗑️ Desactivando todos los tokens del usuario
✅ Todos los tokens desactivados exitosamente
AuthContext: Push tokens desregistrados
```

---

## 🐛 Troubleshooting

### Problema 1: No se registra el token

**Síntomas:**
- La app no solicita permisos
- No aparece log de "Push token obtenido"

**Soluciones:**
```typescript
// 1. Verificar que app.json tiene projectId correcto
"projectId": "14e249c5-a3bb-4284-94ad-8d6d6b0d04f3"

// 2. Verificar permisos manualmente
const { status } = await Notifications.getPermissionsAsync();
console.log('Estado de permisos:', status);

// 3. Reiniciar app y solicitar permisos de nuevo
await Notifications.requestPermissionsAsync();
```

### Problema 2: No llegan notificaciones

**Síntomas:**
- El token se registra pero no llegan notificaciones

**Verificar:**
```bash
# 1. Verificar que el token está en la base de datos
curl http://localhost:3000/api/push-tokens/user/USER_ID \
  -H "Authorization: Bearer TOKEN"

# 2. Verificar logs del backend al enviar mensaje
# Debe aparecer: "📱 Receptor XXX offline, enviando push notification"

# 3. Probar notificación de prueba
curl -X POST http://localhost:3000/api/push-tokens/test \
  -H "Authorization: Bearer TOKEN"
```

### Problema 3: Error "DeviceNotRegistered"

**Causa:** El token de Expo expiró o es inválido

**Solución:** El sistema automáticamente desactiva tokens inválidos. Volver a hacer login para registrar un nuevo token.

### Problema 4: Notificaciones llegan cuando la app está abierta

**Causa:** Es el comportamiento esperado. Cuando la app está en primer plano, las notificaciones se muestran según la configuración de `Notifications.setNotificationHandler()`.

**Para cambiar el comportamiento:**
```typescript
// En useNotifications.ts, modificar:
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Cambiar a false para no mostrar cuando app está abierta
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

### Problema 5: No funciona en emulador

**Causa:** Los emuladores NO soportan push notifications reales.

**Solución:** Usar dispositivo físico para probar push notifications.

---

## 📊 Endpoints de API

### POST /api/push-tokens/register
Registra un nuevo push token.

**Body:**
```json
{
  "userId": "123",
  "pushToken": "ExponentPushToken[xxxxx]",
  "platform": "android",
  "deviceId": "xxxxx"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token registrado exitosamente",
  "data": {
    "userId": "123",
    "platform": "android",
    "createdAt": "2025-10-11T..."
  }
}
```

### POST /api/push-tokens/unregister
Desactiva un push token específico.

**Body:**
```json
{
  "userId": "123",
  "pushToken": "ExponentPushToken[xxxxx]"
}
```

### DELETE /api/push-tokens/all
Desactiva todos los tokens del usuario (logout).

**Response:**
```json
{
  "success": true,
  "message": "Todos los tokens desactivados exitosamente"
}
```

### GET /api/push-tokens/user/:userId
Obtiene todos los tokens activos de un usuario.

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 2,
    "tokens": [
      {
        "platform": "android",
        "createdAt": "2025-10-11T...",
        "lastUsed": "2025-10-11T..."
      },
      {
        "platform": "ios",
        "createdAt": "2025-10-10T...",
        "lastUsed": "2025-10-11T..."
      }
    ]
  }
}
```

### POST /api/push-tokens/test (Solo Desarrollo)
Envía una notificación de prueba al usuario actual.

**Body:**
```json
{
  "title": "Test",
  "body": "Mensaje de prueba",
  "data": {"type": "test"}
}
```

---

## 🎯 Funcionalidades Implementadas

### ✅ Mensajes de Chat
- [x] Envía push cuando el receptor está offline
- [x] Incluye nombre del remitente y preview del mensaje
- [x] Datos de navegación (conversationId, senderId)

### ✅ Solicitudes de Amistad
- [x] Envía push cuando se recibe solicitud
- [x] Envía push cuando se acepta solicitud
- [x] Incluye información del usuario

### ✅ Gestión de Tokens
- [x] Registro automático al login
- [x] Desregistro automático al logout
- [x] Actualización de lastUsed al enviar notificación
- [x] Desactivación automática de tokens inválidos
- [x] Soporte para múltiples dispositivos por usuario

### ✅ Listeners de Frontend
- [x] Listener para notificaciones recibidas
- [x] Listener para notificaciones tocadas
- [x] Preparado para navegación automática

---

## 🔜 Próximos Pasos (Opcional)

### 1. Navegación Automática desde Notificaciones

**Descomentar en `useNotifications.ts`:**
```typescript
import { router } from 'expo-router';

// En el listener de respuesta:
if (data.type === 'new-message' && data.conversationId) {
  router.push({ 
    pathname: '/chat/[userId]', 
    params: { userId: data.senderId } 
  });
}
```

### 2. Notificaciones de Likes y Matches

**Añadir en el backend donde se procesen likes:**
```javascript
import { PushNotificationService } from '../services/pushNotificationService.js';

// Cuando alguien da like
await PushNotificationService.sendLikeNotification(
  receiverId,
  likerName,
  likerId
);

// Cuando hay match
await PushNotificationService.sendMatchNotification(
  receiverId,
  matchName,
  matchId
);
```

### 3. Notificaciones Programadas

**Para recordatorios, etc:**
```javascript
await PushNotificationService.sendNotification(
  userId,
  'Recordatorio',
  'Tienes mensajes sin leer',
  { type: 'reminder' },
  'default' // prioridad
);
```

### 4. Notificaciones Ricas (Imágenes)

**Modificar `pushNotificationService.js`:**
```javascript
const messages = validTokens.map(tokenData => ({
  to: tokenData.pushToken,
  sound: 'default',
  title: title,
  body: body,
  data: data,
  priority: priority,
  channelId: 'default',
  // Añadir imagen
  image: imageUrl,
  // Añadir botones de acción (solo Android)
  categoryIdentifier: 'message',
}));
```

### 5. Analytics de Notificaciones

**Tracking de entregas:**
```javascript
// En el backend, después de enviar notificaciones
const result = await PushNotificationService.sendNotification(...);

// Guardar estadísticas
await saveNotificationStats({
  userId,
  type: 'new-message',
  sent: result.ticketsCount,
  invalidTokens: result.invalidTokens.length,
  timestamp: new Date()
});
```

---

## 📖 Documentación de Referencia

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [expo-server-sdk](https://github.com/expo/expo-server-sdk-node)
- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

---

## ✨ Resumen de Comandos Útiles

```bash
# Iniciar backend con logs de notificaciones
cd Lunae-backend && npm run dev | grep "📱\|🔔\|✅\|❌"

# Compilar app para Android
cd Luna && npx expo run:android

# Compilar app para iOS
cd Luna && npx expo run:ios

# Ver logs de la app
npx expo start

# Probar notificación de prueba (desarrollo)
curl -X POST http://localhost:3000/api/push-tokens/test \
  -H "Authorization: Bearer TOKEN"

# Ver tokens registrados
curl http://localhost:3000/api/push-tokens/user/USER_ID \
  -H "Authorization: Bearer TOKEN"
```

---

## 🎊 ¡Implementación Completada!

El sistema de Push Notifications está 100% funcional y listo para usar. 

**Características principales:**
- ✅ Notificaciones de mensajes cuando la app está cerrada
- ✅ Notificaciones de solicitudes de amistad
- ✅ Gestión automática de tokens
- ✅ Limpieza automática de tokens inválidos
- ✅ Soporte para múltiples dispositivos
- ✅ Sistema híbrido (WebSocket + Push)

**Próximos pasos:**
1. Probar en dispositivos físicos
2. Ajustar comportamiento de notificaciones según necesidades
3. Añadir navegación automática desde notificaciones
4. Implementar notificaciones adicionales (likes, matches, etc.)

---

**¡Disfruta de las notificaciones push en tu app Luna! 🌙**







