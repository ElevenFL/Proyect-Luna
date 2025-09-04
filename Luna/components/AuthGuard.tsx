import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router, usePathname } from 'expo-router';
import { getAppConfig } from '@/config/appConfig';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: '/login' | '/(auth)/login' | '/(auth)/welcome' | '/(tabs)';
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requireAuth = true, 
  redirectTo = '/(auth)/welcome' 
}) => {
  const { user, isLoading } = useAuth();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const config = getAppConfig();
  const currentRoute = usePathname();

  // Efecto para manejar la redirección cuando el usuario se desautentica
  useEffect(() => {
    if (!isLoading && requireAuth && !user && !isRedirecting) {
      console.log('AuthGuard: Usuario no autenticado, redirigiendo a:', redirectTo);
      setIsRedirecting(true);
      
      // Intentar redirección con timeout de seguridad
      const redirectTimer = setTimeout(() => {
        if (redirectAttempts < config.TIMEOUTS.REDIRECT_ATTEMPTS) {
          console.log('AuthGuard: Reintentando redirección...');
          setRedirectAttempts(prev => prev + 1);
          router.replace(redirectTo);
        } else {
          console.log('AuthGuard: Múltiples intentos de redirección fallidos, mostrando mensaje de error');
          setShowTimeoutMessage(true);
          setIsRedirecting(false);
        }
      }, config.TIMEOUTS.REDIRECT_DELAY);

      return () => clearTimeout(redirectTimer);
    }
  }, [user, isLoading, requireAuth, redirectTo, redirectAttempts, config, isRedirecting]);

  // Efecto para verificar si el usuario necesita completar el perfil
  useEffect(() => {
    if (!isLoading && user && requireAuth && !isRedirecting) {
      // Si el usuario está en las tabs pero no tiene el perfil completado, redirigir al onboarding
      if (!user.profileCompleted && currentRoute.includes('/(tabs)')) {
        console.log('AuthGuard: Usuario sin perfil completo, redirigiendo al onboarding');
        setIsRedirecting(true);
        router.replace('/onboarding/welcome' as any);
        return;
      }
      
      // Si el usuario está en el onboarding pero ya tiene el perfil completo, redirigir a las tabs
      if (user.profileCompleted && currentRoute.includes('/onboarding')) {
        console.log('AuthGuard: Usuario con perfil completo, redirigiendo a las tabs');
        setIsRedirecting(true);
        router.replace('/(tabs)' as any);
        return;
      }
      
      // Si el usuario está en la página de login pero ya está autenticado, redirigir según el estado del perfil
      if (currentRoute.includes('/(auth)/login') && user) {
        setIsRedirecting(true);
        if (user.profileCompleted) {
          console.log('AuthGuard: Usuario autenticado con perfil completo, redirigiendo a las tabs');
          router.replace('/(tabs)' as any);
        } else {
          console.log('AuthGuard: Usuario autenticado sin perfil completo, redirigiendo al onboarding');
          router.replace('/onboarding/welcome' as any);
        }
        return;
      }
    }
  }, [user, isLoading, requireAuth, currentRoute, isRedirecting]);

  // Timeout de seguridad para evitar pantallas en negro indefinidas
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        console.log('AuthGuard: Timeout de seguridad alcanzado, forzando estado de carga');
        setShowTimeoutMessage(true);
      }
    }, config.TIMEOUTS.SAFETY_TIMEOUT);

    return () => clearTimeout(safetyTimer);
  }, [isLoading, config.TIMEOUTS.SAFETY_TIMEOUT]);

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading && !showTimeoutMessage) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>
          Verificando autenticación...
        </Text>
      </View>
    );
  }

  // Si hay timeout o error, mostrar mensaje de recuperación
  if (showTimeoutMessage) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Error de carga
        </Text>
        <Text style={styles.errorSubtext}>
          La aplicación está tardando en cargar
        </Text>
        <Text style={styles.retryText} onPress={() => {
          setShowTimeoutMessage(false);
          setRedirectAttempts(0);
          setIsRedirecting(false);
          // Reiniciar el proceso de autenticación
          router.replace('/(auth)/welcome');
        }}>
          Toca para reintentar
        </Text>
      </View>
    );
  }

  // Si requiere autenticación y no hay usuario, mostrar mensaje de redirección
  if (requireAuth && !user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>
          Redirigiendo al login...
        </Text>
      </View>
    );
  }

  // Si no requiere autenticación y hay usuario, redirigir a la app principal
  if (!requireAuth && user) {
    React.useEffect(() => {
      const timer = setTimeout(() => {
        if (user.profileCompleted) {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding/welcome');
        }
      }, 100);
      return () => clearTimeout(timer);
    }, [user]);
    
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>
          Redirigiendo...
        </Text>
      </View>
    );
  }

  // Renderizar children si todo está bien
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
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8
  },
  errorSubtext: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center'
  },
  retryText: {
    color: '#FFD700',
    fontSize: 16,
    textDecorationLine: 'underline'
  }
});
