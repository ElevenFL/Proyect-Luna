import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router, useSegments } from 'expo-router';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  React.useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inOnboardingGroup = segments[0] === 'onboarding';
    const inAuthScreens = segments[0] === 'login' || segments[0] === 'register';

    if (!user && inAuthGroup) {
      // Usuario no autenticado intentando acceder a rutas protegidas
      router.replace('/login');
    } else if (user && inAuthScreens) {
      // Usuario autenticado en pantallas de auth, verificar si necesita onboarding
      if (!user.profileCompleted) {
        router.replace('/onboarding/welcome');
      } else {
        router.replace('/(tabs)');
      }
    } else if (user && !inAuthGroup && !inOnboardingGroup && !inAuthScreens) {
      // Usuario autenticado pero no en ninguna pantalla específica
      if (!user.profileCompleted) {
        router.replace('/onboarding/welcome');
      } else {
        router.replace('/(tabs)');
      }
    } else if (user && inAuthGroup && !user.profileCompleted) {
      // Usuario autenticado en tabs pero sin perfil completo
      router.replace('/onboarding/welcome');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
});
