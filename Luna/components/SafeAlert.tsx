import React, { useEffect, useRef } from 'react';
import { Alert, AlertButton } from 'react-native';
import { useAppState } from '@/hooks/useAppState';

interface SafeAlertOptions {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
}

interface SafeAlertRef {
  show: (options: SafeAlertOptions) => void;
  hide: () => void;
}

export const SafeAlert: React.FC = () => {
  const alertRef = useRef<SafeAlertRef>(null);
  const currentAlertId = useRef<string | null>(null);

  // Usar el hook de estado de la app para limpiar alertas
  const { registerAlert, unregisterAlert } = useAppState({
    onBackground: () => {
      // Cuando la app pasa a segundo plano, limpiar alertas activas
      if (currentAlertId.current) {
        console.log('SafeAlert: App pasa a segundo plano, limpiando alerta activa');
        hideCurrentAlert();
      }
    }
  });

  // Registrar este componente como una alerta activa
  useEffect(() => {
    if (alertRef.current) {
      registerAlert(alertRef.current);
    }

    return () => {
      if (alertRef.current) {
        unregisterAlert(alertRef.current);
      }
    };
  }, [registerAlert, unregisterAlert]);

  const showAlert = (options: SafeAlertOptions) => {
    try {
      const alertId = `alert_${Date.now()}`;
      currentAlertId.current = alertId;

      console.log('SafeAlert: Mostrando alerta:', alertId);

      Alert.alert(
        options.title || 'Alerta',
        options.message || '',
        options.buttons || [
          {
            text: 'OK',
            onPress: () => {
              console.log('SafeAlert: Alerta cerrada por usuario');
              currentAlertId.current = null;
              options.onDismiss?.();
            }
          }
        ],
        {
          cancelable: options.cancelable !== false,
          onDismiss: () => {
            console.log('SafeAlert: Alerta cerrada por cancelación');
            currentAlertId.current = null;
            options.onDismiss?.();
          }
        }
      );
    } catch (error) {
      console.error('SafeAlert: Error mostrando alerta:', error);
      currentAlertId.current = null;
    }
  };

  const hideCurrentAlert = () => {
    if (currentAlertId.current) {
      console.log('SafeAlert: Ocultando alerta activa:', currentAlertId.current);
      currentAlertId.current = null;
      // En React Native, no podemos "ocultar" una alerta programáticamente
      // Pero podemos limpiar el estado
    }
  };

  // Exponer métodos a través de ref
  useEffect(() => {
    if (alertRef.current) {
      alertRef.current.show = showAlert;
      alertRef.current.hide = hideCurrentAlert;
    }
  }, []);

  // Este componente no renderiza nada visual
  return null;
};

// Hook para usar SafeAlert
export const useSafeAlert = () => {
  const alertRef = useRef<SafeAlertRef>(null);

  const showAlert = (options: SafeAlertOptions) => {
    if (alertRef.current) {
      alertRef.current.show(options);
    } else {
      // Fallback a Alert normal si SafeAlert no está disponible
      console.warn('SafeAlert no disponible, usando Alert normal');
      Alert.alert(
        options.title || 'Alerta',
        options.message || '',
        options.buttons || [{ text: 'OK' }]
      );
    }
  };

  const hideAlert = () => {
    if (alertRef.current) {
      alertRef.current.hide();
    }
  };

  return {
    alertRef,
    showAlert,
    hideAlert
  };
};

// Función de utilidad para mostrar alertas seguras
export const showSafeAlert = (options: SafeAlertOptions) => {
  // Esta función se puede usar directamente sin el hook
  // pero es menos segura que usar el componente SafeAlert
  console.warn('showSafeAlert: Usando método menos seguro, considera usar SafeAlert component');
  
  Alert.alert(
    options.title || 'Alerta',
    options.message || '',
    options.buttons || [{ text: 'OK' }],
    {
      cancelable: options.cancelable !== false,
      onDismiss: options.onDismiss
    }
  );
};

export default SafeAlert;
