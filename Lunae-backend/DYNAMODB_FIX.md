# 🔧 Solución al Problema de DynamoDB - Usuarios No Se Registran

## 🚨 Problema Identificado
Los usuarios no se están registrando en la tabla de DynamoDB y aparece siempre vacía.

## 🔍 Causas Principales
1. **Tabla no existe**: La tabla de DynamoDB no se ha creado automáticamente
2. **Permisos insuficientes**: Las credenciales de AWS no tienen permisos para DynamoDB
3. **Configuración incorrecta**: Variables de entorno mal configuradas
4. **Errores no manejados**: El código no manejaba adecuadamente los errores de DynamoDB

## ✅ Soluciones Implementadas

### 1. Creación Automática de Tabla
- Se agregó el método `ensureTableExists()` que crea la tabla automáticamente si no existe
- Todos los métodos del modelo User ahora verifican que la tabla existe antes de operar
- La tabla se crea con la configuración correcta para DynamoDB

### 2. Manejo Mejorado de Errores
- Se agregó logging detallado para todas las operaciones
- Se manejan errores específicos de DynamoDB (ResourceNotFoundException, AccessDeniedException, etc.)
- Se proporcionan mensajes de error claros para el usuario

### 3. Verificación de Configuración
- Se creó el script `verify-setup.js` para verificar la configuración completa
- Se mejoró el archivo `env.template` con instrucciones claras
- Se agregaron validaciones para credenciales por defecto

## 🚀 Pasos para Solucionar

### Paso 1: Verificar Configuración
```bash
cd Lunae-backend
npm run verify-setup
```

### Paso 2: Si hay errores, configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp env.template .env

# Editar .env con tus credenciales reales de AWS
# Reemplazar:
# AWS_ACCESS_KEY_ID=TU_ACCESS_KEY_AWS_AQUI
# AWS_SECRET_ACCESS_KEY=TU_SECRET_KEY_AWS_AQUI
# JWT_SECRET=tu_jwt_secret_super_seguro_aqui
```

### Paso 3: Crear tabla manualmente (opcional)
```bash
npm run setup-dynamodb
```

### Paso 4: Probar creación de usuarios
```bash
npm run test-user-creation
```

### Paso 5: Iniciar el servidor
```bash
npm run dev
```

## 🔑 Permisos AWS Requeridos
Tu usuario de AWS debe tener estos permisos mínimos:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📋 Estructura de la Tabla
La tabla se crea automáticamente con:
- **Partition Key**: `id` (String)
- **Billing Mode**: Pay per request (on-demand)
- **Índices**: Se pueden agregar posteriormente para optimizar búsquedas

## 🧪 Scripts de Prueba Disponibles
- `npm run verify-setup` - Verifica toda la configuración
- `npm run test-user-creation` - Prueba creación de usuarios
- `npm run test-dynamodb` - Prueba conexión básica a DynamoDB
- `npm run setup-dynamodb` - Crea la tabla manualmente

## 🔍 Logs y Debugging
El sistema ahora proporciona logs detallados:
- ✅ Operaciones exitosas
- ❌ Errores y excepciones
- 💡 Sugerencias para solucionar problemas
- 📄 Datos de usuarios creados/actualizados

## 🚨 Errores Comunes y Soluciones

### Error: "ResourceNotFoundException"
- **Causa**: La tabla no existe
- **Solución**: Se crea automáticamente en la primera operación

### Error: "AccessDeniedException"
- **Causa**: Permisos insuficientes en AWS
- **Solución**: Verificar permisos del usuario de AWS

### Error: "UnrecognizedClientException"
- **Causa**: Credenciales de AWS incorrectas
- **Solución**: Verificar ACCESS_KEY_ID y SECRET_ACCESS_KEY

### Error: "ValidationException"
- **Causa**: Datos del usuario inválidos
- **Solución**: Verificar formato de email, username y contraseña

## 📞 Soporte
Si persisten los problemas:
1. Ejecuta `npm run verify-setup` y comparte los logs
2. Verifica que las credenciales de AWS sean correctas
3. Asegúrate de que tu usuario de AWS tenga permisos para DynamoDB
4. Verifica que la región de AWS sea la correcta

## 🎯 Estado Actual
- ✅ Creación automática de tabla
- ✅ Manejo robusto de errores
- ✅ Logging detallado
- ✅ Validación de configuración
- ✅ Scripts de prueba y verificación
- ✅ Documentación completa
