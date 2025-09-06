# Sistema de Caché y Sincronización en Segundo Plano

## Descripción

El sistema implementado mejora significativamente la fluidez de carga del chat al guardar las conversaciones localmente en el dispositivo y mantenerlas sincronizadas constantemente en segundo plano. Esto permite que los usuarios vean los mensajes inmediatamente al abrir cualquier conversación, ya que todas las conversaciones se mantienen actualizadas automáticamente.

**Nuevas mejoras implementadas:**
- **Sistema de versionado**: Evita recargas innecesarias mediante control de versiones del caché
- **Control de estado granular**: Gestiona el estado de carga de cada conversación individualmente
- **Prevención de reinicializaciones**: Evita reinicializar conversaciones ya cargadas
- **Sincronización inteligente**: Solo sincroniza cuando es realmente necesario
- **Gestión de estado persistente**: Mantiene el estado de las conversaciones entre sesiones

## Componentes Principales

### 1. CacheService (`services/cacheService.ts`)

Servicio principal que maneja el almacenamiento local de conversaciones usando AsyncStorage.

**Características:**
- Almacena hasta 100 mensajes por conversación
- Expira automáticamente después de 24 horas
- Evita duplicados de mensajes
- Proporciona métodos para sincronización inteligente

**Métodos principales:**
- `getCachedMessages(conversationId)`: Obtiene mensajes desde caché
- `cacheMessages(conversationId, messages)`: Guarda mensajes en caché
- `addMessageToCache(conversationId, message)`: Añade un mensaje al caché
- `needsSync(conversationId)`: Verifica si necesita sincronización
- `clearConversationCache(conversationId)`: Limpia caché de una conversación

### 2. BackgroundSyncService (`services/backgroundSyncService.ts`)

Servicio de sincronización en segundo plano que mantiene todas las conversaciones actualizadas constantemente.

**Características:**
- Sincronización automática cada 30 segundos
- Prioriza conversaciones activas (cada 10 segundos)
- Maneja cambios de estado de la app
- Sincronización concurrente (máximo 3 conversaciones a la vez)
- Reintentos automáticos en caso de error

**Métodos principales:**
- `initialize(userId)`: Inicializa el servicio para un usuario
- `addConversation(conversationId, participants)`: Añade conversación para sincronización
- `setConversationActive(conversationId, isActive)`: Marca conversación como activa/inactiva
- `getSyncStatus()`: Obtiene estado de sincronización de todas las conversaciones

### 3. ConversationContext (`contexts/ConversationContext.tsx`)

Contexto que gestiona las conversaciones y se integra con el servicio de sincronización en segundo plano.

**Características:**
- Inicializa automáticamente la sincronización en segundo plano
- Maneja eventos de actualización de conversaciones
- Refresca conversaciones cuando la app vuelve al primer plano
- Proporciona estado global de conversaciones

### 4. Hook useChatCache (`hooks/useChatCache.ts`)

Hook personalizado que proporciona una interfaz optimizada para manejar el caché de conversaciones.

**Características:**
- Carga automática desde caché al cambiar de conversación
- Auto-sincronización periódica (opcional)
- Manejo de estados de carga y sincronización
- Prevención de duplicados

### 5. ChatScreen Actualizada (`app/chat/[userId].tsx`)

La pantalla de chat ha sido optimizada para usar el sistema de caché y sincronización en segundo plano.

**Flujo de carga optimizado:**
1. **Carga instantánea**: Muestra mensajes desde caché inmediatamente
2. **Marcado como activa**: Marca la conversación como activa para sincronización prioritaria
3. **Verificación de sincronización**: Verifica si necesita actualizar desde el servidor
4. **Sincronización en segundo plano**: Actualiza mensajes si es necesario
5. **Indicadores visuales**: Muestra estado de carga y sincronización

### 6. BackgroundSyncDebugger (`components/BackgroundSyncDebugger.tsx`)

Componente de debugging para monitorear el estado de la sincronización en segundo plano.

**Características:**
- Muestra estadísticas de sincronización
- Estado de todas las conversaciones
- Información del caché
- Acciones de debugging (limpiar caché, refrescar)

## Flujo de Funcionamiento

### Inicialización del Sistema

```
1. Usuario inicia sesión
2. AuthContext inicializa ChatService
3. ChatService inicializa BackgroundSyncService
4. BackgroundSyncService carga todas las conversaciones del usuario
5. Inicia sincronización automática en segundo plano
```

### Sincronización en Segundo Plano

```
1. Timer ejecuta cada 30 segundos (10 segundos para conversaciones activas)
2. Verifica qué conversaciones necesitan sincronización
3. Sincroniza hasta 3 conversaciones concurrentemente
4. Actualiza caché con nuevos mensajes
5. Emite eventos de actualización
6. Reintenta en caso de error
```

### Carga de Conversación

```
1. Usuario abre conversación
2. Marcar conversación como activa (sincronización prioritaria)
3. Cargar mensajes desde caché (instantáneo)
4. Mostrar mensajes al usuario
5. Verificar si necesita sincronización inmediata
6. Si es necesario, sincronizar con servidor
7. Actualizar mensajes si hay cambios
```

### Envío de Mensajes

```
1. Usuario envía mensaje
2. Enviar al servidor via API
3. Recibir confirmación via WebSocket
4. Añadir mensaje al caché automáticamente
5. Actualizar UI
6. Marcar conversación para sincronización prioritaria
```

### Manejo de Estado de la App

```
1. App pasa a segundo plano:
   - Reducir frecuencia de sincronización (3x más lento)
   - Mantener sincronización básica

2. App vuelve al primer plano:
   - Sincronizar todas las conversaciones inmediatamente
   - Restaurar frecuencia normal de sincronización
   - Refrescar lista de conversaciones
```

### Sincronización Inteligente

El sistema determina si necesita sincronización basándose en:
- **Conversaciones activas**: Cada 10 segundos
- **Conversaciones inactivas**: Cada 30 segundos
- **Tiempo transcurrido**: Máximo 1 hora sin sincronización
- **Comparación de IDs**: Verifica si hay mensajes nuevos en el servidor
- **Estado de validez**: Verifica si el caché ha expirado

## Beneficios

### Para el Usuario
- **Carga instantánea**: Los mensajes aparecen inmediatamente en cualquier conversación
- **Experiencia fluida**: No hay esperas para ver conversaciones anteriores
- **Siempre actualizado**: Todas las conversaciones se mantienen sincronizadas automáticamente
- **Funciona offline**: Puede ver mensajes guardados sin conexión
- **Indicadores claros**: Sabe cuándo se está sincronizando
- **Priorización inteligente**: Las conversaciones activas se sincronizan más frecuentemente

### Para el Sistema
- **Menos llamadas al servidor**: Reduce la carga en el backend con sincronización inteligente
- **Mejor rendimiento**: Menos tiempo de espera en la UI
- **Sincronización eficiente**: Solo sincroniza cuando es necesario
- **Manejo de errores**: Funciona incluso si hay problemas de conectividad
- **Escalabilidad**: Maneja múltiples conversaciones concurrentemente
- **Optimización de recursos**: Ajusta la frecuencia según el estado de la app

## Configuración

### Parámetros Ajustables

```typescript
// En cacheService.ts
private readonly CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas
private readonly MAX_CACHED_MESSAGES = 100; // Máximo 100 mensajes

// En backgroundSyncService.ts
syncInterval: 30000, // 30 segundos para conversaciones inactivas
maxConcurrentSyncs: 3, // Máximo 3 conversaciones simultáneas
retryAttempts: 3, // 3 intentos en caso de error
retryDelay: 5000 // 5 segundos entre reintentos

// En useChatCache.ts
syncInterval = 30000 // 30 segundos para auto-sincronización
```

### Personalización

Puedes ajustar estos valores según las necesidades de tu aplicación:
- **CACHE_EXPIRY_MS**: Tiempo de expiración del caché
- **MAX_CACHED_MESSAGES**: Número máximo de mensajes por conversación
- **syncInterval**: Intervalo de sincronización en segundo plano
- **maxConcurrentSyncs**: Número máximo de conversaciones a sincronizar simultáneamente
- **retryAttempts**: Número de reintentos en caso de error
- **retryDelay**: Tiempo de espera entre reintentos

## Uso

### En Componentes

```typescript
import { useChatCache } from '@/hooks/useChatCache';
import { useConversations } from '@/contexts/ConversationContext';

// Hook para caché de conversación específica
const { 
  messages, 
  isLoading, 
  isSyncing, 
  loadFromCache, 
  syncWithServer, 
  addMessage 
} = useChatCache({ 
  conversationId: 'conv-123',
  autoSync: true 
});

// Hook para gestión global de conversaciones
const { 
  conversations, 
  refreshConversations, 
  markConversationActive 
} = useConversations();
```

### En Servicios

```typescript
import cacheService from '@/services/cacheService';
import backgroundSyncService from '@/services/backgroundSyncService';
import chatService from '@/services/chatService';

// Obtener mensajes desde caché
const messages = await cacheService.getCachedMessages(conversationId);

// Verificar si necesita sincronización
const needsSync = await cacheService.needsSync(conversationId);

// Limpiar caché
await cacheService.clearConversationCache(conversationId);

// Gestionar sincronización en segundo plano
backgroundSyncService.addConversation(conversationId, participants);
backgroundSyncService.setConversationActive(conversationId, true);

// Obtener estado de sincronización
const syncStatus = backgroundSyncService.getSyncStatus();
const stats = backgroundSyncService.getStats();

// Configurar sincronización
chatService.configureBackgroundSync({
  syncInterval: 20000, // 20 segundos
  maxConcurrentSyncs: 5
});
```

## Debugging

### Información del Caché

```typescript
// Obtener información del caché para debugging
const cacheInfo = await cacheService.getCacheInfo();
console.log('Información del caché:', cacheInfo);
```

### Logs

El sistema proporciona logs detallados con emojis para facilitar el debugging:
- 📱 Carga desde caché
- 🔄 Sincronización con servidor
- ➕ Añadir mensaje al caché
- 🗑️ Limpiar caché
- ✅ Caché actualizado

## Consideraciones

### Almacenamiento
- El caché se almacena en AsyncStorage (persistente)
- Se limpia automáticamente al hacer logout
- Puede ser limpiado manualmente si es necesario

### Rendimiento
- La carga desde caché es prácticamente instantánea
- La sincronización ocurre en segundo plano
- No bloquea la UI durante las operaciones

### Conectividad
- Funciona sin conexión para mensajes en caché
- Se sincroniza automáticamente cuando hay conexión
- Maneja errores de red graciosamente
