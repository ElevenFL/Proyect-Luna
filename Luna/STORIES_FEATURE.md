# Funcionalidad de Stories

Esta funcionalidad implementa un sistema de Stories similar a Instagram, Facebook y Snapchat.

## Características principales

### 1. Creación de Stories
- **Pantalla**: `app/create-story.tsx`
- **Funcionalidades**:
  - Subir imagen desde galería o cámara
  - Escribir texto
  - Agregar ubicación (preparado para implementar)
  - Configurar privacidad (preparado para implementar)
  - Los stories expiran automáticamente en 24 horas

### 2. Visualización de Stories
- **Pantalla**: `app/view-stories.tsx`
- **Funcionalidades**:
  - Navegación automática entre stories
  - Barra de progreso animada
  - Toque izquierdo/derecho para navegar
  - Marcado automático como "visto"
  - Soporte para stories de imagen y texto

### 3. Anillos de Stories
- **Componente**: `components/StoryRing.tsx`
- **Características**:
  - Gradiente colorido para stories nuevos
  - Gradiente gris para stories vistos
  - Tamaño personalizable
  - Integración con avatares de perfil

### 4. Gestión de Estado
- **Contexto**: `contexts/StoriesContext.tsx`
- **Funcionalidades**:
  - Almacenamiento local de stories
  - Limpieza automática de stories expirados
  - Marcado de stories como vistos
  - Agrupación por usuario

## Integración en la App

### Pantalla de Mensajes
- Los avatares muestran anillos de colores cuando hay stories
- Botón "+" para crear nuevos stories
- Navegación directa a ver stories desde avatares

### Navegación
- `+` → Crear story
- Avatar con anillo colorido → Ver stories
- Avatar sin anillo → Chat normal

## Estructura de Datos

```typescript
interface Story {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  content: {
    type: 'image' | 'text';
    data: string;
  };
  createdAt: Date;
  expiresAt: Date;
  isViewed?: boolean;
  location?: string;
}
```

## Colores del Anillo

### Stories Nuevos (No Vistos)
- Gradiente colorido: `#F9C80E`, `#FF6B6B`, `#4ECDC4`, `#45B7D1`, `#96CEB4`, `#FFEAA7`, `#DDA0DD`

### Stories Vistos
- Gradiente gris: `#666666`, `#888888`, `#666666`

## Próximas Mejoras

1. **Integración con Backend**: Conectar con API real para persistir stories
2. **Ubicación**: Implementar funcionalidad de geolocalización
3. **Privacidad**: Configurar quién puede ver los stories
4. **Reacciones**: Agregar likes y reacciones a stories
5. **Estadísticas**: Mostrar quién ha visto el story
6. **Filtros**: Agregar filtros de imagen para stories
7. **Texto Personalizado**: Más opciones de formato de texto

## Dependencias Utilizadas

- `expo-image-picker`: Para seleccionar/tomar fotos
- `expo-linear-gradient`: Para los anillos de gradiente
- `react-native-gesture-handler`: Para navegación por gestos
- `react-native-reanimated`: Para animaciones suaves

## Uso

1. **Crear Story**: Toca el botón "+" en la pantalla de mensajes
2. **Ver Stories**: Toca cualquier avatar con anillo colorido
3. **Navegar**: Desliza o toca los lados de la pantalla para cambiar stories
4. **Salir**: Toca la "X" o espera a que terminen todos los stories


