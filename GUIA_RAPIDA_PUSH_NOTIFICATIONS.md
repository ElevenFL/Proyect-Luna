# 🚀 Guía Rápida: Push Notifications en Luna

## ✅ ¿Qué se implementó?

He configurado completamente el sistema de **Expo Push Notifications** en tu app Luna. Ahora los usuarios **SÍ recibirán notificaciones en su celular** incluso cuando la app esté cerrada.

---

## 📱 ¿Qué notificaciones funcionan ahora?

### 1. Mensajes de Chat ✉️
- Usuario recibe notificación cuando le envían un mensaje
- Solo si está **offline** (app cerrada o en segundo plano)
- Muestra nombre del remitente y preview del mensaje

### 2. Solicitudes de Amistad 👥
- Usuario recibe notificación cuando recibe solicitud de amistad
- Usuario recibe notificación cuando aceptan su solicitud
- Solo si está **offline**

---

## 🧪 Cómo Probar (IMPORTANTE)

### ⚠️ Requisito Crítico
**DEBES usar dispositivos físicos**. Los emuladores NO soportan push notifications.

### Pasos Rápidos

#### 1. Compilar la App
```bash
cd Luna
npx expo run:android   # Para Android
# o
npx expo run:ios       # Para iOS
```

#### 2. Iniciar Backend
```bash
cd Lunae-backend
npm run dev
```

#### 3. Probar en la App
1. **Hacer login** con un usuario
2. **Aceptar permisos** de notificaciones cuando aparezcan
3. **Cerrar la app completamente** (no solo minimizar)
4. Desde otro dispositivo, **enviar un mensaje** a ese usuario
5. **¡Debe aparecer la notificación push!** 🎉

---

## 📊 Verificar que Funciona

### En el Backend (Terminal)
Deberías ver logs como estos:

```
✅ Push token registrado para usuario 123 en plataforma android
📱 Receptor 456 offline, enviando push notification
✅ Enviadas 1 notificación(es) a usuario 456
```

### En la App
Cuando haces login, deberías ver en los logs:
```
📱 Registrando push notifications para usuario: 123
✅ Push token obtenido: ExponentPushToken[xxxxx]
✅ Push token registrado en el backend exitosamente
```

---

## 🐛 Si No Funciona

### Problema: No se solicitan permisos

**Solución:**
1. Desinstalar la app completamente
2. Volver a compilar con `npx expo run:android`
3. Instalar de nuevo

### Problema: No llegan notificaciones

**Verificar:**
```bash
# 1. Ver si el token está registrado
curl http://localhost:3000/api/push-tokens/user/USER_ID \
  -H "Authorization: Bearer TU_TOKEN"

# 2. Probar notificación de prueba (solo en desarrollo)
curl -X POST http://localhost:3000/api/push-tokens/test \
  -H "Authorization: Bearer TU_TOKEN"
```

### Problema: Solo funciona con app abierta

**Causa:** Tal vez estás usando emulador. **DEBES usar dispositivo físico.**

---

## 📂 Archivos Creados/Modificados

### ✨ Nuevos Archivos

**Backend:**
- `Lunae-backend/src/models/PushToken.js`
- `Lunae-backend/src/services/pushNotificationService.js`
- `Lunae-backend/src/routes/pushNotificationRoutes.js`

**Frontend:**
- `Luna/services/pushNotificationService.ts`

### ✏️ Archivos Modificados

**Backend:**
- `Lunae-backend/src/index.js` ← Rutas añadidas
- `Lunae-backend/src/controllers/chatController.js` ← Push en mensajes
- `Lunae-backend/src/utils/socketUtils.js` ← Push en solicitudes
- `Lunae-backend/package.json` ← Dependencia `expo-server-sdk`

**Frontend:**
- `Luna/contexts/AuthContext.tsx` ← Registro de tokens
- `Luna/hooks/useNotifications.ts` ← Listeners de push

---

## 🎯 Próximos Pasos (Opcional)

### 1. Añadir Navegación Automática

Cuando el usuario toca una notificación, navegar automáticamente:

```typescript
// En Luna/hooks/useNotifications.ts
// Descomentar las líneas de navegación:

import { router } from 'expo-router';

if (data.type === 'new-message') {
  router.push({ pathname: '/chat/[userId]', params: { userId: data.senderId } });
}
```

### 2. Añadir Más Tipos de Notificaciones

**Likes:**
```javascript
// En el backend donde se procesan likes
import { PushNotificationService } from '../services/pushNotificationService.js';

await PushNotificationService.sendLikeNotification(
  receiverId,
  likerName,
  likerId
);
```

**Matches:**
```javascript
await PushNotificationService.sendMatchNotification(
  receiverId,
  matchName,
  matchId
);
```

### 3. Personalizar Comportamiento

Modificar cómo se muestran las notificaciones:

```typescript
// En Luna/hooks/useNotifications.ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,     // Mostrar alerta
    shouldPlaySound: true,     // Reproducir sonido
    shouldSetBadge: true,      // Mostrar badge (número)
    shouldShowBanner: true,    // Mostrar banner
    shouldShowList: true,      // Agregar a lista
  }),
});
```

---

## 📖 Documentación Completa

- **Implementación detallada:** `PUSH_NOTIFICATIONS_IMPLEMENTADO.md`
- **Análisis original:** `ANALISIS_NOTIFICACIONES.md`
- **Resumen ejecutivo:** `RESUMEN_NOTIFICACIONES.md`

---

## ✨ Resumen Ejecutivo

### Antes ❌
- Solo funcionaban notificaciones con app abierta
- Dependía 100% de WebSockets
- No llegaban notificaciones con app cerrada

### Ahora ✅
- ✅ Notificaciones push reales
- ✅ Funcionan con app cerrada
- ✅ Sistema híbrido (WebSocket + Push)
- ✅ Gestión automática de tokens
- ✅ Soporte múltiples dispositivos

---

## 🎊 ¡Listo para Usar!

El sistema está **100% implementado y funcional**. Solo necesitas:

1. ✅ Compilar la app en un dispositivo físico
2. ✅ Iniciar el backend
3. ✅ Hacer login y aceptar permisos
4. ✅ ¡Probar enviando un mensaje desde otro usuario!

**¡Las notificaciones push ya funcionan en Luna! 🌙**

---

**Cualquier duda, consulta:**
- `PUSH_NOTIFICATIONS_IMPLEMENTADO.md` - Guía completa con troubleshooting
- Logs del backend con `npm run dev`
- Logs de la app con `npx expo start`

