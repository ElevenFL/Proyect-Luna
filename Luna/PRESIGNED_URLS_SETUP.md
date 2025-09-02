# Sistema de Presigned URLs - Proyecto Luna

## ¿Qué son las Presigned URLs?

Las presigned URLs son URLs temporales que permiten subir o descargar archivos directamente desde S3 sin pasar por el backend, manteniendo la seguridad mediante permisos temporales.

## Arquitectura del Sistema

### Backend (Node.js)
- ✅ Genera URLs firmadas para subida y descarga
- ✅ Usa credenciales IAM seguras del servidor
- ✅ Valida autenticación del usuario
- ✅ No maneja archivos directamente

### Frontend (React Native)
- ✅ Obtiene URL firmada del backend
- ✅ Sube/descarga archivos directamente a S3
- ✅ Optimiza imágenes antes de la subida
- ✅ Maneja errores y progreso de subida

## Flujo de Subida de Imágenes

```
1. Usuario selecciona imagen
2. Frontend optimiza imagen
3. Frontend solicita URL firmada al backend
4. Backend genera URL firmada (válida por 15 min)
5. Frontend sube imagen directamente a S3
6. Frontend construye URL pública de la imagen
```

## Configuración del Backend

### Variables de Entorno
```bash
# .env
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
S3_BUCKET_NAME=eleven-lunea-storage
```

### Permisos IAM Requeridos
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::eleven-lunea-storage",
        "arn:aws:s3:::eleven-lunea-storage/*"
      ]
    }
  ]
}
```

### Política CORS del Bucket S3
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Endpoints del Backend

### Generar URL de Subida
```
POST /api/images/upload-url
Authorization: Bearer <token>
Body: {
  "fileName": "imagen.jpg",
  "contentType": "image/jpeg",
  "folder": "profile-images"
}
```

### Generar URL de Descarga
```
GET /api/images/download-url/:key
Authorization: Bearer <token>
```

### Eliminar Imagen
```
DELETE /api/images/:key
Authorization: Bearer <token>
```

### Listar Imágenes
```
GET /api/images/list?folder=profile-images
Authorization: Bearer <token>
```

## Configuración del Frontend

### ImageService
- ✅ `getUploadUrl()`: Obtiene URL firmada para subida
- ✅ `uploadOptimizedImage()`: Sube imagen usando presigned URL
- ✅ `deleteImage()`: Elimina imagen del bucket
- ✅ `listImages()`: Lista imágenes en una carpeta

### useProfileImage Hook
- ✅ Maneja selección de imágenes (cámara/galería)
- ✅ Optimiza imágenes antes de subida
- ✅ Muestra progreso de subida
- ✅ Maneja errores de autenticación

## Ventajas del Sistema

### Seguridad
- 🔒 Credenciales AWS solo en el backend
- 🔒 URLs temporales con expiración
- 🔒 Validación de autenticación en cada operación

### Rendimiento
- ⚡ Subida directa a S3 (sin proxy)
- ⚡ Menor carga en el backend
- ⚡ Mejor escalabilidad

### Costos
- 💰 Menor uso de ancho de banda del backend
- 💰 Menor uso de CPU del servidor
- 💰 Solo pago por almacenamiento S3

## Troubleshooting

### Error: "Token de autenticación no disponible"
- Verifica que el usuario esté autenticado
- Confirma que el token se esté pasando correctamente

### Error: "Error obteniendo URL de subida"
- Verifica que el backend esté funcionando
- Confirma que las credenciales AWS sean válidas
- Revisa los logs del backend

### Error: "Error subiendo a S3"
- Verifica que la URL firmada no haya expirado
- Confirma que el bucket S3 sea accesible
- Revisa la política CORS del bucket

### Error: "Access Denied" en S3
- Verifica los permisos IAM del usuario
- Confirma que la política del bucket permita las operaciones
- Revisa que la región sea correcta

## Comandos de Prueba

### Backend
```bash
cd Lunae-backend
npm run dev
```

### Frontend
```bash
cd Luna
npm start
```

### Probar Endpoints
```bash
# Obtener URL de subida
curl -X POST http://localhost:3000/api/images/upload-url \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","contentType":"image/jpeg"}'
```

## Próximos Pasos

1. ✅ Implementar sistema de presigned URLs
2. 🔄 Agregar validación de tipos de archivo
3. 🔄 Implementar límites de tamaño de archivo
4. 🔄 Agregar compresión automática de imágenes
5. 🔄 Implementar cache de URLs firmadas
6. 🔄 Agregar métricas de uso de S3
