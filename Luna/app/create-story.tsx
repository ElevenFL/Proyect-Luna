import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  StatusBar,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/contexts/AuthContext';
import { useStories } from '@/contexts/StoriesContext';
import { ImageService } from '@/services/imageService';
import { API_CONFIG } from '@/config/api';

export default function CreateStoryScreen() {
  const { user } = useAuth();
  const { addStory } = useStories();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
          skipProcessing: false,
        });

        // Recortar la imagen al formato 9:16
        const aspectRatio = 9 / 16; // Formato 9:16
        let cropWidth = photo.width;
        let cropHeight = photo.width / aspectRatio; // 9:16 = width/height
        
        // Si la altura calculada excede la imagen original, ajustar basándose en la altura
        if (cropHeight > photo.height) {
          cropHeight = photo.height;
          cropWidth = photo.height * aspectRatio;
        }
        
        // Centrar el recorte
        const originX = Math.max(0, (photo.width - cropWidth) / 2);
        const originY = Math.max(0, (photo.height - cropHeight) / 2);
        
        const croppedImage = await ImageManipulator.manipulateAsync(
          photo.uri,
          [
            {
              crop: {
                originX: Math.floor(originX),
                originY: Math.floor(originY),
                width: Math.floor(cropWidth),
                height: Math.floor(cropHeight),
              },
            },
            {
              resize: {
                width: 900,
                height: 1600,
              },
            },
          ],
          {
            compress: 0.8,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        setCapturedImage(croppedImage.uri);
        setShowCamera(false);
      } catch (error) {
        console.error('Error tomando foto:', error);
        Alert.alert('Error', 'No se pudo tomar la foto');
      }
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16], // Formato vertical para stories
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCapturedImage(result.assets[0].uri);
        setShowCamera(false);
      }
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current: CameraType) => (current === 'back' ? 'front' : 'back'));
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setShowCamera(true);
  };

  const publishStory = async () => {
    if (!capturedImage && !storyText.trim()) {
      Alert.alert('Error', 'Debes tomar o seleccionar una imagen');
      return;
    }

    setIsLoading(true);
    try {
      let content: { type: 'image' | 'text'; data: string; description?: string };

      if (capturedImage) {
        // Subir imagen a S3 antes de crear el story
        console.log('Subiendo imagen a S3...');
        const imageUrl = await ImageService.uploadOptimizedImage(
          capturedImage,
          API_CONFIG.IMAGE.FOLDERS.STORIES,
          {
            maxWidth: 800,
            maxHeight: 1200, // Formato vertical para stories
            quality: 0.8,
            format: 'jpeg'
          }
        );
        
        console.log('Imagen subida exitosamente:', imageUrl);
        
        // Si hay descripción, incluirla en el contenido
        if (storyText.trim()) {
          content = { 
            type: 'image' as const, 
            data: imageUrl,
            description: storyText.trim()
          };
        } else {
          content = { type: 'image' as const, data: imageUrl };
        }
      } else {
        content = { type: 'text' as const, data: storyText.trim() };
      }

      // Crear el story usando el contexto
      await addStory(content);
      
      // Regresar a la pantalla anterior sin mostrar alert
      router.back();
    } catch (error) {
      console.error('Error publicando story:', error);
      
      // Mostrar mensaje de error más específico
      let errorMessage = 'No se pudo publicar el story';
      if (error instanceof Error) {
        if (error.message.includes('imagen')) {
          errorMessage = 'Error al subir la imagen. Por favor, inténtalo de nuevo.';
        } else if (error.message.includes('tamaño')) {
          errorMessage = 'La imagen es demasiado grande. Por favor, selecciona una imagen más pequeña.';
        } else if (error.message.includes('formato')) {
          errorMessage = 'Formato de imagen no soportado. Usa JPEG, PNG o WebP.';
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.content}>
          {showCamera ? (
            // Vista de cámara
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
                mode="picture"
              >
                {/* Overlay de la cámara */}
                <View style={styles.cameraOverlay}>
                  {/* Botones superiores */}
                  <View style={styles.cameraTopControls}>
                    <TouchableOpacity
                      style={styles.floatingCloseButton}
                      onPress={() => router.back()}
                    >
                      <Ionicons name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.floatingPublishButton, (!capturedImage && !storyText.trim()) && styles.disabledButton]}
                      onPress={publishStory}
                      disabled={isLoading || (!capturedImage && !storyText.trim())}
                    >
                      <Text style={styles.floatingPublishText}>
                        {isLoading ? 'Publicando...' : 'Publicar'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Controles inferiores */}
                  <View style={styles.cameraBottomControls}>
                    {/* Espaciador */}
                    <View style={styles.spacer} />
                  </View>
                </View>
              </CameraView>
            </View>
          ) : (
            // Vista de preview de imagen capturada
            <View style={styles.previewContainer}>
              <Image source={{ uri: capturedImage! }} style={styles.previewImage} />
              
              {/* Botones flotantes superiores */}
              <View style={styles.previewTopControls}>
                <TouchableOpacity
                  style={styles.floatingCloseButton}
                  onPress={() => router.back()}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.floatingPublishButton}
                  onPress={publishStory}
                  disabled={isLoading}
                >
                  <Text style={styles.floatingPublishText}>
                    {isLoading ? 'Publicando...' : 'Publicar'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Controles de preview */}
              <View style={styles.previewControls}>
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={retakePhoto}
                >
                  <Ionicons name="camera" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Botón de captura flotante */}
          {showCamera && (
            <View style={styles.floatingCaptureContainer}>
              <TouchableOpacity
                style={styles.floatingCaptureButton}
                onPress={takePicture}
              >
                <View style={styles.floatingCaptureButtonInner} />
              </TouchableOpacity>
            </View>
          )}

          {/* Botón de galería flotante */}
          <View style={styles.floatingGalleryContainer}>
            <TouchableOpacity
              style={styles.floatingGalleryButton}
              onPress={pickFromGallery}
            >
              <Ionicons name="images" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Botón de cambio de cámara flotante */}
          {showCamera && (
            <View style={styles.floatingCameraToggleContainer}>
              <TouchableOpacity
                style={styles.floatingCameraToggleButton}
                onPress={toggleCameraFacing}
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Área de descripción */}
          <View style={[
            styles.descriptionSection,
            { bottom: keyboardHeight > 0 ? keyboardHeight + 10 : 10 }
          ]}>
            <TextInput
              style={styles.descriptionInput}
              placeholder="¿Qué está pasando?"
              placeholderTextColor="#888888"
              value={storyText}
              onChangeText={setStoryText}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>
              {storyText.length}/200
            </Text>
          </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  cameraTopControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  previewTopControls: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  floatingCloseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 12,
  },
  floatingPublishButton: {
    backgroundColor: '#F9C80E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  disabledButton: {
    backgroundColor: 'rgba(249, 200, 14, 0.5)',
  },
  floatingPublishText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 12,
  },
  cameraBottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 40,
  },
  galleryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 12,
  },
  galleryText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#F9C80E',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F9C80E',
  },
  spacer: {
    width: 80,
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewControls: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  retakeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 12,
    width: 50,
    height: 50,
  },
  floatingCaptureContainer: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floatingCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#F9C80E',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingCaptureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F9C80E',
  },
  floatingGalleryContainer: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    alignItems: 'center',
  },
  floatingGalleryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 12,
    width: 50,
    height: 50,
  },
  floatingCameraToggleContainer: {
    position: 'absolute',
    bottom: 160,
    right: 20,
    alignItems: 'center',
  },
  floatingCameraToggleButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 12,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionSection: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 26, 0)',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  descriptionInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#333333',
  },
  characterCount: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
});
