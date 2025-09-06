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

  // Efecto unificado para manejar todas las redirecciones
  useEffect(() => {
    if (isLoading || isRedirecting) return;

    console.log('AuthGuard: Evaluando redirección...', { 
      user: !!user, 
      requireAuth, 
      currentRoute,
      profileCompleted: user?.profileCompleted,
      userId: user?.id
    });

    const timer = setTimeout(() => {
      // Caso 1: Requiere autenticación pero no hay usuario
      if (requireAuth && !user) {
        console.log('AuthGuard: Usuario no autenticado, redirigiendo a:', redirectTo);
        setIsRedirecting(true);
        router.replace(redirectTo);
        return;
      }

      // Caso 2: No requiere autenticación pero hay usuario
      if (!requireAuth && user) {
        console.log('AuthGuard: Usuario autenticado en página pública, redirigiendo...');
        setIsRedirecting(true);
        if (user.profileCompleted) {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding/welcome');
        }
        return;
      }

      // Caso 3: Usuario autenticado pero en rutas incorrectas
      if (user && requireAuth) {
        const isInTabs = currentRoute.includes('/(tabs)');
        const isInOnboarding = currentRoute.includes('/onboarding');
        const isInAuth = currentRoute.includes('/(auth)');

        if (!user.profileCompleted && isInTabs) {
          console.log('AuthGuard: Usuario sin perfil completo, redirigiendo al onboarding');
          console.log('AuthGuard: profileCompleted =', user.profileCompleted);
          setIsRedirecting(true);
          router.replace('/onboarding/welcome');
          return;
        }

        if (user.profileCompleted && isInOnboarding) {
          console.log('AuthGuard: Usuario con perfil completo, redirigiendo a las tabs');
          setIsRedirecting(true);
          router.replace('/(tabs)');
          return;
        }

        // Caso especial: Si estamos en /onboarding/complete y el perfil está completo, permitir continuar
        if (currentRoute === '/onboarding/complete' && user.profileCompleted) {
          console.log('AuthGuard: En pantalla de completado con perfil completo, permitiendo continuar');
          return;
        }

        if (isInAuth) {
          console.log('AuthGuard: Usuario autenticado en páginas de auth, redirigiendo...');
          setIsRedirecting(true);
          if (user.profileCompleted) {
            router.replace('/(tabs)');
          } else {
            router.replace('/onboarding/welcome');
          }
          return;
        }
      }

      // Si llegamos aquí, resetear el estado de redirección
      setIsRedirecting(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [user, isLoading, requireAuth, redirectTo, currentRoute]);

  // Efecto para manejar reintentos de redirección fallidos
  useEffect(() => {
    if (isRedirecting && !isLoading) {
      const failsafeTimer = setTimeout(() => {
        if (redirectAttempts < config.TIMEOUTS.REDIRECT_ATTEMPTS) {
          console.log('AuthGuard: Reintentando redirección fallida...');
          setRedirectAttempts(prev => prev + 1);
          setIsRedirecting(false); // Permitir nuevo intento
        } else {
          console.log('AuthGuard: Múltiples intentos fallidos, mostrando error');
          setShowTimeoutMessage(true);
          setIsRedirecting(false);
        }
      }, config.TIMEOUTS.REDIRECT_DELAY * 2);

      return () => clearTimeout(failsafeTimer);
    }
  }, [isRedirecting, isLoading, redirectAttempts, config]);

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