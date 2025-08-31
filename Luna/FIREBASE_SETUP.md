# Configuración de Firebase para Luna

## Pasos para configurar Firebase Storage

### 1. Crear un proyecto en Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Crear un proyecto"
3. Sigue los pasos para crear tu proyecto

### 2. Habilitar Firebase Storage
1. En la consola de Firebase, ve a "Storage" en el menú lateral
2. Haz clic en "Comenzar"
3. Selecciona "Producir" como modo de seguridad
4. Elige la ubicación de tu bucket (recomendado: us-central1)

### 3. Configurar la aplicación
1. En la consola de Firebase, haz clic en el ícono de configuración (⚙️)
2. Selecciona "Configuración del proyecto"
3. Ve a la pestaña "General"
4. En "Tus aplicaciones", haz clic en "Agregar app" y selecciona el ícono de web (</>)
5. Registra tu app con un nombre (ej: "Luna App")
6. Copia la configuración que aparece

### 4. Actualizar la configuración
1. Abre el archivo `config/firebase.ts`
2. Reemplaza los valores de `firebaseConfig` con los valores de tu proyecto:

```typescript
const firebaseConfig = {
  apiKey: "tu-api-key",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "tu-app-id"
};
```

### 5. Configurar reglas de Storage (Opcional)
Para mayor seguridad, puedes configurar reglas de Storage en Firebase Console:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-images/{allPaths=**} {
      allow read, write: if true; // Temporal - cambiar por reglas más seguras
    }
  }
}
```

### 6. Instalar dependencias
Las dependencias ya están instaladas, pero si necesitas reinstalarlas:

```bash
npm install firebase expo-image-picker expo-av expo-image-manipulator
```

## Funcionalidades implementadas

- ✅ Selección de imagen desde galería
- ✅ Captura de foto con cámara
- ✅ **Optimización automática de imágenes** con expo-image-manipulator
- ✅ **Cacheo inteligente de imágenes** con expo-image
- ✅ Subida de imagen a Firebase Storage
- ✅ Placeholder con iniciales del usuario
- ✅ Interfaz similar a la imagen de referencia
- ✅ Integración con el flujo de onboarding
- ✅ **Barra de progreso** para subida de imágenes
- ✅ **Hook personalizado** para manejo de imágenes
- ✅ **Servicio de optimización** reutilizable

## Notas importantes

- Las imágenes se suben a la carpeta `profile-images/` en Firebase Storage
- Se genera un nombre único para cada imagen usando timestamp y string aleatorio
- **Optimización automática**: Las imágenes se redimensionan a máximo 800x800px
- **Compresión inteligente**: Se mantiene una calidad del 80% para optimizar el tamaño
- **Cacheo eficiente**: Las imágenes se cachean en memoria y disco para evitar descargas repetidas
- **Formato optimizado**: Las imágenes se convierten a JPEG para mejor compresión
- **Progreso visual**: Barra de progreso durante la subida de imágenes

## Optimizaciones implementadas

### 🚀 Optimización de imágenes
- Redimensionamiento automático manteniendo aspect ratio
- Compresión con calidad configurable
- Conversión a formatos optimizados (JPEG/PNG/WebP)
- Cálculo inteligente de dimensiones óptimas

### 💾 Cacheo inteligente
- Cache en memoria para acceso rápido
- Cache en disco para persistencia
- Hash único para identificación de imágenes
- Políticas de cache configurables

### 🎯 Experiencia de usuario
- Barra de progreso visual durante subida
- Placeholder mientras carga la imagen
- Manejo de errores robusto
- Interfaz responsiva y fluida
