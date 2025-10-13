import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import LuneaLogo from '@/components/LuneaLogo';

export default function LoginScreen() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    // Limpiar mensaje de error anterior
    setErrorMessage('');
    
    if (!usernameOrEmail || !password) {
      setErrorMessage('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    const result = await login(usernameOrEmail, password);
    setIsLoading(false);

    if (result.success) {
      // Verificar si el usuario necesita completar el onboarding
      console.log('🔍 Login exitoso - Verificando estado del perfil:', {
        hasUser: !!result.user,
        profileCompleted: result.user?.profileCompleted,
        userId: result.user?.id,
        hasDisplayName: !!result.user?.displayName,
        hasLocation: !!result.user?.location,
        hasProfileImage: !!result.user?.profileImage
      });
      
      // Confiar en el campo profileCompleted de la base de datos
      // Si es true, el usuario ya completó el onboarding
      const shouldGoToOnboarding = result.user && !result.user.profileCompleted;
      
      if (shouldGoToOnboarding) {
        console.log('🔀 Usuario con perfil incompleto, redirigiendo al onboarding');
        router.replace('/onboarding/welcome');
      } else {
        console.log('✅ Usuario con perfil completo, redirigiendo a las tabs');
        router.replace('/(tabs)');
      }
    } else {
      if (result.error === 'USER_NOT_CONFIRMED') {
        // Usuario no confirmado - redirigir automáticamente a verificación
        router.push({
          pathname: '/(auth)/verify',
          params: { username: usernameOrEmail }
        });
      } else if (result.error === 'INVALID_CREDENTIALS') {
        setErrorMessage(result.message);
      } else {
        setErrorMessage(result.message);
      }
    }
  };

  const goToRegister = () => {
    router.push('/(auth)/register');
  };

  const handleUsernameChange = (text: string) => {
    setUsernameOrEmail(text);
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <LuneaLogo width={200} height={80} />
          </View>
          <Text style={styles.title}>Login</Text>

          {/* Username or Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username o Email</Text>
            <TextInput
              style={[styles.input, errorMessage && styles.inputError]}
              value={usernameOrEmail}
              onChangeText={handleUsernameChange}
              placeholder="Ingresa tu username o email"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordContainer, errorMessage && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={handlePasswordChange}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Forgot Password */}
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.loginButtonText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Register Link */}
          <TouchableOpacity onPress={goToRegister}>
            <Text style={styles.registerText}>
              Not a member? <Text style={styles.registerLink}>Create account</Text>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  inputError: {
    borderColor: '#FF4444',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  eyeIcon: {
    fontSize: 20,
    color: '#FFD700',
  },
  errorContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#ccc',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#FFD700',
    marginBottom: 20,
  },
  registerText: {
    color: '#ccc',
    textAlign: 'center',
    fontSize: 16,
  },
  registerLink: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
});
