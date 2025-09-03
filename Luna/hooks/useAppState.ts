import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface UseAppStateOptions {
  onForeground?: () => void;
  onBackground?: () => void;
  onInactive?: () => void;
  cleanupOnBackground?: boolean;
}

export const useAppState = (options: UseAppStateOptions = {}) => {
  const {
    onForeground,
    onBackground,
    onInactive,
    cleanupOnBackground = true
  } = options;

  const appState = useRef(AppState.currentState);
  const alertRefs = useRef<Set<any>>(new Set());

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('useAppState: Cambio de estado:', appState.current, '->', nextAppState);

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App vuelve al primer plano
        console.log('useAppState: App vuelve al primer plano');
        onForeground?.();
      } else if (nextAppState.match(/inactive|background/)) {
        // App pasa a segundo plano
        console.log('useAppState: App pasa a segundo plano');
        
        if (cleanupOnBackground) {
          // Limpiar alertas y modales activos
          cleanupActiveAlerts();
        }
        
        onBackground?.();
      } else if (nextAppState === 'inactive') {
        // App se vuelve inactiva (ej: notificación, llamada)
        console.log('useAppState: App se vuelve inactiva');
        onInactive?.();
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [onForeground, onBackground, onInactive, cleanupOnBackground]);

  // Función para registrar alertas activas
  const registerAlert = (alertRef: any) => {
    alertRefs.current.add(alertRef);
  };

  // Función para desregistrar alertas
  const unregisterAlert = (alertRef: any) => {
    alertRefs.current.delete(alertRef);
  };

  // Función para limpiar todas las alertas activas
  const cleanupActiveAlerts = () => {
    console.log('useAppState: Limpiando alertas activas...');
    
    // Aquí puedes implementar la lógica para cerrar alertas específicas
    // Por ejemplo, si usas react-native-alert, podrías cerrar todas las alertas activas
    
    alertRefs.current.clear();
  };

  // Función para forzar limpieza
  const forceCleanup = () => {
    cleanupActiveAlerts();
  };

  return {
    currentAppState: appState.current,
    registerAlert,
    unregisterAlert,
    cleanupActiveAlerts,
    forceCleanup
  };
};
