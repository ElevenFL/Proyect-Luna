import * as ImageManipulator from 'expo-image-manipulator';

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
  private static API_BASE_URL = 'http://192.168.1.11:3000/api';
  private static authToken: string = '';

  /**
   * Establece el token de autenticación
   */
  static setAuthToken(token: string) {
    this.authToken = token;
    console.log('Token de autenticación establecido en ImageService');
  }

  /**
   * Verifica si el token está disponible y es válido
   */
  private static validateToken(): void {
    if (!this.authToken || this.authToken.trim() === '') {
      throw new Error('Token de autenticación no disponible');
    }
  }

  /**
   * Obtiene una URL firmada para subir una imagen
   */
  static async getUploadUrl(
    fileName: string,
    contentType: string,
    folder: string = 'profile-images'
  ): Promise<PresignedUrlResponse> {
    try {
      this.validateToken();

      console.log('Solicitando URL firmada para subida:', { fileName, contentType, folder });
      
      const response = await fetch(`${this.API_BASE_URL}/images/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          fileName,
          contentType,
          folder,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Token inválido o expirado');
        }
        if (response.status === 403) {
          throw new Error('Acceso denegado');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log('URL firmada obtenida:', data.data);
      
      return data.data;
    } catch (error) {
      console.error('Error obteniendo URL de subida:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Token inválido') || error.message.includes('Token expirado')) {
          throw new Error('Token inválido o expirado');
        }
        throw error;
      }
      
      throw new Error(`No se pudo obtener la URL de subida: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Obtiene una URL firmada para descargar una imagen
   */
  static async getDownloadUrl(imageKey: string): Promise<string> {
    try {
      this.validateToken();

      console.log('Solicitando URL firmada para descarga:', imageKey);
      
      const response = await fetch(`${this.API_BASE_URL}/images/download-url/${encodeURIComponent(imageKey)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Token inválido o expirado');
        }
        if (response.status === 403) {
          throw new Error('Acceso denegado');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log('URL de descarga obtenida:', data.data.downloadUrl);
      
      return data.data.downloadUrl;
    } catch (error) {
      console.error('Error obteniendo URL de descarga:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Token inválido') || error.message.includes('Token expirado')) {
          throw new Error('Token inválido o expirado');
        }
        throw error;
      }
      
      throw new Error(`No se pudo obtener la URL de descarga: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
   * Sube una imagen optimizada usando presigned URL
   */
  static async uploadOptimizedImage(
    imageUri: string,
    folder: string = 'profile-images',
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
      const fileName = `${timestamp}-${randomString}.${options.format || 'jpg'}`;
      
      // Obtener URL firmada para subida
      const presignedData = await this.getUploadUrl(fileName, blob.type, folder);
      console.log('URL firmada obtenida:', presignedData);
      
      // Subir imagen directamente a S3 usando la URL firmada
      const uploadResponse = await fetch(presignedData.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob.type,
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Error subiendo a S3: ${uploadResponse.status} ${uploadResponse.statusText}`);
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
      }
      
      throw new Error(`No se pudo subir la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Elimina una imagen del bucket S3
   */
  static async deleteImage(imageKey: string): Promise<boolean> {
    try {
      this.validateToken();

      console.log('Eliminando imagen:', imageKey);
      
      const response = await fetch(`${this.API_BASE_URL}/images/delete/${encodeURIComponent(imageKey)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Token inválido o expirado');
        }
        if (response.status === 403) {
          throw new Error('Acceso denegado');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      console.log('Imagen eliminada exitosamente');
      return true;
    } catch (error) {
      console.error('Error eliminando imagen:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Token inválido') || error.message.includes('Token expirado')) {
          throw new Error('Token inválido o expirado');
        }
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Lista todas las imágenes en una carpeta específica
   */
  static async listImages(folder: string = 'profile-images'): Promise<any[]> {
    try {
      this.validateToken();

      console.log('Listando imágenes en carpeta:', folder);
      
      const response = await fetch(`${this.API_BASE_URL}/images/list?folder=${encodeURIComponent(folder)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Token inválido o expirado');
        }
        if (response.status === 403) {
          throw new Error('Acceso denegado');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      console.log('Imágenes listadas:', data.data.images);
      
      return data.data.images;
    } catch (error) {
      console.error('Error listando imágenes:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Token inválido') || error.message.includes('Token expirado')) {
          throw new Error('Token inválido o expirado');
        }
        throw error;
      }
      
      return [];
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
