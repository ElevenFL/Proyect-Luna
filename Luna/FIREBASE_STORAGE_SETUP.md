# Configuración de Firebase Storage

## Pasos para habilitar Firebase Storage

### 1. Habilitar Firebase Storage en la consola
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `lunea-f9853`
3. En el menú lateral, haz clic en **Storage**
4. Haz clic en **Get started**
5. Selecciona **Start in test mode** (para desarrollo)
6. Elige una ubicación para tu bucket (recomendado: `us-central1`)

### 2. Configurar reglas de seguridad (para desarrollo)
En la pestaña **Rules** de Storage, usa estas reglas temporales:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true; // Solo para desarrollo
    }
  }
}
```

**⚠️ IMPORTANTE:** Estas reglas permiten acceso completo. Para producción, debes implementar reglas de seguridad apropiadas.

### 3. Verificar configuración
- El archivo `google-services.json` debe estar en `Luna/android/app/`
- La configuración en `Luna/config/firebase.ts` debe usar los valores correctos
- Firebase Storage debe estar habilitado en la consola

### 4. Reglas de seguridad para producción
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Permitir subida de imágenes de perfil solo a usuarios autenticados
    match /profile-images/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Permitir lectura pública de imágenes de perfil
    match /profile-images/{allPaths=**} {
      allow read: if true;
    }
  }
}
```

## Solución de problemas

### Error: "Firebase Storage: An unknown error occurred"
1. Verifica que Firebase Storage esté habilitado en la consola
2. Confirma que las reglas de seguridad permitan la operación
3. Verifica que el archivo `google-services.json` esté en la ubicación correcta
4. Asegúrate de que la configuración de Firebase sea correcta

### Error: "Permission denied"
- Las reglas de seguridad están bloqueando la operación
- Verifica las reglas en la consola de Firebase
- Para desarrollo, usa las reglas temporales mencionadas arriba

### Error: "Bucket not found"
- Firebase Storage no está habilitado para tu proyecto
- Sigue los pasos 1-2 para habilitarlo
