import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { validateSocketIO } from '../config/socketConfig';
import { testSocketIOInitialization } from '../utils/socketTest';

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Reducir el delay de inicialización
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Verificar que el entorno esté listo
        if (typeof window !== 'undefined' || typeof global !== 'undefined') {
          // Validar Socket.IO
          if (!validateSocketIO()) {
            throw new Error('Socket.IO no está configurado correctamente');
          }
          
          // Probar inicialización de Socket.IO
          const socketIOReady = await testSocketIOInitialization();
          if (!socketIOReady) {
            throw new Error('Socket.IO no se pudo inicializar correctamente');
          }
          
          setIsInitialized(true);
        } else {
          throw new Error('Entorno no disponible');
        }
      } catch (error) {
        console.error('Error inicializando la app:', error);
        setInitializationError(error instanceof Error ? error.message : 'Error desconocido');
        // Aún así, intentar continuar después de un delay
        setTimeout(() => setIsInitialized(true), 1000);
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#F9C80E" />
        <Text style={styles.loadingText}>
          Inicializando aplicación...
        </Text>
        {initializationError && (
          <Text style={styles.errorText}>
            {initializationError}
          </Text>
        )}
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a'
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16
  },
  errorText: {
    color: '#FF6B6B',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center'
  }
});
