import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="name" />
      <Stack.Screen name="birthdate" />
      <Stack.Screen name="gender" />
      <Stack.Screen name="photo" />
      <Stack.Screen name="location" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
