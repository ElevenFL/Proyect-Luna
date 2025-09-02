import { Stack } from 'expo-router';
import { AuthGuard } from '@/components/AuthGuard';

export default function OnboardingLayout() {
  return (
    <AuthGuard requireAuth={true}>
      <Stack>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="name" options={{ headerShown: false }} />
        <Stack.Screen name="birthdate" options={{ headerShown: false }} />
        <Stack.Screen name="gender" options={{ headerShown: false }} />
        <Stack.Screen name="location" options={{ headerShown: false }} />
        <Stack.Screen name="photo" options={{ headerShown: false }} />
        <Stack.Screen name="complete" options={{ headerShown: false }} />
      </Stack>
    </AuthGuard>
  );
}
