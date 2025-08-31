import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export class ImageService {
  /**
   * Verifica la conexión con Firebase Storage
   */
  static async testConnection(): Promise<boolean> {
    try {
      console.log('Probando conexión con Firebase Storage...');
      const testRef = ref(storage, 'test/connection-test.txt');
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      
      await uploadBytes(testRef, testBlob);
      console.log('Conexión con Firebase Storage exitosa');
      
      // Limpiar archivo de prueba
      // Note: No hay método delete en el SDK web, pero el archivo de prueba es pequeño
      
      return true;
    } catch (error) {
      console.error('Error de conexión con Firebase Storage:', error);
      return false;
    }
  }

  /**
   * Optimiza una imagen antes de subirla a Firebase Storage
   */
  static async optimizeImage(
    imageUri: string, 
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    const {
      maxWidth = 800,
      maxHeight = 800,
      quality = 0.8,
      format = 'jpeg'
    } = options;

    try {
      const manipulatorResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat[format.toUpperCase() as keyof typeof ImageManipulator.SaveFormat],
        }
      );

      return manipulatorResult.uri;
    } catch (error) {
      console.error('Error optimizando imagen:', error);
      throw new Error('No se pudo optimizar la imagen');
    }
  }

  /**
   * Sube una imagen optimizada a Firebase Storage
   */
  static async uploadOptimizedImage(
    imageUri: string,
    folder: string = 'profile-images',
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    try {
      console.log('Iniciando subida de imagen:', { imageUri, folder, options });
      
      // Optimizar la imagen
      const optimizedUri = await this.optimizeImage(imageUri, options);
      console.log('Imagen optimizada:', optimizedUri);
      
      // Convertir URI a blob
      const response = await fetch(optimizedUri);
      if (!response.ok) {
        throw new Error(`Error al obtener la imagen: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('Blob creado:', { size: blob.size, type: blob.type });
      
      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substr(2, 9);
      const fileName = `${timestamp}-${randomString}.${options.format || 'jpg'}`;
      const fullPath = `${folder}/${fileName}`;
      
      console.log('Subiendo a Firebase Storage:', fullPath);
      
      // Crear referencia en Firebase Storage
      const imageRef = ref(storage, fullPath);
      
      // Subir imagen optimizada
      const uploadResult = await uploadBytes(imageRef, blob);
      console.log('Imagen subida exitosamente:', uploadResult.metadata);
      
      // Obtener URL de descarga
      const downloadURL = await getDownloadURL(imageRef);
      console.log('URL de descarga obtenida:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error subiendo imagen optimizada:', error);
      
      // Proporcionar más información sobre el error
      if (error instanceof Error) {
        console.error('Mensaje de error:', error.message);
        console.error('Stack trace:', error.stack);
      }
      
      throw new Error(`No se pudo subir la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Genera un hash simple para el cacheo de imágenes
   */
  static generateImageHash(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Obtiene las dimensiones de una imagen
   */
  static async getImageDimensions(imageUri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = imageUri;
    });
  }

  /**
   * Calcula las dimensiones óptimas para redimensionar manteniendo aspect ratio
   */
  static calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number = 800,
    maxHeight: number = 800
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;
    
    let newWidth = originalWidth;
    let newHeight = originalHeight;
    
    if (originalWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / aspectRatio;
    }
    
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }
    
    return {
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    };
  }
}
