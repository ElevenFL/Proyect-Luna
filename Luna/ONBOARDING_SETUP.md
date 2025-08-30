# Sistema de Onboarding - Lunea

## Descripción
Sistema completo de onboarding para configurar el perfil del usuario la primera vez que se loguea en la aplicación.

## Flujo del Onboarding

### 1. Pantalla de Bienvenida (`/onboarding/welcome`)
- Muestra el logo de Lunea
- Mensaje de bienvenida a la comunidad
- Indicador de progreso (1/5)
- Botón "Next" para continuar

### 2. Pantalla de Nombre (`/onboarding/name`)
- Campo para ingresar el nombre visible
- Texto explicativo sobre la privacidad
- Indicador de progreso (2/5)
- Botón "Next" (habilitado solo si hay texto)

### 3. Pantalla de Fecha de Nacimiento (`/onboarding/birthdate`)
- Selector de fecha de nacimiento
- Texto explicativo sobre personalización
- Indicador de progreso (3/5)
- Botón "Next" (habilitado solo si se selecciona fecha)

### 4. Pantalla de Ubicación (`/onboarding/location`)
- Solicitud de permisos de ubicación
- Explicación sobre el uso de la ubicación
- Indicador de progreso (4/5)
- Botones "Allow location" y "Skip for now"

### 5. Pantalla de Finalización (`/onboarding/complete`)
- Mensaje de confirmación
- Indicador de progreso completo (5/5)
- Botón "Finish" que actualiza el perfil

## Backend

### Modelo de Usuario Actualizado
```javascript
{
  username: String,
  email: String,
  password: String,
  displayName: String,        // Nombre visible
  birthDate: Date,           // Fecha de nacimiento
  location: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  profileCompleted: Boolean  // Indica si el perfil está completo
}
```

### Rutas del Backend
- `GET /api/profile` - Obtener perfil del usuario
- `PUT /api/profile` - Actualizar perfil del usuario

### Controladores
- `getProfile` - Obtiene los datos del perfil del usuario autenticado
- `updateProfile` - Actualiza los datos del perfil y marca como completado

## Frontend

### Navegación
- Las pantallas del onboarding están en `/app/onboarding/`
- Layout específico para el onboarding en `_layout.tsx`
- Navegación entre pantallas usando `expo-router`

### Contexto de Autenticación
- Actualizado para incluir campos del perfil
- Función `updateUserProfile` para actualizar datos localmente
- Verificación de `profileCompleted` para redirección

### AuthGuard
- Redirige automáticamente al onboarding si `profileCompleted` es `false`
- Permite navegación normal si el perfil está completo
- Maneja la lógica de redirección entre login, onboarding y tabs

## Flujo de Usuario

1. **Usuario se registra/loguea** → AuthGuard verifica `profileCompleted`
2. **Si `profileCompleted` es `false`** → Redirige a `/onboarding/welcome`
3. **Usuario completa el onboarding** → Datos se envían al backend
4. **Backend actualiza el perfil** → Marca `profileCompleted: true`
5. **Frontend actualiza el contexto** → Redirige a `/(tabs)`

## Características Técnicas

### Diseño
- Tema oscuro con acentos amarillos (#FFD700)
- Gradientes lineales para el fondo
- Indicadores de progreso visuales
- Botones con estados habilitado/deshabilitado

### Validaciones
- Nombre requerido para continuar
- Fecha de nacimiento requerida
- Ubicación opcional (se puede omitir)
- Validación de permisos de ubicación

### Persistencia
- Datos del perfil se guardan en la base de datos
- Contexto local se actualiza automáticamente
- AsyncStorage mantiene la sesión del usuario

## Instalación y Uso

1. El backend ya está configurado con las rutas necesarias
2. Las pantallas del onboarding están listas para usar
3. El AuthGuard maneja automáticamente las redirecciones
4. No se requiere configuración adicional

## Dependencias Utilizadas

- `expo-location` - Para permisos y obtención de ubicación
- `@react-native-community/datetimepicker` - Para selector de fecha
- `expo-linear-gradient` - Para gradientes de fondo
- `@expo/vector-icons` - Para iconos de navegación
