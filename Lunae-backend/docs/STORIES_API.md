# API de Stories - Documentación

Esta documentación describe la API para la funcionalidad de Stories en el backend de Luna.

## Endpoints Disponibles

### Base URL
```
/api/stories
```

### Autenticación
Todos los endpoints requieren autenticación mediante token Bearer en el header:
```
Authorization: Bearer <token>
```

## Endpoints

### 1. Crear Story
**POST** `/api/stories`

Crea un nuevo story.

**Body:**
```json
{
  "content": {
    "type": "image" | "text",
    "data": "string"
  },
  "location": "string" // opcional
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Story creado exitosamente",
  "data": {
    "id": "story_1234567890_abc123",
    "userId": "user_123",
    "userName": "Juan Pérez",
    "userProfileImage": "https://example.com/profile.jpg",
    "content": {
      "type": "image",
      "data": "https://example.com/story.jpg"
    },
    "location": "Madrid, España",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "expiresAt": "2024-01-16T10:30:00.000Z",
    "isViewed": false,
    "stats": {
      "views": 0,
      "likes": 0,
      "reactions": 0,
      "isExpired": false
    }
  }
}
```

### 2. Obtener Stories de Usuario
**GET** `/api/stories/user/:userId`

Obtiene todos los stories activos de un usuario específico.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "userName": "Juan Pérez",
    "userProfileImage": "https://example.com/profile.jpg",
    "stories": [
      {
        "id": "story_1234567890_abc123",
        "content": {
          "type": "image",
          "data": "https://example.com/story.jpg"
        },
        "location": "Madrid, España",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "expiresAt": "2024-01-16T10:30:00.000Z",
        "isViewed": false,
        "stats": {
          "views": 5,
          "likes": 2,
          "reactions": 1,
          "isExpired": false
        }
      }
    ]
  }
}
```

### 3. Obtener Stories de Amigos
**GET** `/api/stories/friends?friendIds=user1,user2,user3`

Obtiene stories de amigos específicos.

**Query Parameters:**
- `friendIds` (opcional): Lista de IDs de amigos separados por comas

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "storiesByUser": [
      {
        "userId": "user_123",
        "userName": "Juan Pérez",
        "userProfileImage": "https://example.com/profile.jpg",
        "stories": [...]
      }
    ],
    "totalUsers": 3,
    "totalStories": 5
  }
}
```

### 4. Obtener Todos los Stories Activos
**GET** `/api/stories/active?userIds=user1,user2`

Obtiene todos los stories activos, opcionalmente filtrados por usuarios.

**Query Parameters:**
- `userIds` (opcional): Lista de IDs de usuarios separados por comas

### 5. Marcar Story como Visto
**PATCH** `/api/stories/:storyId/view`

Marca un story como visto por el usuario autenticado.

**Respuesta:**
```json
{
  "success": true,
  "message": "Story marcado como visto",
  "data": {
    "storyId": "story_1234567890_abc123",
    "viewedBy": ["user_123", "user_456"],
    "stats": {
      "views": 2,
      "likes": 1,
      "reactions": 0,
      "isExpired": false
    }
  }
}
```

### 6. Dar Like a Story
**POST** `/api/stories/:storyId/like`

Da like a un story.

**Respuesta:**
```json
{
  "success": true,
  "message": "Like agregado exitosamente",
  "data": {
    "storyId": "story_1234567890_abc123",
    "likes": ["user_123", "user_456"],
    "stats": {
      "views": 2,
      "likes": 2,
      "reactions": 0,
      "isExpired": false
    }
  }
}
```

### 7. Quitar Like de Story
**DELETE** `/api/stories/:storyId/like`

Quita el like de un story.

### 8. Agregar Reacción
**POST** `/api/stories/:storyId/reaction`

Agrega una reacción a un story.

**Body:**
```json
{
  "type": "like" | "love" | "laugh" | "wow" | "sad" | "angry"
}
```

### 9. Eliminar Story
**DELETE** `/api/stories/:storyId`

Elimina un story (solo el propietario puede eliminarlo).

### 10. Obtener Estadísticas de Story
**GET** `/api/stories/:storyId/stats`

Obtiene estadísticas detalladas de un story.

### 11. Limpiar Stories Expirados
**POST** `/api/stories/cleanup`

Limpia todos los stories expirados (endpoint administrativo).

## Modelo de Datos

### Story
```javascript
{
  id: string,                    // ID único del story
  userId: string,                // ID del usuario propietario
  userName: string,              // Nombre del usuario
  userProfileImage: string,      // URL de la imagen de perfil
  content: {                     // Contenido del story
    type: 'image' | 'text',      // Tipo de contenido
    data: string                 // Datos del contenido (URL o texto)
  },
  location: string,              // Ubicación opcional
  createdAt: Date,               // Fecha de creación
  expiresAt: Date,               // Fecha de expiración (24 horas)
  isViewed: boolean,             // Si ha sido visto por el usuario actual
  viewedBy: string[],            // Array de IDs de usuarios que han visto
  likes: string[],               // Array de IDs de usuarios que han dado like
  reactions: [{                  // Array de reacciones
    userId: string,
    type: string,
    timestamp: Date
  }]
}
```

## Características

### Expiración Automática
- Los stories expiran automáticamente después de 24 horas
- Se puede limpiar manualmente con el endpoint de cleanup
- Se recomienda ejecutar limpieza automática con cron

### Seguridad
- Solo el propietario puede eliminar sus stories
- Autenticación requerida para todas las operaciones
- Validación de tipos de contenido

### Rendimiento
- Los stories se almacenan en DynamoDB con estructura optimizada
- Consultas eficientes por usuario y estado
- Limpieza automática de datos expirados

## Códigos de Error

- `400`: Datos de entrada inválidos
- `401`: No autenticado
- `403`: Sin permisos
- `404`: Story o usuario no encontrado
- `410`: Story expirado
- `500`: Error interno del servidor

## Ejemplos de Uso

### Crear Story de Imagen
```bash
curl -X POST /api/stories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "type": "image",
      "data": "https://example.com/story.jpg"
    },
    "location": "Madrid, España"
  }'
```

### Crear Story de Texto
```bash
curl -X POST /api/stories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "type": "text",
      "data": "¡Qué día tan hermoso! 🌞"
    }
  }'
```

### Obtener Stories de Amigos
```bash
curl -X GET "/api/stories/friends?friendIds=user1,user2,user3" \
  -H "Authorization: Bearer <token>"
```

