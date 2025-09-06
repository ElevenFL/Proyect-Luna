import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import ApiService from '@/services/apiService';

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
      
      // Log de depuración para ver qué datos están llegando
      console.log('🔍 Datos recibidos en complete.tsx:');
      console.log('displayName:', displayName);
      console.log('birthDate:', birthDate);
      console.log('gender:', gender);
      console.log('profileImage:', profileImage);
      console.log('location (raw):', location);
      console.log('locationData (parsed):', locationData);
      
      // Verificar que todos los datos requeridos estén presentes
      if (!displayName || !birthDate || !gender || !profileImage || profileImage === '') {
        console.log('❌ Faltan datos básicos del perfil');
        Alert.alert('Error', 'Faltan datos del perfil. Por favor, completa todos los pasos del onboarding.');
        return;
      }
      
      // Verificar que la ubicación tenga datos válidos (no solo un objeto vacío)
      if (!locationData || (!locationData.latitude && !locationData.longitude && !locationData.address)) {
        console.log('❌ Faltan datos de ubicación válidos');
        Alert.alert('Error', 'Falta la información de ubicación. Por favor, completa el paso de ubicación.');
        return;
      }
      
      console.log('✅ Todos los datos están presentes, procediendo con la actualización');
      
      // Primero actualizar el contexto local con todos los datos
      await updateUserProfile({
        displayName: displayName as string,
        birthDate: birthDate as string,
        gender: gender as string,
        profileImage: profileImage as string,
        location: locationData,
        profileCompleted: true
      });
      
      // Configurar el token en ApiService
      ApiService.setAuthToken(token);
      
      // Luego marcar el perfil como completado en el backend
      const response = await ApiService.markProfileCompleted();
      
      if (response.success) {
        // Pequeña pausa para asegurar que el contexto se actualice
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Navegar a la pantalla principal
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', response.message || 'Error al marcar el perfil como completo');
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
