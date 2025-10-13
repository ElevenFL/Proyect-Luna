import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProfileImage } from '../../hooks/useProfileImage';
import { useOnboarding } from '../../hooks/useOnboarding';
import OptimizedImage from '../../components/OptimizedImage';

const { width, height } = Dimensions.get('window');



export default function PhotoScreen() {
  const { displayName, birthDate, gender, location } = useLocalSearchParams();
  const { 
    profileImage, 
    uploading, 
    uploadProgress, 
    showImageOptions, 
    uploadImage 
  } = useProfileImage({
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
    format: 'jpeg'
  });
  const { updateProfileImage, isLoading: isUpdatingProfile, error } = useOnboarding();

  // Obtener iniciales del nombre
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNext = async () => {
    try {
      let imageUrl = '';
      
      if (profileImage) {
        // Subir imagen a S3
        imageUrl = await uploadImage(profileImage, 'profile-images');
        
        // Guardar la URL de la imagen en DynamoDB
        const success = await updateProfileImage(imageUrl);
        
        if (!success) {
          Alert.alert(
            'Error',
            'No se pudo guardar la imagen de perfil. Por favor, intenta de nuevo.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      router.push({
        pathname: '/onboarding/location',
        params: { 
          displayName: displayName as string,
          birthDate: birthDate as string,
          gender: gender as string,
          profileImage: imageUrl || 'default' // Usar 'default' si no hay imagen
        }
      });
    } catch (error) {
      console.error('Error procesando imagen:', error);
      Alert.alert(
        'Error',
        'Ocurrió un error al procesar la imagen. Por favor, intenta de nuevo.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleBack = () => {
    router.back();
  };



  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.question}>¿Agregar una foto?</Text>
          
          {/* Profile Picture Container */}
          <TouchableOpacity style={styles.profileContainer} onPress={showImageOptions}>
            {profileImage ? (
              <OptimizedImage 
                uri={profileImage} 
                style={styles.profileImage}
                cachePolicy="memory-disk"
                priority="high"
                placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.initialsText}>
                  {getInitials(displayName as string || 'Usuario')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <Text style={styles.helperText}>
            Agregar una foto de perfil aumentará tus posibilidades de hablar con alguien.
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>

        {/* Progress Bar */}
        {uploading && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{uploadProgress}%</Text>
          </View>
        )}

        {/* Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, uploading && styles.buttonDisabled]} 
            onPress={handleNext}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>
              {uploading ? 'Subiendo...' : 'Siguiente'}
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
    alignItems: 'center',
  },
  question: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 40,
    textAlign: 'center',
  },
  profileContainer: {
    marginBottom: 30,
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  initialsText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#000000',
  },
  helperText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
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
    paddingBottom: 60,
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
  progressBarContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 2,
  },
  progressText: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'center',
  },
});
