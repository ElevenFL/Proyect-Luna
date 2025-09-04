import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useOnboarding } from '../../hooks/useOnboarding';

const { width, height } = Dimensions.get('window');

export default function LocationScreen() {
  const { displayName, birthDate, gender, profileImage } = useLocalSearchParams();
  const [locationPermission, setLocationPermission] = useState(false);
  const { updateLocation, isLoading, error } = useOnboarding();

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setLocationPermission(true);
        
        // Obtener la ubicación actual
        const location = await Location.getCurrentPositionAsync({});
        
        // Obtener la dirección
        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address[0] ? `${address[0].city}, ${address[0].country}` : 'Ubicación no disponible'
        };

        // Guardar la ubicación en DynamoDB
        const success = await updateLocation(locationData);
        
        if (success) {
          router.push({
            pathname: '/onboarding/complete',
            params: { 
              displayName: displayName as string,
              birthDate: birthDate as string,
              gender: gender as string,
              profileImage: profileImage as string,
              location: JSON.stringify(locationData)
            }
          });
        } else {
          Alert.alert(
            'Error',
            'No se pudo guardar tu ubicación. Por favor, intenta de nuevo.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Permisos denegados',
          'Los permisos de ubicación son necesarios para personalizar tu experiencia.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      Alert.alert(
        'Error',
        'No se pudo obtener tu ubicación. Puedes continuar sin ella.',
        [
          { text: 'Continuar sin ubicación', onPress: () => {
            router.push({
              pathname: '/onboarding/complete',
              params: { 
                displayName: displayName as string,
                birthDate: birthDate as string,
                gender: gender as string,
                profileImage: profileImage as string,
                location: JSON.stringify({})
              }
            });
          }},
          { text: 'Intentar de nuevo', onPress: requestLocationPermission }
        ]
      );
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding/complete',
      params: { 
        displayName: displayName as string,
        birthDate: birthDate as string,
        gender: gender as string,
        profileImage: profileImage as string,
        location: JSON.stringify({})
      }
    });
  };

  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Main</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Location.</Text>
          
          <Text style={styles.description}>
            Your privacy is important. We'll only use your location to assign your nationality.
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={requestLocationPermission}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <Text style={styles.buttonText}>Allow location</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={handleSkip}
            disabled={isLoading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
        
        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
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
    marginBottom: 15,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#CCCCCC',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#333333',
  },
  errorContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
});
