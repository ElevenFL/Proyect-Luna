import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppState } from '@/hooks/useAppState';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import SafeAlert from '@/components/SafeAlert';
import { ONBOARDING_CONFIG, needsOnboarding, getDestinationRoute } from '@/config/onboardingConfig';
import '@/config/amplify'; // Inicializar Amplify

// Componente de redirección inicial
function InitialRedirect() {
  const { user, isLoading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const currentRoute = usePathname();

  useEffect(() => {
    if (!isLoading && !isRedirecting) {
      setIsRedirecting(true);
      
      // Si el usuario está autenticado, verificar el estado del perfil
      if (user) {
        if (user.profileCompleted) {
          // Usuario con perfil completo, verificar si está en la ruta correcta
          if (!currentRoute.startsWith('/(tabs)')) {
            console.log('🔄 Redirección inicial: Usuario con perfil completo -> tabs');
            // La redirección se manejará en el AuthGuard
          }
        } else {
          // Usuario sin perfil completo, verificar si está en la ruta correcta
          if (!currentRoute.startsWith('/onboarding')) {
            console.log('🔄 Redirección inicial: Usuario sin perfil completo -> onboarding');
            // La redirección se manejará en el AuthGuard
          }
        }
      } else {
        // Usuario no autenticado, verificar si está en la ruta correcta
        if (!currentRoute.startsWith('/(auth)')) {
          console.log('🔄 Redirección inicial: Usuario no autenticado -> login');
          // La redirección se manejará en el AuthGuard
        }
      }
    }
  }, [user, isLoading, isRedirecting, currentRoute]);

  return null; // Este componente no renderiza nada visual
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
        <SafeAlert />
      </ThemeProvider>
    </AuthProvider>
  );
}
