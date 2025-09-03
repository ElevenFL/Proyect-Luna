import React, { useState, useMemo } from 'react';
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

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isOver18, setIsOver18] = useState(false);
  const [acceptsPrivacyPolicy, setAcceptsPrivacyPolicy] = useState(false);
  const { register } = useAuth();

  // Validación de email
  const emailValidation = useMemo(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    return { isValid };
  }, [email]);

  // Validación de contraseña en tiempo real
  const passwordValidation = useMemo(() => {
    const validations = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const isValid = Object.values(validations).every(Boolean);
    
    return { validations, isValid };
  }, [password]);

  const handleRegister = async () => {
    if (!username || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (!passwordValidation.isValid) {
      Alert.alert('Error', 'La contraseña no cumple con todos los requisitos de seguridad');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Error', 'El username debe tener al menos 3 caracteres');
      return;
    }

    if (!isOver18) {
      Alert.alert('Error', 'Debes ser mayor de 18 años para registrarte');
      return;
    }

    if (!acceptsPrivacyPolicy) {
      Alert.alert('Error', 'Debes aceptar el acuerdo de privacidad para continuar');
      return;
    }

    setIsLoading(true);
    const result = await register(username, email, password);
    setIsLoading(false);

    console.log('Resultado del registro:', result);

    if (result.success) {
      if (result.error === 'CONFIRMATION_REQUIRED') {
        console.log('Redirigiendo a verificación con username:', username);
        // Navegar a la pantalla de verificación con el username
        router.push({
          pathname: '/(auth)/verify',
          params: { username: username }
        });
      } else {
        console.log('Login automático exitoso');
        // Login automático exitoso
        router.replace('/(tabs)');
      }
    } else {
      if (result.error === 'USERNAME_EXISTS') {
        Alert.alert(
          'Usuario ya existe', 
          result.message,
          [
            {
              text: 'Ir a Login',
              onPress: () => router.push('/(auth)/login')
            },
            {
              text: 'Ir a Verificar',
              onPress: () => router.push({
                pathname: '/(auth)/verify',
                params: { username: username }
              })
            },
            {
              text: 'Cancelar',
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message);
      }
    }
  };

  const goToLogin = () => {
    router.push('/(auth)/login');
  };

  // Componente para mostrar las validaciones de contraseña
  const PasswordValidationIndicator = () => (
    <View style={styles.validationContainer}>
      <Text style={styles.validationTitle}>Requisitos de contraseña:</Text>
      <View style={styles.validationItem}>
        <Text style={[
          styles.validationText,
          passwordValidation.validations.length ? styles.validationSuccess : styles.validationError
        ]}>
          {passwordValidation.validations.length ? '✓' : '✗'} Mínimo 8 caracteres
        </Text>
      </View>
      <View style={styles.validationItem}>
        <Text style={[
          styles.validationText,
          passwordValidation.validations.lowercase ? styles.validationSuccess : styles.validationError
        ]}>
          {passwordValidation.validations.lowercase ? '✓' : '✗'} Al menos una minúscula
        </Text>
      </View>
      <View style={styles.validationItem}>
        <Text style={[
          styles.validationText,
          passwordValidation.validations.uppercase ? styles.validationSuccess : styles.validationError
        ]}>
          {passwordValidation.validations.uppercase ? '✓' : '✗'} Al menos una mayúscula
        </Text>
      </View>
      <View style={styles.validationItem}>
        <Text style={[
          styles.validationText,
          passwordValidation.validations.number ? styles.validationSuccess : styles.validationError
        ]}>
          {passwordValidation.validations.number ? '✓' : '✗'} Al menos un número
        </Text>
      </View>
      <View style={styles.validationItem}>
        <Text style={[
          styles.validationText,
          passwordValidation.validations.special ? styles.validationSuccess : styles.validationError
        ]}>
          {passwordValidation.validations.special ? '✓' : '✗'} Al menos un símbolo especial
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          {/* Logo */}
          <Text style={styles.logo}>Lunae</Text>
          <Text style={styles.title}>Signup</Text>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.input, (!username.trim() || username.length < 3) && username.length > 0 && styles.inputError]}
              value={username}
              onChangeText={setUsername}
              placeholder="Ingresa tu username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {username.length > 0 && (
              !username.trim() ? (
                <Text style={styles.errorText}>El username no puede estar vacío</Text>
              ) : username.length < 3 ? (
                <Text style={styles.errorText}>El username debe tener al menos 3 caracteres</Text>
              ) : (
                <Text style={styles.successText}>✓ Username válido</Text>
              )
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, (!email.trim() || !emailValidation.isValid) && email.length > 0 && styles.inputError]}
              value={email}
              onChangeText={setEmail}
              placeholder="Ingresa tu email"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {email.length > 0 && (
              !email.trim() ? (
                <Text style={styles.errorText}>El email no puede estar vacío</Text>
              ) : !emailValidation.isValid ? (
                <Text style={styles.errorText}>El formato del email no es válido</Text>
              ) : (
                <Text style={styles.successText}>✓ Email válido</Text>
              )
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Escribe tu contraseña"
                placeholderTextColor="#666"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            
            {/* Indicador de validación de contraseña - solo visible cuando está enfocado */}
            {isPasswordFocused && password.length > 0 && <PasswordValidationIndicator />}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirma tu contraseña"
                placeholderTextColor="#666"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            
            {/* Indicador de coincidencia de contraseñas */}
            {confirmPassword.length > 0 && (
              <View style={styles.confirmPasswordIndicator}>
                <Text style={[
                  styles.confirmPasswordText,
                  password === confirmPassword ? styles.validationSuccess : styles.validationError
                ]}>
                  {password === confirmPassword ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                </Text>
              </View>
            )}
          </View>

          {/* Checkboxes de verificación */}
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsOver18(!isOver18)}
            >
              <View style={[styles.checkbox, isOver18 && styles.checkboxChecked]}>
                {isOver18 && <Text style={styles.checkboxCheckmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                Confirmo que soy mayor de 18 años
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAcceptsPrivacyPolicy(!acceptsPrivacyPolicy)}
            >
              <View style={[styles.checkbox, acceptsPrivacyPolicy && styles.checkboxChecked]}>
                {acceptsPrivacyPolicy && <Text style={styles.checkboxCheckmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                Acepto el{' '}
                <Text style={styles.privacyPolicyLink}>acuerdo de privacidad</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Signup Button */}
          <TouchableOpacity
            style={[
              styles.signupButton, 
              (!username.trim() || username.length < 3 || !email.trim() || !emailValidation.isValid || !passwordValidation.isValid || password !== confirmPassword || !isOver18 || !acceptsPrivacyPolicy || isLoading) && styles.signupButtonDisabled
            ]}
            onPress={handleRegister}
            disabled={!username.trim() || username.length < 3 || !email.trim() || !emailValidation.isValid || !passwordValidation.isValid || password !== confirmPassword || !isOver18 || !acceptsPrivacyPolicy || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.signupButtonText}>Signup</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Login Link */}
          <TouchableOpacity onPress={goToLogin}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Login</Text>
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
    borderColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  successText: {
    color: '#4CAF50',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
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
  signupButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  signupButtonDisabled: {
    opacity: 0.5,
  },
  signupButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
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
  validationContainer: {
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  validationTitle: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
    marginBottom: 8,
  },
  validationItem: {
    marginBottom: 4,
  },
  validationText: {
    fontSize: 12,
    color: '#ccc',
  },
  validationSuccess: {
    color: '#4CAF50', // Verde
  },
  validationError: {
    color: '#F44336', // Rojo
  },
  confirmPasswordIndicator: {
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  confirmPasswordText: {
    fontSize: 12,
    textAlign: 'center',
  },
  checkboxContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  checkboxCheckmark: {
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  privacyPolicyLink: {
    color: '#FFD700',
    textDecorationLine: 'underline',
  },
});
