import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import LuneaLogo from '@/components/LuneaLogo';

export default function WelcomeScreen() {
  const goToLogin = () => {
    router.push('/(auth)/login');
  };

  const goToRegister = () => {
    router.push('/(auth)/register');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <View style={styles.content}>
        {/* Logo */}
        <LuneaLogo width={200} height={80} />
        
        {/* Welcome Text */}
        <Text style={styles.welcomeText}>Welcome to the community</Text>
        
        {/* Buttons Container */}
        <View style={styles.buttonsContainer}>
          {/* Login Button */}
          <TouchableOpacity style={styles.loginButton} onPress={goToLogin}>
            <Text style={styles.loginButtonText}>LOGIN</Text>
          </TouchableOpacity>
          
          {/* Register Button */}
          <TouchableOpacity style={styles.registerButton} onPress={goToRegister}>
            <Text style={styles.registerButtonText}>Signup</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 60,
    fontWeight: '400',
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    maxWidth: 280,
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
