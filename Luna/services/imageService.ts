import * as ImageManipulator from 'expo-image-manipulator';
import { Storage } from '../config/amplify';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export class ImageService {
  /**
   * Verifica la conexión con AWS S3 Storage
   */
  static async testConnection(): Promise<boolean> {
    try {
      console.log('Probando conexión con AWS S3 Storage...');
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      
      await Storage.uploadData({
        key: 'test/connection-test.txt',
        data: testBlob,
      }).result;
      
      console.log('Conexión con AWS S3 Storage exitosa');
      
      // Limpiar archivo de prueba
      await Storage.remove({ key: 'test/connection-test.txt' });
      
      return true;
    } catch (error) {
      console.error('Error de conexión con AWS S3 Storage:', error);
      return false;
    }
  }

  /**
   * Optimiza una imagen antes de subirla a AWS S3 Storage
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
   * Sube una imagen optimizada a AWS S3 Storage
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
      
      console.log('Subiendo a AWS S3 Storage:', fullPath);
      
      // Subir imagen optimizada a S3
      const uploadResult = await Storage.uploadData({
        key: fullPath,
        data: blob,
        options: {
          contentType: blob.type,
        },
      }).result;
      
      console.log('Imagen subida exitosamente:', uploadResult);
      
      // Obtener URL de descarga
      const downloadURL = await Storage.getUrl({ key: fullPath });
      console.log('URL de descarga obtenida:', downloadURL);
      
      return downloadURL.url.toString();
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
