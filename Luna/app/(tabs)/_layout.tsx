import { Tabs } from 'expo-router';
import { AuthGuard } from '@/components/AuthGuard';
import { Ionicons } from '@expo/vector-icons';
import { TouchableWithoutFeedback, View } from 'react-native';

export default function TabLayout() {
  return (
    <AuthGuard requireAuth={true}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#F9C80E',
          tabBarInactiveTintColor: '#FFFFFF',
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'rgba(26, 26, 26, 0.95)', // Fondo semi-transparente oscuro
            borderTopWidth: 0,
            elevation: 0,
            paddingTop: 13,
            paddingHorizontal: 10,
            bottom: 0,
            left: 0,
            right: 0,
            backdropFilter: 'blur(10px)', // Efecto de desenfoque (si está disponible)
          },
          tabBarAllowFontScaling: false,
          headerShown: false,
          tabBarButton: ({ children, onPress }) => (
            <TouchableWithoutFeedback onPress={onPress}>
              <View>{children}</View>
            </TouchableWithoutFeedback>
          ),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="home" size={28} color={color} />
            ),
            tabBarLabel: () => null,
            tabBarIconStyle: { alignSelf: 'center' },
          }}
        />
  
        <Tabs.Screen
          name="messages"
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubbles" size={28} color={color} />
            ),
            tabBarLabel: () => null,
            tabBarIconStyle: { alignSelf: 'center' },
          }}
        />

        <Tabs.Screen
          name="community"
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="people" size={28} color={color} />
            ),
            tabBarLabel: () => null,
            tabBarIconStyle: { alignSelf: 'center' },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="person" size={28} color={color} />
            ),
            tabBarLabel: () => null,
            tabBarIconStyle: { alignSelf: 'center' },
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            href: null, // Ocultar del tab bar pero mantener la ruta accesible
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}