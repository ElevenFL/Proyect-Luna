import { Tabs } from 'expo-router';
import { AuthGuard } from '@/components/AuthGuard';
import { Ionicons } from '@expo/vector-icons';
import { TouchableWithoutFeedback, View } from 'react-native';
import EstrellaIcon from '@/components/EstrellaIcon';
import CasaIcon from '@/components/CasaIcon';
import ChatIcon from '@/components/ChatIcon';

export default function TabLayout() {
  return (
    <AuthGuard requireAuth={true}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#F9C80E',
          tabBarInactiveTintColor: '#FFFFFF',
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'rgba(26, 26, 26, 1)', // Fondo semi-transparente oscuro
            borderTopWidth: 0,
            elevation: 10,
            paddingTop: 10,
            paddingHorizontal: 10,
            marginBottom: 0,
            bottom: 0,
            left: 0,
            right: 0,
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
              <CasaIcon size={28} color={color} />
            ),
            tabBarLabel: () => null,
            tabBarIconStyle: { alignSelf: 'center' },
          }}
        />
  
        <Tabs.Screen
          name="messages"
          options={{
            tabBarIcon: ({ color }) => (
              <ChatIcon size={28} color={color} />
            ),
            tabBarLabel: () => null,
            tabBarIconStyle: { alignSelf: 'center' },
          }}
        />

        <Tabs.Screen
          name="community"
          options={{
            tabBarIcon: ({ color }) => (
              <EstrellaIcon size={30} color={color} />
            ),
            tabBarLabel: () => null,
            tabBarIconStyle: { alignSelf: 'center' },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color }) => (
              <Ionicons name="person" size={30} color={color} />
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