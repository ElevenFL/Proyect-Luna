import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { ChatProvider } from '@/contexts/ChatProvider';
import SafeAlert from '@/components/SafeAlert';
import { AppInitializer } from '@/components/AppInitializer';
import '@/config/amplify'; // Inicializar Amplify

const isDevelopment = __DEV__;


export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Pequeño delay para asegurar que el contexto de React esté completamente inicializado
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!loaded || !isReady) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AppInitializer>
      <AuthProvider>
        <ConversationProvider>
          <ChatProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="user-profile" options={{ headerShown: false }} />
                <Stack.Screen name="chat/[userId]" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
              <SafeAlert />
              {isDevelopment && (
                <View style={{ position: 'absolute', top: 80, right: 10, zIndex: 9999 }}>
                </View>
              )}
            </ThemeProvider>
          </ChatProvider>
        </ConversationProvider>
      </AuthProvider>
    </AppInitializer>
  );
}
