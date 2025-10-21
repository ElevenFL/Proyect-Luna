# ⚡ Solución Rápida al Error FCM (5 minutos)

## 🎯 El Problema

```
Error: FIS_AUTH_ERROR
```

**Causa:** Tu `google-services.json` no tiene Cloud Messaging configurado.

---

## ✅ Solución en 5 Pasos

### 📍 Paso 1: Abre Firebase Console

```
https://console.firebase.google.com/project/lunea-f9853
```

### 📍 Paso 2: Habilita Cloud Messaging

1. Click en ⚙️ → **"Project Settings"**
2. Pestaña **"Cloud Messaging"**
3. Si ves "Enable" → **Click en Enable**
4. Espera 1 minuto

### 📍 Paso 3: Descarga el Archivo Actualizado

1. En la misma página, scroll down
2. Sección **"Your apps"**
3. Busca: `com.eleven.lunae` (Android)
4. Click en botón **"google-services.json"**
5. Se descargará el archivo

### 📍 Paso 4: Reemplaza el Archivo

**Windows:**
```bash
# 1. Ve a la carpeta descargada
# 2. Copia el archivo google-services.json
# 3. Pégalo aquí (reemplaza el existente):
Luna\android\app\google-services.json
```

**Ruta completa:**
```
D:\Projectos\Programacion\Proyect-Luna\Luna\android\app\google-services.json
```

### 📍 Paso 5: Recompila la App

```bash
cd Luna\android
gradlew.bat clean
cd ..\..
cd Luna
npx expo run:android
```

---

## ✅ Verificar que Funcionó

Cuando hagas login, deberías ver:

```
✅ Push token obtenido: ExponentPushToken[xxxxx]
✅ Push token registrado en el backend exitosamente
```

---

## 🆘 Si No Tienes Acceso a Firebase

### Opción 1: Pedirle a quien tenga acceso

1. Que vaya a Firebase Console
2. Que descargue el `google-services.json` actualizado
3. Que te lo envíe

### Opción 2: Crear tu propio proyecto Firebase

1. Ve a https://console.firebase.google.com
2. Click en "Add project" / "Crear proyecto"
3. Nombre: `lunea` (o el que prefieras)
4. Habilita Cloud Messaging
5. Añade una app Android:
   - Package name: `com.eleven.lunae`
6. Descarga `google-services.json`
7. Reemplázalo en `Luna/android/app/`

### Opción 3: Probar sin Firebase (Solo Desarrollo)

```bash
# Renombra el archivo temporalmente
cd Luna\android\app
ren google-services.json google-services.json.backup

# Recompila
cd ..\..
npx expo run:android
```

⚠️ **Nota:** Sin Firebase, las push notifications NO funcionarán. Solo para desarrollo.

---

## 📊 Checklist

- [ ] Abrí Firebase Console
- [ ] Habilitado Cloud Messaging
- [ ] Descargado nuevo `google-services.json`
- [ ] Reemplazado archivo en `Luna/android/app/`
- [ ] Ejecutado `gradlew.bat clean`
- [ ] Recompilado con `npx expo run:android`
- [ ] Hice login y vi el token registrado

---

## 🎯 ¿Qué Hace Esto?

Firebase Cloud Messaging (FCM) es el servicio de Google para enviar notificaciones push a Android. 

El error ocurre porque:
1. ✅ Tienes un proyecto Firebase (`lunea-f9853`)
2. ❌ Pero Cloud Messaging no está habilitado
3. ❌ Por eso falla al intentar obtener el push token

**Solución:** Habilitar Cloud Messaging y descargar el archivo actualizado.

---

## 🚀 Alternativa Rápida

Si quieres probar AHORA sin configurar Firebase:

```bash
# En modo desarrollo, usa Expo Go
cd Luna
npx expo start

# Escanea el QR con Expo Go
# Las notificaciones funcionarán en desarrollo
```

⚠️ **Limitación:** Esto solo funciona con Expo Go, no en la app compilada.

---

**¡En 5 minutos tendrás las notificaciones push funcionando! 🎉**







