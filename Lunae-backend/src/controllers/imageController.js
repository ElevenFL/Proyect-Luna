import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'eleven-lunea-storage';

/**
 * Genera una URL firmada para subir una imagen
 */
export const generateUploadUrl = async (req, res) => {
  try {
    const { fileName, contentType, folder = 'profile-images' } = req.body;
    
    if (!fileName || !contentType) {
      return res.status(400).json({
        success: false,
        message: 'fileName y contentType son requeridos'
      });
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 9);
    const fileExtension = fileName.split('.').pop();
    const key = `${folder}/${timestamp}-${randomString}.${fileExtension}`;

    // Crear comando para subir objeto
    const putObjectCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // Configurar para acceso público (opcional, para imágenes de perfil)
      ACL: 'public-read',
    });

    // Generar URL firmada para subida (válida por 15 minutos)
    const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: 900, // 15 minutos
    });

    res.json({
      success: true,
      data: {
        uploadUrl,
        key,
        bucket: BUCKET_NAME,
        region: process.env.AWS_REGION || 'us-east-2',
      },
      message: 'URL de subida generada exitosamente'
    });

  } catch (error) {
    console.error('Error generando URL de subida:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Genera una URL firmada para descargar una imagen
 */
export const generateDownloadUrl = async (req, res) => {
  try {
    const { imageKey } = req.params;
    
    if (!imageKey) {
      return res.status(400).json({
        success: false,
        message: 'imageKey es requerido'
      });
    }

    // Crear comando para obtener objeto
    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
    });

    // Generar URL firmada para descarga (válida por 1 hora)
    const downloadUrl = await getSignedUrl(s3Client, getObjectCommand, {
      expiresIn: 3600, // 1 hora
    });

    res.json({
      success: true,
      data: {
        downloadUrl,
        key: imageKey,
        bucket: BUCKET_NAME,
      },
      message: 'URL de descarga generada exitosamente'
    });

  } catch (error) {
    console.error('Error generando URL de descarga:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Elimina una imagen del bucket S3
 */
export const deleteImage = async (req, res) => {
  try {
    const { imageKey } = req.params;
    
    if (!imageKey) {
      return res.status(400).json({
        success: false,
        message: 'imageKey es requerido'
      });
    }

    // Crear comando para eliminar objeto
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: imageKey,
    });

    // Ejecutar eliminación
    await s3Client.send(deleteObjectCommand);

    res.json({
      success: true,
      message: 'Imagen eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando imagen:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Lista todas las imágenes en una carpeta específica
 */
export const listImages = async (req, res) => {
  try {
    const { folder = 'profile-images' } = req.query;
    
    // Crear comando para listar objetos
    const listObjectsCommand = {
      Bucket: BUCKET_NAME,
      Prefix: `${folder}/`,
      MaxKeys: 100, // Limitar a 100 resultados
    };

    const { Contents } = await s3Client.send(listObjectsCommand);

    const images = Contents ? Contents.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${obj.Key}`
    })) : [];

    res.json({
      success: true,
      data: {
        images,
        folder,
        total: images.length
      },
      message: 'Imágenes listadas exitosamente'
    });

  } catch (error) {
    console.error('Error listando imágenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};
