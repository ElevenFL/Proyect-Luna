# Solución para Pantalla en Negro en Luna App

## Problema Identificado

La aplicación se queda con la pantalla en negro cuando:
- Sales de la app con una alerta activa
- La app pasa a segundo plano durante operaciones de autenticación
- Hay problemas de estado en el contexto de autenticación
- Las alertas no se limpian correctamente al cambiar el estado de la app

## Soluciones Implementadas

### 1. Manejo del Ciclo de Vida de la App

Se implementó un sistema de manejo del estado de la aplicación usando `AppState` de React Native:

```typescript
// En AuthContext.tsx
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (appState.match(/inactive|background/) && nextAppState === 'active') {
    // App vuelve al primer plano
    handleAppForeground();
  } else if (nextAppState.match(/inactive|background/)) {
    // App pasa a segundo plano
    handleAppBackground();
  }
};
```

### 2. Hook useAppState Personalizado

Se creó un hook personalizado para manejar el estado de la aplicación:

```typescript
// En hooks/useAppState.ts
export const useAppState = (options: UseAppStateOptions = {}) => {
  // Maneja cambios de estado y limpia alertas automáticamente
};
```

### 3. Componente SafeAlert

Se implementó un componente que maneja alertas de manera segura:

```typescript
// En components/SafeAlert.tsx
export const SafeAlert: React.FC = () => {
  // Se limpia automáticamente cuando la app pasa a segundo plano
};
```

### 4. AuthGuard Mejorado

Se mejoró el AuthGuard con timeouts de seguridad y manejo de errores:

```typescript
// En components/AuthGuard.tsx
// Timeout de seguridad para evitar pantallas en negro indefinidas
useEffect(() => {
  const safetyTimer = setTimeout(() => {
    if (isLoading) {
      setShowTimeoutMessage(true);
    }
  }, config.TIMEOUTS.SAFETY_TIMEOUT);
}, [isLoading]);
```

### 5. Configuración Centralizada

Se creó un sistema de configuración para manejar timeouts y comportamientos:

```typescript
// En config/appConfig.ts
export const APP_CONFIG = {
  TIMEOUTS: {
    AUTH_LOADING: 10000,
    SAFETY_TIMEOUT: 15000,
    REDIRECT_ATTEMPTS: 3,
  }
};
```

## Cómo Usar las Soluciones

### 1. Para Alertas Seguras

```typescript
import { useSafeAlert } from '@/components/SafeAlert';

const MyComponent = () => {
  const { showAlert } = useSafeAlert();
  
  const handleShowAlert = () => {
    showAlert({
      title: 'Título',
      message: 'Mensaje',
      buttons: [{ text: 'OK' }]
    });
  };
};
```

### 2. Para Manejar Estado de la App

```typescript
import { useAppState } from '@/hooks/useAppState';

const MyComponent = () => {
  const { currentAppState } = useAppState({
    onForeground: () => {
      // App vuelve al primer plano
    },
    onBackground: () => {
      // App pasa a segundo plano
    }
  });
};
```

### 3. Para Configuración Personalizada

```typescript
import { getAppConfig } from '@/config/appConfig';

const config = getAppConfig();
console.log('Timeout de seguridad:', config.TIMEOUTS.SAFETY_TIMEOUT);
```

## Prevención de Problemas

### 1. Siempre Usar SafeAlert

En lugar de `Alert.alert()` directo, usar el componente `SafeAlert`:

```typescript
// ❌ Malo
Alert.alert('Título', 'Mensaje');

// ✅ Bueno
const { showAlert } = useSafeAlert();
showAlert({ title: 'Título', message: 'Mensaje' });
```

### 2. Manejar Estados de Carga

Siempre mostrar estados de carga apropiados:

```typescript
if (isLoading) {
  return <LoadingComponent />;
}
```

### 3. Usar Timeouts de Seguridad

Implementar timeouts para operaciones que pueden colgar:

```typescript
const safetyTimer = setTimeout(() => {
  // Lógica de recuperación
}, config.TIMEOUTS.SAFETY_TIMEOUT);
```

## Debugging

### 1. Verificar Logs

Los logs muestran el estado de la aplicación:

```
useAppState: Cambio de estado: active -> background
SafeAlert: App pasa a segundo plano, limpiando alerta activa
AuthGuard: Timeout de seguridad alcanzado, forzando estado de carga
```

### 2. Verificar Estado de la App

```typescript
import { AppState } from 'react-native';
console.log('Estado actual:', AppState.currentState);
```

### 3. Verificar Contexto de Autenticación

```typescript
const { user, isLoading, token } = useAuth();
console.log('Estado de auth:', { user: !!user, isLoading, hasToken: !!token });
```

## Solución de Problemas Comunes

### 1. Pantalla en Negro Persistente

```typescript
// Forzar recarga de la app
window.location.reload();

// O limpiar estado manualmente
setIsLoading(false);
setUser(null);
```

### 2. Alertas que No se Cierran

```typescript
// Usar SafeAlert en lugar de Alert directo
import { useSafeAlert } from '@/components/SafeAlert';
```

### 3. Estados de Carga Infinitos

```typescript
// Implementar timeout de seguridad
useEffect(() => {
  const timer = setTimeout(() => {
    setIsLoading(false);
  }, 10000);
  
  return () => clearTimeout(timer);
}, []);
```

## Configuración de Entorno

### Desarrollo
- Timeouts más cortos para debugging
- Logs detallados habilitados
- Recuperación automática habilitada

### Producción
- Timeouts más largos para estabilidad
- Logs mínimos
- Recuperación automática deshabilitada

## Notas Importantes

1. **Nunca usar `Alert.alert()` directamente** - siempre usar `SafeAlert`
2. **Implementar timeouts de seguridad** para todas las operaciones asíncronas
3. **Manejar cambios de estado de la app** en todos los componentes críticos
4. **Limpiar estado temporal** cuando la app pasa a segundo plano
5. **Usar la configuración centralizada** para mantener consistencia

## Contacto

Si persisten los problemas, revisar:
- Logs de la consola
- Estado del contexto de autenticación
- Configuración de timeouts
- Implementación de SafeAlert en todos los componentes
