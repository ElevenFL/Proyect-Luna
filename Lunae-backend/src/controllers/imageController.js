import { uploadToS3, getSignedDownloadUrl, getSignedUploadUrl, deleteFromS3, testS3Connection } from '../config/aws.js';
import { User } from '../models/Users.js';

/**
 * Probar conexión con S3
 */
export const testConnection = async (req, res) => {
  try {
    const result = await testS3Connection();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Conexión con AWS S3 exitosa',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error de conexión con S3',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error probando conexión:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Obtener URL firmada para subir imagen de perfil
 */
export const getProfileImageUploadUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { contentType } = req.body;
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        message: 'Content-Type es requerido',
      });
    }

    // Generar nombre único para la imagen
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 9);
    const fileExtension = contentType.split('/')[1] || 'jpg';
    const key = `profile-images/${userId}/${timestamp}-${randomString}.${fileExtension}`;

    const result = await getSignedUploadUrl(key, contentType, 3600); // 1 hora

    if (result.success) {
      res.json({
        success: true,
        uploadUrl: result.url,
        key,
        message: 'URL de subida generada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error generando URL de subida',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error generando URL de subida:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Actualizar URL de imagen de perfil en la base de datos
 */
export const updateProfileImageUrl = async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageUrl, imageKey } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL de imagen es requerida',
      });
    }

    // Actualizar usuario con nueva imagen
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        profileImage: imageUrl,
        profileImageKey: imageKey, // Guardar la key para futuras operaciones
      },
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Imagen de perfil actualizada exitosamente',
      user,
    });
  } catch (error) {
    console.error('Error actualizando imagen de perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Eliminar imagen de perfil
 */
export const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener usuario actual
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Si tiene imagen guardada, eliminarla de S3
    if (user.profileImageKey) {
      const deleteResult = await deleteFromS3(user.profileImageKey);
      
      if (!deleteResult.success) {
        console.error('Error eliminando imagen de S3:', deleteResult.error);
        // Continuar con la actualización de la DB aunque falle la eliminación de S3
      }
    }

    // Actualizar usuario removiendo la imagen
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $unset: { 
          profileImage: 1,
          profileImageKey: 1,
        }
      },
      { new: true, select: '-password' }
    );

    res.json({
      success: true,
      message: 'Imagen de perfil eliminada exitosamente',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error eliminando imagen de perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

/**
 * Obtener URL firmada para descargar imagen
 */
export const getImageDownloadUrl = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Key del archivo es requerida',
      });
    }

    const result = await getSignedDownloadUrl(key, 3600); // 1 hora

    if (result.success) {
      res.json({
        success: true,
        downloadUrl: result.url,
        message: 'URL de descarga generada exitosamente',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error generando URL de descarga',
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error generando URL de descarga:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};
