# Migración de FriendRequest a Single Table Design

## Resumen de Cambios

Se ha migrado el modelo `FriendRequest` de usar una tabla separada a utilizar el patrón **Single Table Design** con la tabla `Lunea-chat`, utilizando claves primarias compuestas (PK/SK).

## Estructura de Datos

### Antes (Tabla Separada)
```
Tabla: FriendRequests
Clave Primaria: id
Índices: senderId-index, receiverId-index
```

### Después (Single Table Design)
```
Tabla: Lunea-chat
PK: FRIEND_REQUEST#{senderId}
SK: TO#{receiverId}
entityType: FriendRequest
```

## Beneficios de la Migración

1. **Eliminación del Error de Permisos**: Ya no se requiere permiso `dynamodb:Scan` ya que se usa `GetCommand` y `QueryCommand`
2. **Mejor Rendimiento**: Las operaciones son más eficientes al usar claves primarias directas
3. **Consistencia**: Mismo patrón que otros modelos (Users, Chat)
4. **Costos Reducidos**: Menos operaciones de scan costosas

## Métodos del Modelo FriendRequest

### Métodos Principales
- `create(friendRequestData)` - Crear nueva solicitud
- `findById(id)` - Buscar por ID (requiere índice entityType)
- `findBySenderId(senderId)` - Obtener solicitudes enviadas
- `findByReceiverId(receiverId)` - Obtener solicitudes recibidas (requiere GSI)
- `findExistingRequest(senderId, receiverId)` - Verificar solicitud existente
- `updateStatus(newStatus)` - Actualizar estado
- `delete()` - Eliminar solicitud

### Métodos Adicionales
- `findByReceiverIdAlternative(receiverId)` - Alternativa sin GSI
- `findExistingRequestBidirectional(senderId, receiverId)` - Verificar en ambas direcciones
- `findAll()` - Obtener todas las solicitudes (requiere índice entityType)

## Índices Requeridos

Para el funcionamiento óptimo, se recomienda crear estos índices en la tabla `Lunea-chat`:

### Global Secondary Index (GSI)
```json
{
  "IndexName": "entityType-index",
  "KeySchema": [
    {
      "AttributeName": "entityType",
      "KeyType": "HASH"
    }
  ],
  "Projection": {
    "ProjectionType": "ALL"
  }
}
```

### Global Secondary Index (GSI) - Opcional
```json
{
  "IndexName": "receiverId-index",
  "KeySchema": [
    {
      "AttributeName": "receiverId",
      "KeyType": "HASH"
    }
  ],
  "Projection": {
    "ProjectionType": "ALL"
  }
}
```

## Ejemplo de Uso

### Crear Solicitud de Amistad
```javascript
const friendRequest = await FriendRequest.create({
  senderId: 'user123',
  receiverId: 'user456',
  status: 'pending'
});
```

### Verificar Solicitud Existente
```javascript
const existingRequest = await FriendRequest.findExistingRequest('user123', 'user456');
if (existingRequest) {
  console.log('Ya existe una solicitud entre estos usuarios');
}
```

### Obtener Solicitudes Enviadas
```javascript
const sentRequests = await FriendRequest.findBySenderId('user123');
```

### Obtener Solicitudes Recibidas
```javascript
const receivedRequests = await FriendRequest.findByReceiverIdAlternative('user456');
```

## Controladores Actualizados

### Nuevos Endpoints
- `GET /friend-requests/all` - Obtener todas las solicitudes (enviadas y recibidas)

### Endpoints Existentes (Mejorados)
- `POST /friend-requests/send/:userId` - Enviar solicitud (ahora verifica bidireccionalmente)
- `GET /friend-requests/received` - Solicitudes recibidas (usa método alternativo)
- `GET /friend-requests/sent` - Solicitudes enviadas
- `PUT /friend-requests/:friendRequestId/accept` - Aceptar solicitud
- `PUT /friend-requests/:friendRequestId/reject` - Rechazar solicitud
- `DELETE /friend-requests/:friendRequestId/cancel` - Cancelar solicitud

## Migración de Datos Existentes

Si tienes datos existentes en la tabla `FriendRequests`, necesitarás migrarlos:

```javascript
// Script de migración (ejemplo)
const migrateFriendRequests = async () => {
  const oldRequests = await oldFriendRequestModel.findAll();
  
  for (const request of oldRequests) {
    const newRequest = new FriendRequest({
      id: request.id,
      senderId: request.senderId,
      receiverId: request.receiverId,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    });
    
    await newRequest.create();
  }
};
```

## Consideraciones de Rendimiento

1. **Operaciones Optimizadas**: Las búsquedas por PK/SK son más rápidas que scan
2. **Índices Recomendados**: Crear los GSI mencionados para consultas eficientes
3. **Consultas Paralelas**: Usar `Promise.all()` para operaciones independientes
4. **Límites de Paginación**: Implementar paginación para listas grandes

## Pruebas

Para probar la funcionalidad:

1. Crear una solicitud de amistad
2. Verificar que se puede encontrar por senderId
3. Verificar que se puede encontrar por receiverId
4. Probar aceptar/rechazar solicitud
5. Verificar que no se pueden crear solicitudes duplicadas

## Compatibilidad

- ✅ Compatible con el frontend existente
- ✅ Misma API REST
- ✅ Mismos formatos de respuesta
- ✅ Manejo de errores mejorado
