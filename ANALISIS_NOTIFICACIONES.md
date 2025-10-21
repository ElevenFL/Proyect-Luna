# 📱 Análisis del Sistema de Notificaciones - Luna App

**Fecha**: 11 de Octubre, 2025  
**Estado**: ⚠️ INCOMPLETO - Requiere Implementación de Push Notifications

---

## 🔍 Resumen Ejecutivo

El sistema de notificaciones de Luna **NO está completamente implementado**. Actualmente solo funciona parcialmente con notificaciones locales y WebSockets, pero **NO envía notificaciones push reales al celular** cuando la app está cerrada.

### Estado Actual
- ✅ **Notificaciones In-App**: Funcionan (cuando la app está abierta)
- ✅ **Notificaciones Locales**: Funcionan (cuando la app está en segundo plano)
- ✅ **WebSockets**: Funcionan (para comunicación en tiempo real)
- ❌ **Push Notifications**: **NO IMPLEMENTADAS** (cuando la app está cerrada)
- ❌ **Registro de Tokens**: **NO IMPLEMENTADO**
- ❌ **Servicio de Push**: **NO CONFIGURADO**

---

## 📊 Análisis Detallado

### 1. Frontend (Luna App)

#### ✅ Componentes Implementados

**Configuración Básica** (`app.json`)
- Plugin `expo-notifications` configurado correctamente
- Canal de notificaciones por defecto definido
- Icono de notificación configurado

**Hook de Notificaciones** (`hooks/useNotifications.ts`)
- Solicita permisos de notificación ✅
- Muestra notificaciones in-app ✅
- Muestra notificaciones locales ✅
- Maneja vibración y sonidos ✅
- Listeners para respuestas a notificaciones ✅

**Componentes UI**
- `InAppNotification.tsx` - Notificaciones dentro de la app ✅
- `NotificationContainer.tsx` - Contenedor de notificaciones ✅
- `NotificationBadge.tsx` - Badge de contador ✅

#### ❌ Componentes Faltantes

1. **Registro de Push Token**
   ```typescript
   // FALTA: No hay función para obtener y registrar el Expo Push Token
   async function registerForPushNotifications() {
     const token = await Notifications.getExpoPushTokenAsync();
     // Enviar token al backend
   }
   ```

2. **Sincronización con Backend**
   - No se guarda el push token del dispositivo
   - No se actualiza el token cuando cambia
   - No se asocia el token con el usuario en el backend

3. **Manejo de Notificaciones Push**
   - No hay listener para notificaciones remotas
   - No hay manejo de datos personalizados en push notifications

#### ⚠️ Problemas Identificados

**`useNotifications.ts` - Línea 58-83**
```typescript
const showLocalNotification = useCallback(async (message: ChatMessage, senderName?: string) => {
  // Solo muestra notificaciones LOCALES, no REMOTAS
  await Notifications.scheduleNotificationAsync({
    content: { /* ... */ },
    trigger: null, // Notificación local inmediata
  });
}, []);
```

**Problema**: Esta función solo programa notificaciones locales desde el propio dispositivo. No recibe push notifications desde un servidor.

### 2. Backend (Lunae-backend)

#### ✅ Implementado

**WebSockets** (`src/index.js`, líneas 92-409)
- Sistema de autenticación de sockets ✅
- Salas de usuario personales (`user_${userId}`) ✅
- Emisión de eventos de notificación ✅
- Tracking de usuarios conectados ✅

**Notificaciones por WebSocket** (`src/utils/socketUtils.js`)
```javascript
export const sendFriendRequestNotification = async (receiverId, senderInfo) => {
  io.to(`user_${receiverId}`).emit('notification', notificationData);
  // ✅ Funciona SOLO si el usuario está conectado
}
```

#### ❌ NO Implementado

1. **Servicio de Push Notifications**
   - No hay integración con Expo Push Notification Service
   - No hay integración con Firebase Cloud Messaging (FCM)
   - No hay almacenamiento de push tokens

2. **Tabla/Modelo de Push Tokens**
   ```javascript
   // FALTA: No existe
   {
     userId: string,
     pushToken: string,
     platform: 'ios' | 'android',
     deviceId: string,
     lastUpdated: timestamp
   }
   ```

3. **Controlador de Push Notifications**
   - No hay endpoint para registrar tokens
   - No hay endpoint para enviar notificaciones push
   - No hay función para enviar notificaciones cuando el usuario está offline

4. **Dependencias Faltantes**
   - No está instalado `expo-server-sdk` o similar
   - No hay configuración de Firebase Admin SDK

### 3. Permisos de Android

**`android/app/src/main/AndroidManifest.xml`**
```xml
<!-- ✅ TIENE -->
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.VIBRATE"/>

<!-- ❌ FALTAN (se añaden automáticamente por expo-notifications) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

> **Nota**: Expo debería añadir estos permisos automáticamente, pero es recomendable verificarlos después de hacer build.

---

## 🚨 Problemas Críticos

### 1. No Llegan Notificaciones con App Cerrada
**Causa**: No hay sistema de push notifications implementado.

**Impacto**:
- Los usuarios NO reciben notificaciones de mensajes cuando no tienen la app abierta
- Los usuarios NO reciben notificaciones de solicitudes de amistad cuando no están conectados
- Los usuarios pierden interacciones importantes

**Solución Requerida**: Implementar Expo Push Notifications o Firebase Cloud Messaging.

### 2. Dependencia Exclusiva de WebSockets
**Causa**: Las notificaciones solo funcionan vía WebSocket.

**Impacto**:
- Si el usuario pierde conexión a internet temporalmente, pierde notificaciones
- Si el servidor WebSocket falla, no hay respaldo
- No hay persistencia de notificaciones no entregadas

**Solución Requerida**: Implementar sistema híbrido (WebSocket + Push Notifications).

### 3. No Hay Registro de Tokens
**Causa**: No se captura ni guarda el push token del dispositivo.

**Impacto**:
- El backend no puede enviar notificaciones al dispositivo
- No se puede hacer targeting de notificaciones por usuario
- No se pueden enviar notificaciones cuando el usuario está offline

**Solución Requerida**: Crear flujo de registro de tokens.

---

## 🛠️ Soluciones Recomendadas

### Opción 1: Expo Push Notifications (Recomendado para MVP)

**Ventajas**:
- ✅ Más fácil de implementar
- ✅ Gratis hasta 1M notificaciones/mes
- ✅ Maneja iOS y Android automáticamente
- ✅ No requiere configuración de Firebase

**Desventajas**:
- ⚠️ Depende de servicios de Expo
- ⚠️ Menos personalización

**Implementación**:

#### Frontend (Luna):

1. **Crear servicio de Push Tokens** (`services/pushNotificationService.ts`):
```typescript
import * as Notifications from 'expo-notifications';
import ApiService from './apiService';

export class PushNotificationService {
  static async registerForPushNotifications(userId: string) {
    try {
      // Solicitar permisos
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permisos de notificación denegados');
        return null;
      }

      // Obtener token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '14e249c5-a3bb-4284-94ad-8d6d6b0d04f3' // Desde app.json
      });

      const token = tokenData.data;
      console.log('Push Token:', token);

      // Registrar en backend
      await ApiService.post('/push-tokens/register', {
        userId,
        pushToken: token,
        platform: Platform.OS,
      });

      return token;
    } catch (error) {
      console.error('Error registrando push token:', error);
      return null;
    }
  }

  static async unregisterPushToken(userId: string, token: string) {
    try {
      await ApiService.post('/push-tokens/unregister', {
        userId,
        pushToken: token,
      });
    } catch (error) {
      console.error('Error des-registrando push token:', error);
    }
  }
}
```

2. **Llamar al registro en AuthContext** después del login:
```typescript
// En AuthContext.tsx, después de login exitoso
await PushNotificationService.registerForPushNotifications(user.id);
```

3. **Añadir listener para notificaciones remotas**:
```typescript
// En useNotifications.ts
useEffect(() => {
  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('📬 Notificación recibida:', notification);
      // Manejar notificación entrante
      const data = notification.request.content.data;
      if (data.type === 'new-message') {
        // Actualizar UI, mostrar badge, etc.
      }
    }
  );

  return () => subscription.remove();
}, []);
```

#### Backend (Lunae-backend):

1. **Instalar dependencias**:
```bash
npm install expo-server-sdk
```

2. **Crear modelo de Push Tokens** (`src/models/PushToken.js`):
```javascript
export class PushToken {
  static async register(userId, pushToken, platform) {
    const now = new Date().toISOString();
    
    const item = {
      PK: `USER#${userId}`,
      SK: `PUSHTOKEN#${pushToken}`,
      entityType: 'PushToken',
      userId: String(userId),
      pushToken,
      platform,
      createdAt: now,
      updatedAt: now,
      isActive: true
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));

    return item;
  }

  static async getTokensByUserId(userId) {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'PUSHTOKEN#'
      }
    });

    const result = await docClient.send(command);
    return result.Items?.filter(item => item.isActive) || [];
  }
}
```

3. **Crear servicio de Push** (`src/services/pushNotificationService.js`):
```javascript
import { Expo } from 'expo-server-sdk';
import { PushToken } from '../models/PushToken.js';

const expo = new Expo();

export class PushNotificationService {
  static async sendNotification(userId, title, body, data = {}) {
    try {
      // Obtener tokens del usuario
      const tokens = await PushToken.getTokensByUserId(userId);
      
      if (tokens.length === 0) {
        console.log(`Usuario ${userId} no tiene tokens registrados`);
        return;
      }

      // Crear mensajes
      const messages = tokens.map(tokenData => ({
        to: tokenData.pushToken,
        sound: 'default',
        title,
        body,
        data: {
          ...data,
          userId
        },
      }));

      // Verificar tokens válidos
      const validMessages = messages.filter(message => 
        Expo.isExpoPushToken(message.to)
      );

      if (validMessages.length === 0) {
        console.log('No hay tokens válidos para enviar');
        return;
      }

      // Enviar notificaciones en chunks
      const chunks = expo.chunkPushNotifications(validMessages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error enviando chunk de notificaciones:', error);
        }
      }

      console.log(`✅ Enviadas ${tickets.length} notificaciones a usuario ${userId}`);
      return tickets;
    } catch (error) {
      console.error('Error en sendNotification:', error);
      throw error;
    }
  }

  // Enviar notificación de mensaje nuevo
  static async sendNewMessageNotification(receiverId, senderName, messageContent) {
    return this.sendNotification(
      receiverId,
      `Nuevo mensaje de ${senderName}`,
      messageContent.substring(0, 100),
      {
        type: 'new-message',
        senderId: senderName
      }
    );
  }

  // Enviar notificación de solicitud de amistad
  static async sendFriendRequestNotification(receiverId, senderName) {
    return this.sendNotification(
      receiverId,
      'Solicitud de amistad',
      `${senderName} quiere ser tu amiga`,
      {
        type: 'friend_request'
      }
    );
  }
}
```

4. **Crear rutas** (`src/routes/pushNotificationRoutes.js`):
```javascript
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { PushToken } from '../models/PushToken.js';

const router = express.Router();

// Registrar token
router.post('/register', authenticate, async (req, res) => {
  try {
    const { userId, pushToken, platform } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado' 
      });
    }

    const token = await PushToken.register(userId, pushToken, platform);
    
    res.status(201).json({
      success: true,
      message: 'Token registrado exitosamente',
      data: token
    });
  } catch (error) {
    console.error('Error registrando token:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Des-registrar token
router.post('/unregister', authenticate, async (req, res) => {
  try {
    const { userId, pushToken } = req.body;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado' 
      });
    }

    await PushToken.unregister(userId, pushToken);
    
    res.status(200).json({
      success: true,
      message: 'Token des-registrado exitosamente'
    });
  } catch (error) {
    console.error('Error des-registrando token:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

export default router;
```

5. **Integrar en index.js**:
```javascript
import pushNotificationRoutes from './routes/pushNotificationRoutes.js';
app.use('/api/push-tokens', pushNotificationRoutes);
```

6. **Modificar chatController.js** para enviar push cuando usuario está offline:
```javascript
import { PushNotificationService } from '../services/pushNotificationService.js';

export const sendMessage = async (req, res) => {
  // ... código existente ...

  // Después de emitir por WebSocket, verificar si el receptor está conectado
  const receiverSockets = Array.from(io.sockets.sockets.values())
    .filter(socket => socket.userId === String(receiverId));

  // Si el receptor NO está conectado, enviar push notification
  if (receiverSockets.length === 0) {
    console.log(`📱 Receptor ${receiverId} offline, enviando push notification`);
    
    try {
      const sender = await User.findById(senderId);
      const senderName = sender?.displayName || sender?.username || 'Alguien';
      
      await PushNotificationService.sendNewMessageNotification(
        receiverId,
        senderName,
        content
      );
    } catch (error) {
      console.error('Error enviando push notification:', error);
      // No interrumpir el flujo si falla el push
    }
  }

  return res.status(201).json({ success: true, data: { message } });
};
```

7. **Modificar socketUtils.js** para enviar push en solicitudes de amistad:
```javascript
import { PushNotificationService } from '../services/pushNotificationService.js';

export const sendFriendRequestNotification = async (receiverId, senderInfo) => {
  try {
    const io = getSocketIO();
    
    // Intentar enviar por WebSocket primero
    if (io) {
      io.to(`user_${receiverId}`).emit('notification', notificationData);
    }

    // Verificar si el usuario está conectado
    const receiverOnline = io && Array.from(io.sockets.sockets.values())
      .some(socket => socket.userId === String(receiverId));

    // Si NO está conectado, enviar push notification
    if (!receiverOnline) {
      console.log(`📱 Usuario ${receiverId} offline, enviando push notification`);
      await PushNotificationService.sendFriendRequestNotification(
        receiverId,
        senderInfo.name
      );
    }

    return true;
  } catch (error) {
    console.error('Error enviando notificación:', error);
    return false;
  }
};
```

### Opción 2: Firebase Cloud Messaging (Para Producción)

**Ventajas**:
- ✅ Más robusto y escalable
- ✅ Mejor para producción
- ✅ Más control y personalización
- ✅ Analytics integrados

**Desventajas**:
- ⚠️ Más complejo de configurar
- ⚠️ Requiere configuración separada para iOS y Android
- ⚠️ Requiere cuentas de Firebase

---

## 📋 Checklist de Implementación

### Frontend (Luna)
- [ ] Crear `services/pushNotificationService.ts`
- [ ] Modificar `AuthContext.tsx` para registrar tokens después del login
- [ ] Añadir listener de notificaciones remotas en `useNotifications.ts`
- [ ] Añadir manejo de navegación desde notificaciones
- [ ] Probar registro de tokens en dispositivo físico
- [ ] Manejar actualización de tokens cuando cambian

### Backend (Lunae-backend)
- [ ] Instalar `expo-server-sdk`
- [ ] Crear modelo `PushToken.js`
- [ ] Crear servicio `pushNotificationService.js`
- [ ] Crear rutas `pushNotificationRoutes.js`
- [ ] Modificar `chatController.js` para enviar push
- [ ] Modificar `socketUtils.js` para enviar push
- [ ] Añadir índice GSI en DynamoDB: `userId-pushToken-index`
- [ ] Implementar limpieza de tokens inválidos

### Testing
- [ ] Probar notificaciones con app en primer plano
- [ ] Probar notificaciones con app en segundo plano
- [ ] Probar notificaciones con app cerrada
- [ ] Probar notificaciones en Android
- [ ] Probar notificaciones en iOS
- [ ] Probar con múltiples dispositivos del mismo usuario
- [ ] Probar desregistro de tokens al logout

---

## 🎯 Prioridad de Implementación

### Alta Prioridad (Crítico)
1. ✅ Implementar registro de push tokens (Frontend + Backend)
2. ✅ Integrar Expo Push Notifications en backend
3. ✅ Enviar push notifications para mensajes
4. ✅ Enviar push notifications para solicitudes de amistad

### Media Prioridad
5. ⚠️ Añadir manejo de navegación desde notificaciones
6. ⚠️ Implementar limpieza de tokens inválidos
7. ⚠️ Añadir analytics de notificaciones

### Baja Prioridad
8. ℹ️ Migrar a Firebase Cloud Messaging (para producción)
9. ℹ️ Añadir notificaciones programadas
10. ℹ️ Implementar notificaciones ricas (imágenes, acciones)

---

## 🔧 Comandos de Testing

```bash
# Frontend - Probar en desarrollo
cd Luna
npx expo start --dev-client

# Backend - Ver logs de notificaciones
cd Lunae-backend
npm run dev | grep "📱\|🔔"

# Probar envío de notificación desde backend (consola de Node)
const PushNotificationService = require('./src/services/pushNotificationService');
await PushNotificationService.sendNotification('userId123', 'Test', 'Mensaje de prueba');
```

---

## 📖 Referencias

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [expo-server-sdk](https://github.com/expo/expo-server-sdk-node)
- [React Native Notifications](https://reactnative.dev/docs/pushnotificationios)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

---

## ✅ Conclusión

El sistema de notificaciones de Luna **requiere implementación urgente de push notifications** para funcionar correctamente en producción. La implementación recomendada es usar **Expo Push Notifications** por su simplicidad y rapidez de implementación.

**Tiempo estimado de implementación**: 2-3 días
**Complejidad**: Media
**Impacto**: Alto (Crítico para retención de usuarios)

---

**Generado por**: Asistente AI  
**Última actualización**: 11 de Octubre, 2025







