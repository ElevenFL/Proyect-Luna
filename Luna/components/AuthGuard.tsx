import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requireAuth = true, 
  redirectTo = '/login' 
}) => {
  const { user, isLoading } = useAuth();

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#1a1a1a'
      }}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 16 }}>
          Verificando autenticación...
        </Text>
      </View>
    );
  }

  // Si requiere autenticación y no hay usuario, redirigir
  if (requireAuth && !user) {
    // Usar setTimeout para evitar problemas de navegación durante el render
    setTimeout(() => {
      router.replace(redirectTo);
    }, 0);
    
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#1a1a1a'
      }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>
          Redirigiendo...
        </Text>
      </View>
    );
  }

  // Si no requiere autenticación y hay usuario, redirigir a la app principal
  if (!requireAuth && user) {
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 0);
    
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#1a1a1a'
      }}>
        <Text style={{ color: '#fff', fontSize: 16 }}>
          Redirigiendo...
        </Text>
      </View>
    );
  }

  // Renderizar children si todo está bien
  return <>{children}</>;
};
