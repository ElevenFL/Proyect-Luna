import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { API_CONFIG } from '../config/api';
import ApiService from './apiService';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  bucket: string;
  region: string;
}

export class ImageService {
  private static retryCount: number = 0;

  /**
   * Establece el token de autenticación
   */
  static setAuthToken(token: string) {
    ApiService.setAuthToken(token);
    // Solo loggear en desarrollo
    if (__DEV__) {
      console.log('Token de autenticación establecido en ImageService');
    }
  }

  /**
   * Obtiene una URL firmada para subir una imagen
   */
  static async getUploadUrl(
    fileName: string,
    contentType: string,
    folder: string = API_CONFIG.IMAGE.FOLDERS.PROFILE
  ): Promise<PresignedUrlResponse> {
    try {
      // Validar tipo de archivo
      if (!API_CONFIG.IMAGE.ALLOWED_TYPES.includes(contentType)) {
        throw new Error(`Tipo de archivo no permitido. Tipos permitidos: ${API_CONFIG.IMAGE.ALLOWED_TYPES.join(', ')}`);
      }

      console.log('Solicitando URL firmada para subida:', { fileName, contentType, folder });
      
      const response = await ApiService.post<PresignedUrlResponse>('/images/upload-url', {
        fileName,
        contentType,
        folder,
      });
      
      console.log('URL firmada obtenida:', response.data);
      return response.data!;
    } catch (error) {
      console.error('Error obteniendo URL de subida:', error);
      throw error;
    }
  }

  /**
   * Obtiene una URL firmada para descargar una imagen
   */
  static async getDownloadUrl(imageKey: string): Promise<string> {
    try {
      console.log('Solicitando URL firmada para descarga:', imageKey);
      
      const response = await ApiService.get<{ downloadUrl: string }>(`/images/download-url/${encodeURIComponent(imageKey)}`);
      
      console.log('URL de descarga obtenida:', response.data?.downloadUrl);
      return response.data!.downloadUrl;
    } catch (error) {
      console.error('Error obteniendo URL de descarga:', error);
      throw error;
    }
  }

  /**
   * Optimiza una imagen antes de subirla
   */
  static async optimizeImage(
    imageUri: string, 
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    const {
      maxWidth = API_CONFIG.IMAGE.OPTIMIZATION.MAX_WIDTH,
      maxHeight = API_CONFIG.IMAGE.OPTIMIZATION.MAX_HEIGHT,
      quality = API_CONFIG.IMAGE.OPTIMIZATION.QUALITY,
      format = API_CONFIG.IMAGE.OPTIMIZATION.DEFAULT_FORMAT
    } = options;

    try {
      // Verificar el tamaño del archivo
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      if (blob.size > API_CONFIG.IMAGE.MAX_SIZE) {
        throw new Error(`La imagen excede el tamaño máximo permitido de ${API_CONFIG.IMAGE.MAX_SIZE / (1024 * 1024)}MB`);
      }

      // Verificar el tipo de archivo
      if (!API_CONFIG.IMAGE.ALLOWED_TYPES.includes(blob.type)) {
        throw new Error(`Tipo de archivo no permitido. Tipos permitidos: ${API_CONFIG.IMAGE.ALLOWED_TYPES.join(', ')}`);
      }

      // Obtener dimensiones originales
      const dimensions = await this.getImageDimensions(imageUri);
      
      // Calcular dimensiones óptimas
      const optimalDimensions = this.calculateOptimalDimensions(
        dimensions.width,
        dimensions.height,
        maxWidth,
        maxHeight
      );

      // Optimizar imagen
      const manipulatorResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: optimalDimensions.width,
              height: optimalDimensions.height,
            },
          },
        ],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat[format.toUpperCase() as keyof typeof ImageManipulator.SaveFormat],
        }
      );

      // Verificar el resultado
      const optimizedResponse = await fetch(manipulatorResult.uri);
      const optimizedBlob = await optimizedResponse.blob();
      
      // Si la imagen optimizada sigue siendo muy grande, reducir más la calidad
      if (optimizedBlob.size > API_CONFIG.IMAGE.MAX_SIZE) {
        return this.optimizeImage(imageUri, {
          ...options,
          quality: quality * 0.8 // Reducir calidad en 20%
        });
      }

      return manipulatorResult.uri;
    } catch (error) {
      console.error('Error optimizando imagen:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('tamaño máximo') || error.message.includes('Tipo de archivo')) {
          throw error;
        }
      }
      
      throw new Error('No se pudo optimizar la imagen. Por favor, intente con otra imagen.');
    }
  }

  /**
   * Sube una imagen optimizada usando presigned URL
   */
  static async uploadOptimizedImage(
    imageUri: string,
    folder: string = API_CONFIG.IMAGE.FOLDERS.PROFILE,
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    try {
      console.log('Iniciando subida de imagen con presigned URL:', { imageUri, folder, options });
      
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
      const format = options.format || API_CONFIG.IMAGE.OPTIMIZATION.DEFAULT_FORMAT;
      const fileName = `${timestamp}-${randomString}.${format}`;
      
      // Obtener URL firmada para subida con reintentos
      let presignedData: PresignedUrlResponse | null = null;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= API_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
        try {
          presignedData = await this.getUploadUrl(fileName, blob.type, folder);
          console.log('URL firmada obtenida:', presignedData);
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Error desconocido');
          console.error(`Intento ${attempt} fallido:`, lastError);
          
          if (attempt < API_CONFIG.RETRY.MAX_ATTEMPTS) {
            const delay = API_CONFIG.RETRY.INITIAL_DELAY * Math.pow(API_CONFIG.RETRY.BACKOFF_FACTOR, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      if (!presignedData) {
        throw new Error(`No se pudo obtener la URL firmada después de ${API_CONFIG.RETRY.MAX_ATTEMPTS} intentos: ${lastError?.message}`);
      }
      
      // Subir imagen directamente a S3 usando la URL firmada con reintentos
      let uploadResponse: Response | null = null;
      
      for (let attempt = 1; attempt <= API_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
        try {
          console.log(`Intento de subida ${attempt} a S3:`, {
            url: presignedData.uploadUrl,
            blobSize: blob.size,
            blobType: blob.type,
            key: presignedData.key
          });
          
          // Intentar con fetch primero
          try {
            uploadResponse = await fetch(presignedData.uploadUrl, {
              method: 'PUT',
              body: blob,
              // No incluir headers - la URL presignada ya los contiene
            });
          } catch (fetchError) {
            console.error('Error con fetch, intentando con XMLHttpRequest:', fetchError);
            
            // Fallback a XMLHttpRequest si fetch falla
            uploadResponse = await this.uploadWithXHR(presignedData.uploadUrl, blob);
          }
          
          if (uploadResponse.ok) {
            console.log('Subida exitosa a S3');
            break;
          }
          
          // Obtener más detalles del error
          let errorDetails = '';
          try {
            const errorText = await uploadResponse.text();
            errorDetails = errorText;
          } catch (e) {
            errorDetails = 'No se pudo obtener detalles del error';
          }
          
          console.error(`Error S3 - Status: ${uploadResponse.status}, StatusText: ${uploadResponse.statusText}, Details: ${errorDetails}`);
          throw new Error(`Error subiendo a S3: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorDetails}`);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Error desconocido');
          console.error(`Intento de subida ${attempt} fallido:`, lastError);
          
          if (attempt < API_CONFIG.RETRY.MAX_ATTEMPTS) {
            const delay = API_CONFIG.RETRY.INITIAL_DELAY * Math.pow(API_CONFIG.RETRY.BACKOFF_FACTOR, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw new Error(`No se pudo subir la imagen después de ${API_CONFIG.RETRY.MAX_ATTEMPTS} intentos: ${lastError.message}`);
          }
        }
      }
      
      console.log('Imagen subida exitosamente a S3');
      
      // Construir URL pública de la imagen
      const publicUrl = `https://${presignedData.bucket}.s3.${presignedData.region}.amazonaws.com/${presignedData.key}`;
      console.log('URL pública de la imagen:', publicUrl);
      
      return publicUrl;
    } catch (error) {
      console.error('Error subiendo imagen con presigned URL:', error);
      
      if (error instanceof Error) {
        console.error('Mensaje de error:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Errores específicos
        if (error.message.includes('tamaño máximo')) {
          throw new Error('La imagen es demasiado grande. Por favor, seleccione una imagen más pequeña.');
        }
        if (error.message.includes('Tipo de archivo')) {
          throw new Error('Formato de imagen no soportado. Por favor, use JPEG, PNG o WebP.');
        }
        if (error.message.includes('Token')) {
          throw new Error('Error de autenticación. Por favor, inicie sesión nuevamente.');
        }
        
        throw error;
      }
      
      throw new Error('Error desconocido al subir la imagen. Por favor, intente nuevamente.');
    }
  }

  /**
   * Elimina una imagen del bucket S3
   */
  static async deleteImage(imageKey: string): Promise<boolean> {
    try {
      if (__DEV__) {
        console.log('Eliminando imagen:', imageKey);
      }
      
      await ApiService.delete(`/images/delete/${encodeURIComponent(imageKey)}`);
      
      if (__DEV__) {
        console.log('Imagen eliminada exitosamente');
      }
      return true;
    } catch (error) {
      console.error('Error eliminando imagen:', error);
      throw error;
    }
  }

  /**
   * Lista todas las imágenes en una carpeta específica
   */
  static async listImages(folder: string = API_CONFIG.IMAGE.FOLDERS.PROFILE): Promise<any[]> {
    try {
      console.log('Listando imágenes en carpeta:', folder);
      
      const response = await ApiService.get<{ images: any[] }>('/images/list', { folder });
      
      console.log('Imágenes listadas:', response.data?.images);
      return response.data?.images || [];
    } catch (error) {
      console.error('Error listando imágenes:', error);
      throw error;
    }
  }

  /**
   * Sube un blob usando XMLHttpRequest como fallback
   */
  static uploadWithXHR(url: string, blob: Blob): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('PUT', url, true);
      
      xhr.onload = () => {
        // Crear un objeto Response similar al de fetch
        const response = new Response(blob, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers({
            'Content-Type': xhr.getResponseHeader('Content-Type') || '',
          }),
        });
        resolve(response);
      };
      
      xhr.onerror = () => {
        reject(new Error('Error de red con XMLHttpRequest'));
      };
      
      xhr.ontimeout = () => {
        reject(new Error('Timeout con XMLHttpRequest'));
      };
      
      xhr.timeout = 30000; // 30 segundos
      xhr.send(blob);
    });
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
      Image.getSize(
        imageUri,
        (width, height) => {
          resolve({ width, height });
        },
        (error) => {
          reject(error);
        }
      );
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
