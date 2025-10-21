# 🔧 Solución al Error FIS_AUTH_ERROR

## ❌ Error Actual

```
Error: Fetching the token failed: java.util.concurrent.ExecutionException: 
java.io.IOException: FIS_AUTH_ERROR
```

## 🔍 Causa del Problema

Tu archivo `google-services.json` está **incompleto**. Le falta la configuración de **Firebase Cloud Messaging (FCM)**, específicamente:
- ❌ `gcm_sender_id`
- ❌ Configuración de Cloud Messaging API

## ✅ Solución Rápida (5 minutos)

### Paso 1: Ve a Firebase Console

Abre: https://console.firebase.google.com/project/lunea-f9853

### Paso 2: Habilitar Cloud Messaging

1. Click en el engranaje ⚙️ (arriba izquierda)
2. Click en **"Project Settings"** (Configuración del proyecto)
3. Ve a la pestaña **"Cloud Messaging"**
4. Verás algo como:

```
Cloud Messaging API (Legacy)
Server key: AIza...
Sender ID: 305090861402
```

5. Si está deshabilitado, click en **"Enable"**

### Paso 3: Descargar Nuevo google-services.json

1. En la misma página de "Project Settings"
2. Scroll down hasta **"Your apps"** (Tus aplicaciones)
3. Encuentra la app Android: `com.eleven.lunae`
4. Click en el botón **"google-services.json"** para descargarlo
5. **Reemplaza** el archivo en:
   ```
   Luna/android/app/google-services.json
   ```

### Paso 4: Verificar el Nuevo Archivo

El nuevo `google-services.json` debe tener esta estructura:

```json
{
  "project_info": {
    "project_number": "305090861402",
    "firebase_url": "https://lunea-f9853.firebaseio.com",
    "project_id": "lunea-f9853",
    "storage_bucket": "lunea-f9853.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:305090861402:android:...",
        "android_client_info": {
          "package_name": "com.eleven.lunae"
        }
      },
      "oauth_client": [],
      "api_key": [
        {
          "current_key": "AIza..."
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": []
        }
      },
      "admob_app_id": "...", // Puede estar vacío
      "analytics_service": {
        "status": 1
      }
    }
  ],
  "configuration_version": "1"
}
```

**Importante:** Debe tener más contenido que el actual.

### Paso 5: Limpiar y Recompilar

```bash
# 1. Ir a la carpeta de Android
cd Luna/android

# 2. Limpiar build anterior
./gradlew clean

# 3. Volver a la raíz
cd ..

# 4. Recompilar la app
npx expo run:android
```

### Paso 6: Probar

1. La app se instalará en tu dispositivo
2. Hacer login
3. Aceptar permisos de notificaciones
4. Deberías ver en los logs:
   ```
   ✅ Push token obtenido: ExponentPushToken[xxxxx]
   ✅ Push token registrado en el backend exitosamente
   ```

---

## 🚀 Alternativa: Usar Expo Managed Workflow (Más Simple)

Si no quieres lidiar con Firebase ahora, puedes usar el build de Expo que maneja todo automáticamente:

### Opción A: EAS Build (Recomendado)

```bash
# 1. Instalar EAS CLI
npm install -g eas-cli

# 2. Login a Expo
eas login

# 3. Build de desarrollo
eas build --profile development --platform android

# 4. Instalar el APK generado en tu dispositivo
```

EAS Build configurará Firebase automáticamente.

### Opción B: Eliminar google-services.json Temporalmente

Si solo quieres probar en desarrollo:

```bash
# 1. Renombrar el archivo
cd Luna/android/app
mv google-services.json google-services.json.backup

# 2. Recompilar
cd ../..
npx expo run:android
```

**Nota:** Sin `google-services.json`, las notificaciones push **NO funcionarán en producción**, solo en desarrollo con Expo Go.

---

## 🔄 Si el Error Persiste

### Verificar que FCM esté habilitado

En Firebase Console:
1. **Cloud Messaging API (Legacy)** debe estar habilitado
2. Si dice "Enable", haz click para habilitarlo
3. Espera 5-10 minutos para que se propague

### Verificar Package Name

En `Luna/android/app/build.gradle`:

```gradle
applicationId "com.eleven.lunae"  // ← Debe coincidir con Firebase
```

Y en Firebase Console:
- La app Android debe tener el package name: `com.eleven.lunae`

Si no coincide:
1. Ve a Firebase Console → Project Settings → Your apps
2. Añade una nueva app Android con el package name correcto
3. Descarga el nuevo `google-services.json`

### Sincronizar Credenciales con Expo

```bash
# Subir credenciales FCM a Expo
cd Luna
npx expo credentials:manager

# Seleccionar:
# 1. Android
# 2. Push Notification credentials
# 3. Upload google-services.json
# 4. Seleccionar: Luna/android/app/google-services.json
```

---

## 📊 Verificar que Todo Funciona

### En el Backend

Cuando el usuario hace login, deberías ver:

```bash
✅ Push token registrado para usuario 123 en plataforma android
```

### En la App

En los logs de la app (Metro):

```bash
📱 Registrando push notifications para usuario: 123
✅ Push token obtenido: ExponentPushToken[xxxxxxxxxxxxxx]
✅ Push token registrado en el backend exitosamente
AuthContext: Push token registrado exitosamente
```

### Prueba Final

```bash
# 1. Login en la app
# 2. Cerrar la app completamente
# 3. Desde otro dispositivo, enviar un mensaje
# 4. ¡Debe llegar la notificación push!
```

---

## 🎯 Resumen de Pasos (TL;DR)

1. ✅ Ve a Firebase Console: https://console.firebase.google.com/project/lunea-f9853
2. ✅ Habilita Cloud Messaging en Project Settings
3. ✅ Descarga el nuevo `google-services.json`
4. ✅ Reemplaza el archivo en `Luna/android/app/google-services.json`
5. ✅ Ejecuta: `cd Luna/android && ./gradlew clean && cd .. && npx expo run:android`
6. ✅ Prueba hacer login y verificar que se registre el push token

---

## 📞 Si Necesitas Ayuda

Si después de seguir estos pasos el error persiste:

1. Verifica los logs de Metro para ver errores específicos
2. Verifica los logs del backend para ver si llega el registro
3. Comprueba que FCM esté habilitado en Firebase Console
4. Asegúrate de que el package name coincida

**El archivo `google-services.json` debe ser descargado DESPUÉS de habilitar Cloud Messaging.**

---

## ✨ ¿Por Qué Este Error?

Firebase Installation Service (FIS) necesita:
1. Cloud Messaging API habilitado
2. Credenciales válidas en `google-services.json`
3. Package name correcto

Si falta alguno, falla con `FIS_AUTH_ERROR`.

---

**¡Sigue estos pasos y las notificaciones push funcionarán! 🚀**







