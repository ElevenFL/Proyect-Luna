# Configuración de AWS Amplify v6 - Luna

## 🚀 Migración Completada

Tu proyecto ha sido migrado exitosamente de Firebase a **AWS Amplify v6.15.5**. Los siguientes cambios se han realizado:

### ✅ Cambios Realizados

1. **Dependencias actualizadas:**
   - ✅ Instalado `aws-amplify` y `@aws-amplify/react-native`
   - ✅ Removido `firebase` (se puede desinstalar después de verificar que todo funciona)

2. **Configuración de Amplify:**
   - ✅ Creado `config/amplify.ts` con configuración base
   - ✅ Inicializado Amplify en `app/_layout.tsx`

3. **Servicios migrados:**
   - ✅ `ImageService` migrado de Firebase Storage a AWS S3
   - ✅ Mantenida la funcionalidad de optimización de imágenes
   - ✅ Conservada la API existente para compatibilidad

## 📋 Configuración Requerida

### 1. Crear recursos en AWS

#### S3 Bucket para Storage
```bash
# Crear bucket S3
aws s3 mb s3://luna-storage-bucket --region us-east-1

# Configurar CORS (opcional, para acceso web)
aws s3api put-bucket-cors --bucket luna-storage-bucket --cors-configuration file://cors-config.json
```

#### Cognito User Pool (opcional, si quieres usar Amplify Auth)
```bash
# Crear User Pool
aws cognito-idp create-user-pool --pool-name luna-user-pool --region us-east-1
```

### 2. Actualizar configuración

Edita `config/amplify.ts` con tus valores reales:

```typescript
const amplifyConfig = {
  Storage: {
    S3: {
      bucket: 'tu-bucket-real', // Cambiar por tu bucket
      region: 'us-east-1', // Cambiar por tu región
    },
  },
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_XXXXXXXXX', // Tu User Pool ID
      userPoolClientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxx', // Tu App Client ID
      region: 'us-east-1', // Tu región
    },
  },
};
```

### 3. Configurar credenciales AWS

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

#### Opción C: IAM Roles (recomendado para producción)
Configura roles IAM con los permisos necesarios.

## 🔧 Permisos IAM Requeridos

### Para S3 Storage:
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
      "Resource": "arn:aws:s3:::tu-bucket/*"
    }
  ]
}
```

## 🧪 Pruebas

### Probar conexión con S3:
```typescript
import { ImageService } from './services/imageService';

// Probar conexión
const isConnected = await ImageService.testConnection();
console.log('Conexión S3:', isConnected);
```

### Probar subida de imagen:
```typescript
const imageUrl = await ImageService.uploadOptimizedImage(
  'file://path/to/image.jpg',
  'test-images',
  { maxWidth: 800, quality: 0.8 }
);
console.log('Imagen subida:', imageUrl);
```

## 📝 Notas Importantes

1. **Autenticación:** Tu sistema de autenticación actual (con tu backend personalizado) se mantiene intacto. Solo se migró el almacenamiento de imágenes.

2. **Compatibilidad:** La API del `ImageService` se mantiene igual, por lo que no necesitas cambiar el código que lo usa.

3. **Costos:** AWS S3 tiene un modelo de precios diferente a Firebase. Revisa los costos en la consola de AWS.

4. **Regiones:** Asegúrate de usar la misma región para todos los servicios AWS.

5. **Amplify v6:** Estamos usando la versión más reciente (v6.15.5) con la nueva API modular:
   - ✅ Importaciones específicas: `import { uploadData, getUrl, remove } from 'aws-amplify/storage'`
   - ✅ Configuración simplificada: `Storage: { S3: { ... } }`
   - ✅ Mejor rendimiento y tree-shaking

## 🚨 Próximos Pasos

1. ✅ Configurar tu bucket S3 real
2. ✅ Actualizar la configuración en `config/amplify.ts`
3. ✅ Configurar credenciales AWS
4. ✅ Probar la funcionalidad
5. ✅ Remover dependencias de Firebase (opcional)

## 🆘 Solución de Problemas

### Error de credenciales:
- Verifica que las credenciales AWS estén configuradas correctamente
- Asegúrate de que el usuario/rol tenga los permisos necesarios

### Error de bucket:
- Verifica que el bucket existe
- Confirma que la región es correcta
- Asegúrate de que el bucket permite las operaciones necesarias

### Error de CORS (en web):
- Configura CORS en tu bucket S3 si planeas usar la app en web

¿Necesitas ayuda con algún paso específico?
