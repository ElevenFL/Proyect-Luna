import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configuración del bucket
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'luna-storage-bucket';

/**
 * Subir archivo a S3
 */
export const uploadToS3 = async (file, key, contentType) => {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    const result = await s3Client.send(command);
    return {
      success: true,
      key,
      location: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`,
      etag: result.ETag,
    };
  } catch (error) {
    console.error('Error subiendo a S3:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtener URL firmada para descarga
 */
export const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return {
      success: true,
      url: signedUrl,
    };
  } catch (error) {
    console.error('Error generando URL firmada:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtener URL firmada para subida
 */
export const getSignedUploadUrl = async (key, contentType, expiresIn = 3600) => {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return {
      success: true,
      url: signedUrl,
    };
  } catch (error) {
    console.error('Error generando URL de subida:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Eliminar archivo de S3
 */
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return {
      success: true,
      message: 'Archivo eliminado exitosamente',
    };
  } catch (error) {
    console.error('Error eliminando de S3:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verificar conexión con S3
 */
export const testS3Connection = async () => {
  try {
    const testKey = 'test/connection-test.txt';
    const testContent = 'Test de conexión';
    
    // Intentar subir un archivo de prueba
    const uploadResult = await uploadToS3(testContent, testKey, 'text/plain');
    
    if (uploadResult.success) {
      // Limpiar archivo de prueba
      await deleteFromS3(testKey);
      return {
        success: true,
        message: 'Conexión con S3 exitosa',
      };
    } else {
      return {
        success: false,
        error: uploadResult.error,
      };
    }
  } catch (error) {
    console.error('Error probando conexión S3:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

export { s3Client, BUCKET_NAME };
