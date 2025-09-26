import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useStories } from '@/contexts/StoriesContext';
import { ImageService } from '@/services/imageService';
import { API_CONFIG } from '@/config/api';

export default function CreateStoryScreen() {
  const { user } = useAuth();
  const { addStory } = useStories();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16], // Formato vertical para stories
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error seleccionando imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error tomando foto:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Seleccionar imagen',
      '¿Cómo quieres agregar una imagen?',
      [
        { text: 'Cámara', onPress: takePhoto },
        { text: 'Galería', onPress: pickImage },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const publishStory = async () => {
    if (!selectedImage && !storyText.trim()) {
      Alert.alert('Error', 'Debes agregar una imagen o escribir un texto');
      return;
    }

    setIsLoading(true);
    try {
      let content: { type: 'image' | 'text'; data: string };

      if (selectedImage) {
        // Subir imagen a S3 antes de crear el story
        console.log('Subiendo imagen a S3...');
        const imageUrl = await ImageService.uploadOptimizedImage(
          selectedImage,
          API_CONFIG.IMAGE.FOLDERS.STORIES,
          {
            maxWidth: 800,
            maxHeight: 1200, // Formato vertical para stories
            quality: 0.8,
            format: 'jpeg'
          }
        );
        
        console.log('Imagen subida exitosamente:', imageUrl);
        content = { type: 'image' as const, data: imageUrl };
      } else {
        content = { type: 'text' as const, data: storyText.trim() };
      }

      // Crear el story usando el contexto
      await addStory(content);
      
      Alert.alert(
        '¡Story publicado!',
        'Tu story ha sido publicado exitosamente',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
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
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Crear Story</Text>
        
        <TouchableOpacity
          style={[styles.headerButton, styles.publishButton]}
          onPress={publishStory}
          disabled={isLoading || (!selectedImage && !storyText.trim())}
        >
          <Text style={styles.publishText}>
            {isLoading ? 'Publicando...' : 'Publicar'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Área de imagen */}
          <View style={styles.imageSection}>
            {selectedImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: selectedImage }} style={styles.storyImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={showImageOptions}
              >
                <Ionicons name="camera" size={40} color="#F9C80E" />
                <Text style={styles.addImageText}>Agregar imagen</Text>
                <Text style={styles.addImageSubtext}>Toca para seleccionar o tomar una foto</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Área de texto */}
          <View style={styles.textSection}>
            <Text style={styles.sectionTitle}>Texto del Story</Text>
            <TextInput
              style={styles.textInput}
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

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  publishButton: {
    backgroundColor: '#F9C80E',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  publishText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },
  imageSection: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  storyImage: {
    width: '100%',
    height: 500,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  addImageButton: {
    height: 350,
    borderWidth: 2,
    borderColor: '#F9C80E',
    borderStyle: 'dashed',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  addImageText: {
    color: '#F9C80E',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  addImageSubtext: {
    color: '#888888',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  textSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 100,
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
