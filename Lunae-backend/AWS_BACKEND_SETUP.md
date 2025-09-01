# Configuración AWS Backend - Lunae

## 🚀 Backend Configurado para AWS

Tu backend ha sido configurado exitosamente para trabajar con AWS S3 y integrarse con el frontend que usa Amplify v6.

### ✅ Cambios Realizados

1. **Dependencias AWS instaladas:**
   - ✅ `@aws-sdk/client-s3` - Cliente S3 oficial de AWS
   - ✅ `@aws-sdk/s3-request-presigner` - Para URLs firmadas
   - ✅ `multer` y `multer-s3` - Para manejo de archivos

2. **Configuración AWS:**
   - ✅ `src/config/aws.js` - Configuración del cliente S3
   - ✅ Funciones para subir, descargar y eliminar archivos
   - ✅ Generación de URLs firmadas

3. **Nuevos endpoints:**
   - ✅ `GET /api/images/test-connection` - Probar conexión S3
   - ✅ `POST /api/images/profile/upload-url` - Obtener URL de subida
   - ✅ `PUT /api/images/profile/update-url` - Actualizar URL en DB
   - ✅ `DELETE /api/images/profile/delete` - Eliminar imagen
   - ✅ `GET /api/images/download/:key` - Obtener URL de descarga

4. **Modelo actualizado:**
   - ✅ Campos `profileImage` y `profileImageKey` agregados al modelo User

## 📋 Configuración Requerida

### 1. Variables de Entorno

Crea un archivo `.env` en la carpeta `Lunae-backend` con:

```env
# Configuración del servidor
PORT=3000

# Base de datos MongoDB
DB_URL=mongodb://localhost:27017/lunae

# JWT Secret
JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion

# Configuración AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key_aqui
AWS_SECRET_ACCESS_KEY=tu_secret_key_aqui
AWS_S3_BUCKET=luna-storage-bucket
```

### 2. Configurar Credenciales AWS

#### Opción A: AWS CLI
```bash
aws configure
```

#### Opción B: Variables de entorno
```bash
export AWS_ACCESS_KEY_ID=tu_access_key
export AWS_SECRET_ACCESS_KEY=tu_secret_key
export AWS_REGION=us-east-1
```

### 3. Crear Bucket S3

```bash
# Crear bucket S3
aws s3 mb s3://luna-storage-bucket --region us-east-1

# Configurar CORS (opcional, para acceso web)
aws s3api put-bucket-cors --bucket luna-storage-bucket --cors-configuration file://cors-config.json
```

## 🔧 API Endpoints

### Probar Conexión
```http
GET /api/images/test-connection
```

### Obtener URL de Subida
```http
POST /api/images/profile/upload-url
Authorization: Bearer <token>
Content-Type: application/json

{
  "contentType": "image/jpeg"
}
```

### Actualizar URL de Imagen
```http
PUT /api/images/profile/update-url
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageUrl": "https://bucket.s3.region.amazonaws.com/path/to/image.jpg",
  "imageKey": "profile-images/userId/timestamp-random.jpg"
}
```

### Eliminar Imagen
```http
DELETE /api/images/profile/delete
Authorization: Bearer <token>
```

### Obtener URL de Descarga
```http
GET /api/images/download/:key
Authorization: Bearer <token>
```

## 🔄 Flujo de Trabajo

### 1. Subir Imagen de Perfil
```javascript
// 1. Obtener URL de subida del backend
const response = await fetch('/api/images/profile/upload-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ contentType: 'image/jpeg' })
});

const { uploadUrl, key } = await response.json();

// 2. Subir imagen directamente a S3
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  body: imageFile,
  headers: { 'Content-Type': 'image/jpeg' }
});

// 3. Actualizar URL en la base de datos
await fetch('/api/images/profile/update-url', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ 
    imageUrl: `https://bucket.s3.region.amazonaws.com/${key}`,
    imageKey: key 
  })
});
```

## 🔐 Permisos IAM Requeridos

### Política IAM para el usuario/rol:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::luna-storage-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::luna-storage-bucket"
    }
  ]
}
```

## 🧪 Pruebas

### 1. Probar conexión:
```bash
curl http://localhost:3000/api/images/test-connection
```

### 2. Probar autenticación:
```bash
# Primero hacer login
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"test@example.com","password":"password123"}'

# Usar el token en las siguientes peticiones
curl -X POST http://localhost:3000/api/images/profile/upload-url \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg"}'
```

## 📝 Notas Importantes

1. **Seguridad:** Las URLs firmadas expiran en 1 hora por defecto
2. **Organización:** Las imágenes se organizan por usuario: `profile-images/{userId}/{filename}`
3. **Limpieza:** El backend maneja la eliminación de archivos huérfanos
4. **Compatibilidad:** Funciona perfectamente con el frontend Amplify v6

## 🚨 Próximos Pasos

1. ✅ Configurar variables de entorno
2. ✅ Configurar credenciales AWS
3. ✅ Crear bucket S3
4. ✅ Probar endpoints
5. ✅ Integrar con frontend

¿Necesitas ayuda con algún paso específico?
