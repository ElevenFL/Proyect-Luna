import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VerifyScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    // Guardar la información del usuario para uso posterior
    const usernameFromParams = params.username as string;
    const emailFromParams = params.email as string;
    
    if (usernameFromParams) {
      AsyncStorage.setItem('pendingUsername', usernameFromParams);
      if (emailFromParams) {
        AsyncStorage.setItem('pendingEmail', emailFromParams);
      }
    }
  }, [params]);

  const handleOpenEmailApp = async () => {
    try {
      // Intentar abrir la aplicación de email predeterminada
      await Linking.openURL('mailto:');
      
      // Después de abrir la app de email, redirigir al login
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 500);
    } catch (error) {
      console.error('Error abriendo aplicación de email:', error);
      // Si hay error, igual redirigir al login
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <Text style={styles.logo}>Lunae</Text>
        
        {/* Icono de email */}
        <Text style={styles.emailIcon}>📧</Text>
        
        <Text style={styles.title}>Verificación enviada</Text>
        
        <Text style={styles.subtitle}>
          Hemos enviado un email de verificación a tu dirección.
          Por favor, revisa tu bandeja de entrada y haz clic en el enlace de verificación.
        </Text>

        {/* Botón principal para abrir email */}
        <TouchableOpacity
          style={styles.emailButton}
          onPress={handleOpenEmailApp}
        >
          <Text style={styles.emailButtonText}>Abrir Email</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Al hacer clic en el botón, se abrirá tu aplicación de email y serás redirigido al login.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 30,
  },
  emailIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  emailButton: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 30,
    minWidth: 200,
  },
  emailButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  note: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
