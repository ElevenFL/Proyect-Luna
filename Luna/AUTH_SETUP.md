# Configuración del Sistema de Autenticación - Lunae

## 🚀 Funcionalidades Implementadas

### Backend
- ✅ Sistema de autenticación con JWT
- ✅ Hash de contraseñas con bcrypt
- ✅ Rutas de login y registro
- ✅ Middleware de autenticación
- ✅ Validaciones de datos
- ✅ Modelo de usuario con Mongoose

### Frontend
- ✅ Pantallas de Login y Register con diseño personalizado
- ✅ Contexto de autenticación con React Context
- ✅ Navegación condicional (login como primera pantalla)
- ✅ Almacenamiento local de tokens con AsyncStorage
- ✅ Protección de rutas con AuthGuard
- ✅ Interfaz de usuario siguiendo el diseño proporcionado

## 📋 Configuración Requerida

### 1. Backend (Lunae-backend)

#### Variables de Entorno
Crea un archivo `.env` en la carpeta `Lunae-backend` con:

```env
PORT=3000
DB_URL=mongodb://localhost:27017/lunae
JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion
```

#### Instalar Dependencias
```bash
cd Lunae-backend
npm install
```

#### Ejecutar Backend
```bash
npm run dev
```

### 2. Base de Datos
Asegúrate de tener MongoDB ejecutándose en tu sistema:
- Instala MongoDB localmente
- O usa MongoDB Atlas (cambia la URL en .env)

### 3. Frontend (Luna)

#### Instalar Dependencias
```bash
cd Luna
npm install
```

#### Ejecutar Frontend
```bash
npm start
```

## 🎨 Diseño Implementado

### Pantalla de Login
- Logo "Lunae" en amarillo dorado
- Campo de username o email con placeholder
- Campo de contraseña con toggle de visibilidad
- Botón "LOGIN" en amarillo
- Enlace "Forgot Password?"
- Enlace para crear cuenta

### Pantalla de Register
- Logo "Luna" en amarillo dorado
- Campo de username
- Campo de email
- Campo de contraseña con toggle
- Campo de confirmación de contraseña
- Botón "Signup" en amarillo
- Enlace para iniciar sesión

## 🔧 API Endpoints

### POST /api/users/register
Registra un nuevo usuario
```json
{
  "username": "juanperez",
  "email": "juan@ejemplo.com",
  "password": "123456"
}
```

### POST /api/users/login
Inicia sesión (acepta username o email)
```json
{
  "usernameOrEmail": "juanperez",
  "password": "123456"
}
```

O también:
```json
{
  "usernameOrEmail": "juan@ejemplo.com",
  "password": "123456"
}
```

### GET /api/users/profile
Obtiene el perfil del usuario autenticado (requiere token)

## 🔐 Funcionalidades de Login

### Login Flexible
- **Username o Email**: Puedes iniciar sesión usando tu username o tu email
- **Búsqueda Inteligente**: El sistema busca automáticamente en ambos campos
- **Experiencia de Usuario**: Más conveniente para los usuarios que pueden recordar cualquiera de los dos

### Ejemplos de Login
- Con username: `juanperez`
- Con email: `juan@ejemplo.com`
- Ambos funcionan con la misma contraseña

## 🛡️ Seguridad

- Contraseñas hasheadas con bcrypt
- Tokens JWT con expiración de 7 días
- Validación de datos en backend
- Protección de rutas en frontend
- Almacenamiento seguro de tokens

## 📱 Flujo de Navegación

1. **Usuario no autenticado**: Se muestra pantalla de login
2. **Registro exitoso**: Redirige a pantalla principal
3. **Login exitoso**: Redirige a pantalla principal
4. **Usuario autenticado**: Acceso a todas las pantallas protegidas
5. **Logout**: Limpia tokens y redirige a login

## 🐛 Solución de Problemas

### Error de Conexión
- Verifica que el backend esté ejecutándose en puerto 3000
- Asegúrate de que MongoDB esté funcionando
- Revisa la URL de la base de datos en .env

### Error de Autenticación
- Verifica que el token JWT sea válido
- Revisa la configuración de CORS en el backend
- Asegúrate de que las rutas estén correctamente configuradas

## 📝 Notas Adicionales

- El sistema está configurado para desarrollo local
- Para producción, cambia el JWT_SECRET por uno más seguro
- Considera implementar refresh tokens para mayor seguridad
- Puedes personalizar los estilos en los archivos de las pantallas
