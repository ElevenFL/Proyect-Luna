# 📱 Resumen: Sistema de Notificaciones Luna

## ⚠️ Problema Principal

**Las notificaciones NO llegan al celular cuando la app está cerrada.**

### ¿Qué funciona? ✅
- Notificaciones cuando la app está abierta (in-app)
- Notificaciones cuando la app está en segundo plano (local)
- WebSockets para comunicación en tiempo real

### ¿Qué NO funciona? ❌
- ❌ **Notificaciones push reales** (cuando la app está cerrada)
- ❌ **Notificaciones cuando el celular está bloqueado**
- ❌ **No hay registro de tokens de dispositivos**
- ❌ **No hay servicio de push configurado**

---

## 🔍 Causa Raíz

El sistema actual solo usa:
1. **WebSockets** - Solo funcionan si la app está abierta y conectada
2. **Notificaciones Locales** - Se generan desde el propio dispositivo, no desde el servidor

**Falta**: Integración con un servicio de **Push Notifications** real (Expo Push o Firebase)

---

## 💡 Solución Rápida (Recomendada)

### Usar **Expo Push Notifications**

**Por qué:**
- ✅ Gratis hasta 1M notificaciones/mes
- ✅ Fácil de implementar (2-3 días)
- ✅ Soporta iOS y Android automáticamente
- ✅ No requiere configuración compleja

### Pasos de Implementación:

#### 1. Frontend (Luna) 📱

**Crear servicio de Push Tokens**:
```bash
cd Luna
# Crear archivo: services/pushNotificationService.ts
```

**Registrar token al hacer login** (en `AuthContext.tsx`):
```typescript
await PushNotificationService.registerForPushNotifications(user.id);
```

#### 2. Backend (Lunae-backend) 🖥️

**Instalar dependencia**:
```bash
cd Lunae-backend
npm install expo-server-sdk
```

**Crear 3 archivos nuevos**:
1. `src/models/PushToken.js` - Para guardar tokens de dispositivos
2. `src/services/pushNotificationService.js` - Para enviar notificaciones
3. `src/routes/pushNotificationRoutes.js` - Endpoints para registrar tokens

**Modificar archivos existentes**:
- `src/controllers/chatController.js` - Enviar push si usuario offline
- `src/utils/socketUtils.js` - Enviar push en solicitudes de amistad

#### 3. Base de Datos 💾

**Añadir estructura para tokens**:
```javascript
{
  PK: "USER#userId",
  SK: "PUSHTOKEN#token",
  pushToken: "ExponentPushToken[xxx]",
  platform: "android" | "ios",
  isActive: true,
  createdAt: "2025-10-11T..."
}
```

---

## 📝 Código Clave

### Frontend: Registrar Token

```typescript
// services/pushNotificationService.ts
import * as Notifications from 'expo-notifications';

export class PushNotificationService {
  static async registerForPushNotifications(userId: string) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '14e249c5-a3bb-4284-94ad-8d6d6b0d04f3'
    });

    await ApiService.post('/push-tokens/register', {
      userId,
      pushToken: tokenData.data,
      platform: Platform.OS,
    });

    return tokenData.data;
  }
}
```

### Backend: Enviar Notificación

```javascript
// src/services/pushNotificationService.js
import { Expo } from 'expo-server-sdk';

export class PushNotificationService {
  static async sendNotification(userId, title, body, data) {
    const tokens = await PushToken.getTokensByUserId(userId);
    
    const messages = tokens.map(t => ({
      to: t.pushToken,
      sound: 'default',
      title,
      body,
      data
    }));

    const chunks = expo.chunkPushNotifications(messages);
    
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  }
}
```

### Backend: Enviar cuando Usuario Offline

```javascript
// En chatController.js, después de enviar mensaje
const receiverOnline = Array.from(io.sockets.sockets.values())
  .some(socket => socket.userId === String(receiverId));

if (!receiverOnline) {
  await PushNotificationService.sendNewMessageNotification(
    receiverId,
    senderName,
    content
  );
}
```

---

## 🧪 Cómo Probar

1. **Instalar app en dispositivo físico** (no emulador)
2. **Hacer login**
3. **Cerrar la app completamente**
4. **Enviar mensaje desde otro usuario**
5. **Verificar que llegue notificación push**

### Comandos de Debug:

```bash
# Ver logs de notificaciones en backend
npm run dev | grep "📱"

# Probar token registrado
curl http://localhost:3000/api/push-tokens/user/123
```

---

## ⏱️ Tiempo de Implementación

- **Frontend**: 4-6 horas
- **Backend**: 6-8 horas
- **Testing**: 2-3 horas
- **Total**: 2-3 días

---

## 🚦 Estado por Tipo de Notificación

| Tipo | WebSocket | Push | Estado |
|------|-----------|------|--------|
| **Mensajes de chat** | ✅ Funciona | ❌ Falta | 50% |
| **Solicitudes de amistad** | ✅ Funciona | ❌ Falta | 50% |
| **Likes** | ❌ No implementado | ❌ Falta | 0% |
| **Matches** | ❌ No implementado | ❌ Falta | 0% |
| **Visitas de perfil** | ❌ No implementado | ❌ Falta | 0% |

---

## 📌 Archivos a Crear/Modificar

### ✨ Nuevos (Frontend)
- [ ] `Luna/services/pushNotificationService.ts`

### 📝 Modificar (Frontend)
- [ ] `Luna/contexts/AuthContext.tsx` - Línea ~150 (después de login)
- [ ] `Luna/hooks/useNotifications.ts` - Añadir listener de push

### ✨ Nuevos (Backend)
- [ ] `Lunae-backend/src/models/PushToken.js`
- [ ] `Lunae-backend/src/services/pushNotificationService.js`
- [ ] `Lunae-backend/src/routes/pushNotificationRoutes.js`

### 📝 Modificar (Backend)
- [ ] `Lunae-backend/src/controllers/chatController.js` - Línea ~150
- [ ] `Lunae-backend/src/utils/socketUtils.js` - Línea ~60
- [ ] `Lunae-backend/src/index.js` - Añadir rutas de push
- [ ] `Lunae-backend/package.json` - Añadir `expo-server-sdk`

---

## 🎯 Próximos Pasos

1. **Leer el análisis completo**: `ANALISIS_NOTIFICACIONES.md`
2. **Instalar `expo-server-sdk`** en el backend
3. **Crear archivos nuevos** según la lista
4. **Modificar archivos existentes** con lógica de push
5. **Probar en dispositivo físico**
6. **Ajustar según resultados**

---

## ❓ FAQ

**P: ¿Por qué no funcionan las notificaciones ahora?**  
R: Porque solo usan WebSockets y notificaciones locales, que no funcionan cuando la app está cerrada.

**P: ¿Necesito Firebase?**  
R: No es necesario. Expo Push Notifications es suficiente y más fácil de configurar.

**P: ¿Funciona en iOS y Android?**  
R: Sí, Expo Push Notifications funciona en ambos automáticamente.

**P: ¿Cuánto cuesta?**  
R: Gratis hasta 1 millón de notificaciones por mes con Expo.

**P: ¿Se pueden probar en emulador?**  
R: No, las push notifications solo funcionan en dispositivos físicos.

---

**📚 Ver análisis completo**: `ANALISIS_NOTIFICACIONES.md`







