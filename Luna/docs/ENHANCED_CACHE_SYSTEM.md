# Sistema de Caché Mejorado para Chat

## Resumen

Se ha implementado un nuevo sistema de caché mejorado que gestiona las conversaciones de manera más eficiente, manteniendo las últimas 80 conversaciones recientes en memoria y los últimos 50 mensajes de cada conversación. Las últimas 20 conversaciones se persisten en AsyncStorage para mayor durabilidad.

## Características Principales

### 1. Gestión LRU (Least Recently Used)
- Mantiene 80 conversaciones en memoria
- Elimina automáticamente las menos usadas cuando se supera el límite
- Prioriza conversaciones de alta prioridad

### 2. Límites de Mensajes
- Máximo 50 mensajes por conversación
- Mensajes más antiguos se eliminan automáticamente
- Mantiene orden cronológico

### 3. Persistencia Selectiva
- Persiste las últimas 20 conversaciones en AsyncStorage
- Conversaciones de alta prioridad se persisten automáticamente
- Recuperación automática al reiniciar la app

### 4. Metadata Rica
- Contador de accesos por conversación
- Prioridad (high, medium, low) basada en uso
- Información del usuario (nombre, imagen, estado online)
- Contador de mensajes no leídos
- Timestamps de última actividad

## Archivos Creados/Modificados

### Nuevos Archivos
- `Luna/services/enhancedCacheService.ts` - Servicio principal de caché
- `Luna/hooks/useEnhancedChatCache.ts` - Hook mejorado para caché
- `Luna/docs/ENHANCED_CACHE_SYSTEM.md` - Esta documentación

### Archivos Modificados
- `Luna/contexts/ChatProvider.tsx` - Integración con nuevo sistema
- `Luna/hooks/useChatCache.ts` - Actualizado para usar nuevo sistema
- `Luna/services/optimizedChatService.ts` - Compatibilidad con nuevo caché

## Uso del Sistema

### 1. Hook Básico (useChatCache)
```typescript
import { useChatCache } from '@/hooks/useChatCache';

const { messages, metadata, loadFromCache, syncWithServer } = useChatCache({
  conversationId: 'conv-123',
  autoSync: true
});
```

### 2. Hook Mejorado (useEnhancedChatCache)
```typescript
import { useEnhancedChatCache } from '@/hooks/useEnhancedChatCache';

const { 
  messages, 
  metadata, 
  updateMetadata,
  updateUnreadCount,
  markAsAccessed,
  setPriority 
} = useEnhancedChatCache({
  conversationId: 'conv-123',
  autoSync: true
});

// Marcar como accedida para actualizar prioridad
await markAsAccessed();

// Actualizar contador de no leídos
await updateUnreadCount(5);

// Establecer prioridad alta
await setPriority('high');
```

### 3. Servicio Directo
```typescript
import enhancedCacheService from '@/services/enhancedCacheService';

// Obtener mensajes
const messages = await enhancedCacheService.getMessages('conv-123');

// Guardar mensajes
await enhancedCacheService.setMessages('conv-123', messages);

// Obtener metadata
const metadata = await enhancedCacheService.getConversationMetadata('conv-123');

// Actualizar metadata
await enhancedCacheService.updateConversationMetadata('conv-123', {
  unreadCount: 0,
  priority: 'high'
});
```

## Configuración

### Límites Configurables
```typescript
// En enhancedCacheService.ts
private readonly MAX_MEMORY_CONVERSATIONS = 80;        // Conversaciones en memoria
private readonly MAX_PERSISTED_CONVERSATIONS = 20;     // Conversaciones persistentes
private readonly MAX_MESSAGES_PER_CONVERSATION = 50;   // Mensajes por conversación
private readonly CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
```

### Prioridades Automáticas
- **Alta**: Accedida >10 veces y en últimos 2 días
- **Media**: Accedida >3 veces y en últimos 7 días  
- **Baja**: Resto de casos

## Gestión de Memoria

### Limpieza Automática
- Se ejecuta cada 5 minutos
- Elimina conversaciones expiradas
- Aplica límites LRU
- Limpia mensajes optimistas antiguos

### Persistencia Inteligente
- Conversaciones de alta prioridad se persisten automáticamente
- Las 20 más recientes se mantienen en AsyncStorage
- Recuperación automática al inicializar

## Integración con ChatProvider

El ChatProvider ahora:
1. Inicializa el servicio de caché mejorado
2. Carga mensajes desde caché al abrir conversaciones
3. Guarda mensajes automáticamente en caché
4. Actualiza metadata de uso y acceso
5. Ejecuta limpieza automática

## Compatibilidad

El sistema es completamente compatible con el código existente:
- Todos los hooks existentes siguen funcionando
- Los servicios mantienen su API original
- Se añaden nuevas funcionalidades sin romper las existentes

## Beneficios

1. **Rendimiento**: Carga instantánea de conversaciones cacheadas
2. **Memoria**: Gestión automática de límites de memoria
3. **Persistencia**: Recuperación de conversaciones al reiniciar
4. **Inteligencia**: Priorización basada en uso real
5. **Escalabilidad**: Maneja grandes cantidades de conversaciones
6. **UX**: Sin parpadeos ni cargas lentas

## Debugging

### Estadísticas del Caché
```typescript
const stats = enhancedCacheService.getCacheStats();
console.log('Conversaciones:', stats.totalConversations);
console.log('Mensajes totales:', stats.totalMessages);
console.log('Uso de memoria:', stats.memoryUsage);
console.log('Conversaciones persistentes:', stats.persistedConversations);
```

### Información de Conversación
```typescript
const metadata = await enhancedCacheService.getConversationMetadata('conv-123');
console.log('Accesos:', metadata.accessCount);
console.log('Prioridad:', metadata.priority);
console.log('Último acceso:', new Date(metadata.lastAccessTime));
```

## Mantenimiento

### Limpieza Manual
```typescript
// Limpiar conversación específica
await enhancedCacheService.clearConversation('conv-123');

// Limpiar todo el caché
await enhancedCacheService.clearAllCache();

// Ejecutar limpieza automática
await enhancedCacheService.performCleanup();
```

### Monitoreo
El sistema incluye logs detallados para monitoreo:
- `✅ EnhancedCache:` - Operaciones exitosas
- `🔄 EnhancedCache:` - Operaciones de sincronización
- `🧹 EnhancedCache:` - Operaciones de limpieza
- `❌ EnhancedCache:` - Errores

## Consideraciones Futuras

1. **Compresión**: Comprimir mensajes antiguos para ahorrar espacio
2. **Sincronización**: Sincronización inteligente basada en cambios del servidor
3. **Analytics**: Métricas de uso para optimización
4. **Backup**: Backup automático de conversaciones importantes
5. **Cifrado**: Cifrado opcional para mensajes sensibles
