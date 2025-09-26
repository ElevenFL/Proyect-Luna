import { useState, useCallback, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageService } from '../services/imageService';
import { useAuth } from '../contexts/AuthContext';

interface UseProfileImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export const useProfileImage = (options: UseProfileImageOptions = {}) => {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUnmounting, setIsUnmounting] = useState(false);
  const { token } = useAuth();

  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    format = 'jpeg'
  } = options;

  const requestPermissions = useCallback(async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  }, []);

  const pickImageFromLibrary = useCallback(async () => {
    try {
      const hasPermission = await requestPermissions('library');
      
      if (!hasPermission) {
        Alert.alert(
          'Permisos necesarios',
          'Necesitamos acceso a tu galería para seleccionar una foto.',
          [{ text: 'OK' }]
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, // Usar calidad máxima para la selección, se optimizará después
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      
      return null;
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
      return null;
    }
  }, [requestPermissions]);

  const takePhoto = useCallback(async () => {
    try {
      const hasPermission = await requestPermissions('camera');
      
      if (!hasPermission) {
        Alert.alert(
          'Permisos necesarios',
          'Necesitamos acceso a tu cámara para tomar una foto.',
          [{ text: 'OK' }]
        );
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, // Usar calidad máxima para la captura, se optimizará después
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      
      return null;
    } catch (error) {
      console.error('Error tomando foto:', error);
      Alert.alert('Error', 'No se pudo tomar la foto.');
      return null;
    }
  }, [requestPermissions]);

  const uploadImage = useCallback(async (imageUri: string, folder: string = 'profile-images'): Promise<string> => {
    try {
      if (!token) {
        throw new Error('No hay token de autenticación disponible');
      }

      // Establecer el token en el ImageService
      ImageService.setAuthToken(token);

      if (!isUnmounting) {
        setUploading(true);
        setUploadProgress(0);
      }

      // Simular progreso de subida
      const progressInterval = setInterval(() => {
        if (!isUnmounting) {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }
      }, 200);

      // Subir imagen usando presigned URL
      const downloadURL = await ImageService.uploadOptimizedImage(
        imageUri,
        folder,
        {
          maxWidth,
          maxHeight,
          quality,
          format
        }
      );

      clearInterval(progressInterval);
      if (!isUnmounting) {
        setUploadProgress(100);
      }
      
      return downloadURL;
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      
      // Mostrar mensaje de error al usuario
      if (error instanceof Error) {
        if (error.message.includes('No hay token')) {
          Alert.alert('Error', 'Sesión expirada. Por favor, inicia sesión nuevamente.');
        } else if (error.message.includes('Error obteniendo URL')) {
          Alert.alert('Error', 'No se pudo obtener la URL de subida. Verifica tu conexión.');
        } else {
          Alert.alert('Error', `Error subiendo imagen: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'Error desconocido subiendo imagen.');
      }
      
      throw error;
    } finally {
      if (!isUnmounting) {
        setUploading(false);
        setUploadProgress(0);
      }
    }
  }, [maxWidth, maxHeight, quality, format, token]);

  const showImageOptions = useCallback(() => {
    Alert.alert(
      'Seleccionar foto',
      '¿Cómo quieres agregar tu foto de perfil?',
      [
        { text: 'Tomar foto', onPress: async () => {
          const uri = await takePhoto();
          if (uri && !isUnmounting) setProfileImage(uri);
        }},
        { text: 'Galería', onPress: async () => {
          const uri = await pickImageFromLibrary();
          if (uri && !isUnmounting) setProfileImage(uri);
        }},
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  }, [takePhoto, pickImageFromLibrary]);

  const clearImage = useCallback(() => {
    if (!isUnmounting) {
      setProfileImage(null);
    }
  }, [isUnmounting]);

  // Efecto para manejar el desmontaje del hook
  useEffect(() => {
    return () => {
      setIsUnmounting(true);
    };
  }, []);

  return {
    profileImage,
    uploading,
    uploadProgress,
    setProfileImage,
    pickImageFromLibrary,
    takePhoto,
    uploadImage,
    showImageOptions,
    clearImage
  };
};
