import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { ChatProvider } from '@/contexts/ChatProvider';
import { PrefetchProvider } from '@/contexts/PrefetchContext';
import { StoriesProvider } from '@/contexts/StoriesContext';
import SafeAlert from '@/components/SafeAlert';
import { AppInitializer } from '@/components/AppInitializer';
import { Colors } from '@/constants/Colors';
import '@/config/amplify'; // Inicializar Amplify

const isDevelopment = __DEV__;

// Prevenir que la splash screen se oculte automáticamente
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      // Ocultar splash screen cuando las fuentes estén listas
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // Configurar el color de la barra de navegación del sistema en Android
  useEffect(() => {
    const configureSystemUI = async () => {
      if (Platform.OS === 'android') {
        const isDark = colorScheme === 'dark';
        const backgroundColor = isDark ? Colors.dark.background : Colors.light.background;
        
        try {
          // Configurar el color de fondo de la barra de navegación
          await SystemUI.setBackgroundColorAsync(backgroundColor);
        } catch (error) {
          console.log('Error configurando SystemUI:', error);
        }
      }
    };
    
    configureSystemUI();
  }, [colorScheme]);

  // No retornar null - en su lugar, dejar que SplashScreen maneje la carga
  if (!loaded && !error) {
    return null;
  }

  return (
    <AppInitializer>
      <AuthProvider>
        <PrefetchProvider>
          <ConversationProvider>
            <ChatProvider>
              <StoriesProvider>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}
                >
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="user-profile" />
                  <Stack.Screen name="chat/[userId]" />
                  <Stack.Screen name="create-story" />
                  <Stack.Screen name="view-stories" />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style="auto" />
                <SafeAlert />
                {isDevelopment && (
                  <View style={{ position: 'absolute', top: 80, right: 10, zIndex: 9999 }}>
                  </View>
                )}
                </ThemeProvider>
              </StoriesProvider>
            </ChatProvider>
          </ConversationProvider>
        </PrefetchProvider>
      </AuthProvider>
    </AppInitializer>
  );
}
