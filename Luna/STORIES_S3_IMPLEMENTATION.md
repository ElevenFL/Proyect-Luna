# Implementación de Subida de Imágenes de Historias a S3

## ✅ Cambios Implementados

### 1. Configuración de API (Frontend)
- **Archivo**: `config/api.ts`
- **Cambio**: Agregada carpeta `STORIES: 'story-images'` en `API_CONFIG.IMAGE.FOLDERS`

### 2. Pantalla de Crear Historia
- **Archivo**: `app/create-story.tsx`
- **Cambios**:
  - Importado `ImageService` y `API_CONFIG`
  - Modificada función `publishStory()` para subir imágenes a S3 antes de crear la historia
  - Agregado manejo de errores específicos para problemas de subida de imágenes
  - Configuración optimizada para formato vertical de historias (800x1200px)

### 3. Contexto de Historias
- **Archivo**: `contexts/StoriesContext.tsx`
- **Cambios**:
  - Agregados logs detallados para debugging
  - Verificación de URLs de imágenes (deben empezar con 'http')
  - Mejor manejo de errores

## 🔄 Flujo de Subida de Imágenes

1. **Usuario selecciona imagen** → URI local almacenada
2. **Usuario presiona "Publicar"** → Se inicia el proceso de subida
3. **Imagen se optimiza** → Redimensionada a 800x1200px, calidad 80%
4. **Se obtiene URL presignada** → Del backend para subir a S3
5. **Imagen se sube a S3** → Directamente al bucket en carpeta `story-images/`
6. **Se obtiene URL pública** → URL de S3 para acceder a la imagen
7. **Se crea la historia** → Con la URL de S3 en lugar de URI local

## 📁 Estructura en S3

```
bucket-name/
├── profile-images/
├── post-images/
├── message-images/
└── story-images/          ← Nueva carpeta
    ├── 1703123456789-abc123def.jpg
    ├── 1703123456790-xyz789ghi.jpg
    └── ...
```

## 🛠️ Configuración Técnica

### Optimización de Imágenes para Historias
- **Dimensiones máximas**: 800x1200px (formato vertical)
- **Calidad**: 80%
- **Formato**: JPEG
- **Tamaño máximo**: 5MB

### Manejo de Errores
- **Imagen muy grande**: "La imagen es demasiado grande. Por favor, selecciona una imagen más pequeña."
- **Formato no soportado**: "Formato de imagen no soportado. Usa JPEG, PNG o WebP."
- **Error de subida**: "Error al subir la imagen. Por favor, inténtalo de nuevo."

## 🔍 Verificación

Para verificar que funciona correctamente:

1. **Crear una historia con imagen**
2. **Verificar en logs**:
   ```
   Subiendo imagen a S3...
   Imagen subida exitosamente: https://bucket.s3.region.amazonaws.com/story-images/...
   Creando story con contenido: { type: 'image', isImageUrl: true }
   ✅ Story agregado exitosamente
   ```
3. **Verificar en S3**: La imagen debe aparecer en la carpeta `story-images/`
4. **Verificar en la app**: La historia debe mostrar la imagen desde S3

## 🚀 Beneficios

- ✅ **Almacenamiento escalable**: Imágenes en S3 en lugar de almacenamiento local
- ✅ **Optimización automática**: Imágenes redimensionadas y comprimidas
- ✅ **URLs públicas**: Acceso directo a las imágenes desde cualquier dispositivo
- ✅ **Gestión de errores**: Mensajes claros para el usuario
- ✅ **Logs detallados**: Facilita el debugging y monitoreo









