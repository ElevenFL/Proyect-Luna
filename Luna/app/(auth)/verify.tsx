import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from '@/config/amplify';
import ApiService from '@/services/apiService'; // Importar ApiService para sincronización

export default function VerifyScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCount, setResendCount] = useState(0);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const { user } = useAuth();
  const params = useLocalSearchParams();

  useEffect(() => {
    loadPendingUserInfo();
  }, []);

  // Efecto para detectar cuando el usuario se autentica después de la verificación
  useEffect(() => {
    if (user) {
      // Si el usuario está autenticado, verificar si necesita completar el perfil
      if (!user.profileCompleted) {
        console.log('Usuario autenticado después de verificación, redirigiendo al onboarding');
        router.replace('/onboarding/welcome');
      } else {
        console.log('Usuario autenticado con perfil completo, redirigiendo al home');
        router.replace('/(tabs)');
      }
    }
  }, [user]);

  const loadPendingUserInfo = async () => {
    try {
      console.log('Cargando información de usuario pendiente...');
      console.log('Parámetros recibidos:', params);
      
      // Verificar si se pasó un username como parámetro
      const usernameFromParams = params.username as string;
      const emailFromParams = params.email as string;
      
      if (usernameFromParams) {
        console.log('Username desde parámetros:', usernameFromParams);
        setPendingUsername(usernameFromParams);
        await AsyncStorage.setItem('pendingUsername', usernameFromParams);
        
        if (emailFromParams) {
          setPendingEmail(emailFromParams);
          await AsyncStorage.setItem('pendingEmail', emailFromParams);
        }
        return;
      }

      // Cargar desde AsyncStorage
      const storedUsername = await AsyncStorage.getItem('pendingUsername');
      const storedEmail = await AsyncStorage.getItem('pendingEmail');
      
      console.log('Username desde AsyncStorage:', storedUsername);
      console.log('Email desde AsyncStorage:', storedEmail);
      
      if (storedUsername) {
        setPendingUsername(storedUsername);
        if (storedEmail) {
          setPendingEmail(storedEmail);
        }
      } else {
        // Si no hay username pendiente, mostrar error
        console.log('No se encontró información de verificación');
        Alert.alert(
          'Error',
          'No se encontró información de verificación. Por favor, regístrate nuevamente.',
          [
            {
              text: 'Registrarse',
              onPress: () => router.replace('/(auth)/register')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error cargando información de usuario pendiente:', error);
    }
  };

  const handleOpenEmailApp = () => {
    if (pendingEmail) {
      // Intentar abrir la aplicación de email predeterminada
      Linking.openURL(`mailto:${pendingEmail}`);
    } else {
      Alert.alert('Error', 'No se encontró la dirección de email');
    }
  };

  const handleCheckVerification = async () => {
    if (!pendingUsername) {
      Alert.alert('Error', 'No se encontró información de usuario');
      return;
    }

    setIsCheckingVerification(true);
    
    try {
      // Intentar obtener la sesión actual para verificar si el usuario ya está verificado
      const session = await Auth.fetchAuthSession();
      
      if (session.tokens && session.tokens.accessToken) {
        // El usuario está autenticado, lo que significa que ya verificó su email
        console.log('Usuario verificado y autenticado');
        
        // Obtener información del usuario de Amplify
        const currentUser = await Auth.getCurrentUser();
        const userAttributes = currentUser.signInDetails?.loginId || '';
        
        // Sincronizar con DynamoDB automáticamente
        try {
          console.log('Iniciando sincronización con DynamoDB...');
          const syncResponse = await ApiService.syncAmplifyUser(
            pendingUsername,
            userAttributes,
            currentUser.userId
          );
          
          if (syncResponse.success) {
            console.log('✅ Usuario sincronizado exitosamente con DynamoDB');
            console.log('Usuario ID:', syncResponse.data?.user?.id);
            console.log('Profile Completed:', syncResponse.data?.user?.profileCompleted);
          } else {
            console.log('⚠️ Error sincronizando usuario:', syncResponse.message);
            // Continuar con el flujo aunque haya error de sincronización
          }
        } catch (syncError) {
          console.error('❌ Error en sincronización con DynamoDB:', syncError);
          // Continuar con el flujo aunque haya error de sincronización
        }
        
        // Limpiar información pendiente
        await AsyncStorage.multiRemove(['pendingUsername', 'pendingEmail']);
        
        Alert.alert(
          '¡Verificación exitosa!', 
          'Tu email ha sido verificado correctamente. Ahora vamos a configurar tu perfil.',
          [
            {
              text: 'Continuar',
              onPress: () => {
                // El useEffect se encargará de la redirección cuando el usuario esté autenticado
                console.log('Verificación exitosa, esperando autenticación...');
              }
            }
          ]
        );
      } else {
        // El usuario aún no está verificado
        Alert.alert(
          'Email no verificado',
          'Tu email aún no ha sido verificado. Por favor, revisa tu bandeja de entrada y haz clic en el enlace de verificación.',
          [
            {
              text: 'Revisar Email',
              onPress: handleOpenEmailApp
            },
            {
              text: 'Verificar de nuevo',
              onPress: handleCheckVerification
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error verificando estado:', error);
      Alert.alert(
        'Error',
        'No se pudo verificar el estado de tu cuenta. Por favor, intenta de nuevo.',
        [
          {
            text: 'Reintentar',
            onPress: handleCheckVerification
          }
        ]
      );
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCount >= 3) {
      Alert.alert(
        'Límite excedido',
        'Has excedido el límite de reenvíos. Espera unos minutos antes de intentar nuevamente.',
        [
          {
            text: 'Ir a Login',
            onPress: () => router.replace('/(auth)/login')
          }
        ]
      );
      return;
    }

    if (!pendingUsername) {
      Alert.alert('Error', 'No se encontró información de usuario');
      return;
    }

    setIsResending(true);
    
    try {
      const result = await Auth.resendSignUpCode({
        username: pendingUsername
      });

      // Si no hay error, el email se reenvió exitosamente
      setResendCount(prev => prev + 1);
      Alert.alert(
        'Email reenviado', 
        `Se ha enviado un nuevo email de verificación a tu dirección. (${resendCount + 1}/3)`
      );
    } catch (error) {
      console.error('Error reenviando email:', error);
      
      if (error instanceof Error && error.name === 'LimitExceededException') {
        Alert.alert(
          'Límite excedido',
          'Has excedido el límite de reenvíos. Espera unos minutos antes de intentar nuevamente.',
          [
            {
              text: 'Ir a Login',
              onPress: () => router.replace('/(auth)/login')
            }
          ]
        );
      } else {
        Alert.alert('Error', 'No se pudo reenviar el email de verificación. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const goToLogin = () => {
    router.push('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Logo */}
          <Text style={styles.logo}>Lunae</Text>
          <Text style={styles.title}>Verificar Email</Text>
          
          <Text style={styles.subtitle}>
            Hemos enviado un email de verificación a tu dirección.
            Por favor, revisa tu bandeja de entrada y haz clic en el enlace de verificación.
          </Text>

          {pendingUsername && (
            <View style={styles.userInfoContainer}>
              <Text style={styles.userInfoText}>
                Verificando cuenta: <Text style={styles.usernameText}>{pendingUsername}</Text>
              </Text>
              {pendingEmail && (
                <Text style={styles.emailText}>
                  Email: {pendingEmail}
                </Text>
              )}
            </View>
          )}

          {/* Open Email App Button */}
          <TouchableOpacity
            style={styles.emailButton}
            onPress={handleOpenEmailApp}
          >
            <Text style={styles.emailButtonText}>📧 Abrir Aplicación de Email</Text>
          </TouchableOpacity>

          {/* Check Verification Button */}
          <TouchableOpacity
            style={[styles.verifyButton, isCheckingVerification && styles.verifyButtonDisabled]}
            onPress={handleCheckVerification}
            disabled={isCheckingVerification}
          >
            {isCheckingVerification ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.verifyButtonText}>Verificar Estado</Text>
            )}
          </TouchableOpacity>

          {/* Resend Email Button */}
          <TouchableOpacity
            style={[styles.resendButton, isResending && styles.resendButtonDisabled]}
            onPress={handleResendVerification}
            disabled={isResending}
          >
            {isResending ? (
              <ActivityIndicator color="#FFD700" size="small" />
            ) : (
              <Text style={styles.resendButtonText}>Reenviar Email</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Back to Login */}
          <TouchableOpacity onPress={goToLogin}>
            <Text style={styles.loginText}>
              ¿Ya tienes cuenta? <Text style={styles.loginLink}>Iniciar Sesión</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  userInfoContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  userInfoText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
  },
  usernameText: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  emailText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
  },
  emailButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  verifyButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  resendButtonDisabled: {
    opacity: 0.7,
  },
  resendButtonText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#FFD700',
    marginBottom: 20,
  },
  loginText: {
    color: '#ccc',
    textAlign: 'center',
    fontSize: 16,
  },
  loginLink: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
});
