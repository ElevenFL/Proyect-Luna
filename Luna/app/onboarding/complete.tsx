import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';

const { width, height } = Dimensions.get('window');

export default function CompleteScreen() {
  const { displayName, birthDate, gender, profileImage, location } = useLocalSearchParams();
  const { token, updateUserProfile } = useAuth();
  const { markProfileCompleted } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);

  const updateProfile = async () => {
    if (!token) {
      Alert.alert('Error', 'No se encontró el token de autenticación');
      return;
    }

    setIsLoading(true);
    try {
      const locationData = location ? JSON.parse(location as string) : {};
      
      // Actualizar el perfil usando el hook useOnboarding
      const success = await markProfileCompleted();
      
      if (success) {
        // Actualizar el contexto local con los nuevos datos
        updateUserProfile({
          displayName: displayName as string,
          birthDate: birthDate as string,
          gender: gender as string,
          profileImage: profileImage as string,
          location: locationData,
          profileCompleted: true
        });
        
        // Navegar a la pantalla principal
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Error al marcar el perfil como completo');
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      Alert.alert('Error', 'Error de conexión al actualizar el perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    updateProfile();
  };

  return (
    <View style={styles.container}>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Everything ready!!</Text>
          
          <Text style={styles.description}>
            Your profile is created, now start meeting new people.
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={[styles.dot, styles.activeDot]} />
          </View>
        </View>

        {/* Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleFinish}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Creating profile...' : 'Finish'}
            </Text>
          </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FFD700',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333333',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
