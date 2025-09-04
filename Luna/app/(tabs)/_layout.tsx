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
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            paddingTop: 13,
            paddingHorizontal: 10,
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarAllowFontScaling: false,
          headerShown: false, // Esto oculta el header en todas las pantallas
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
      </Tabs>
    </AuthGuard>
  );
}