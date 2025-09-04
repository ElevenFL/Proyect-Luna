import { User } from '../models/Users.js';

// Actualizar perfil del usuario
export const updateProfile = async (req, res) => {
  try {
    const { displayName, birthDate, gender, location, profileImage, profileCompleted } = req.body;
    const userId = req.user.id;

    console.log('🔄 Actualizando perfil del usuario:', userId);
    console.log('📝 Datos a actualizar:', { displayName, birthDate, gender, location, profileImage, profileCompleted });

    const updateData = {};
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (birthDate !== undefined) {
      // Validar que birthDate sea una fecha válida
      try {
        const parsedDate = new Date(birthDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Fecha de nacimiento inválida',
            error: 'INVALID_BIRTH_DATE'
          });
        }
        updateData.birthDate = birthDate; // Mantener como string, se convertirá en el modelo
        console.log('📅 Fecha de nacimiento validada:', birthDate);
      } catch (dateError) {
        console.error('❌ Error validando fecha de nacimiento:', dateError);
        return res.status(400).json({
          success: false,
          message: 'Error validando fecha de nacimiento',
          error: 'BIRTH_DATE_VALIDATION_ERROR'
        });
      }
    }
    if (gender !== undefined) updateData.gender = gender;
    if (location !== undefined) updateData.location = location;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (profileCompleted !== undefined) updateData.profileCompleted = profileCompleted;
    
    // Marcar el perfil como completado si se proporcionan todos los datos requeridos
    if (displayName && birthDate && gender && location && profileImage && !profileCompleted) {
      updateData.profileCompleted = true;
      console.log('✅ Marcando perfil como completado automáticamente');
    }

    // Obtener usuario actual
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ Usuario no encontrado:', userId);
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    console.log('👤 Usuario encontrado:', user.username);

    // Actualizar usuario
    await user.update(updateData);
    console.log('✅ Usuario actualizado exitosamente');

    // Obtener usuario actualizado sin contraseña
    const updatedUser = user.select('-password');

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    console.error('📄 Stack trace:', error.stack);
    
    // Manejar errores específicos de DynamoDB
    if (error.name === 'ResourceNotFoundException') {
      return res.status(500).json({
        success: false,
        message: 'Error de configuración de la base de datos',
        error: 'DB_CONFIG_ERROR',
        details: error.message
      });
    } else if (error.name === 'AccessDeniedException') {
      return res.status(500).json({
        success: false,
        message: 'Error de permisos en la base de datos',
        error: 'DB_PERMISSION_ERROR',
        details: error.message
      });
    } else if (error.name === 'ValidationException') {
      return res.status(500).json({
        success: false,
        message: 'Error de validación en la base de datos',
        error: 'DB_VALIDATION_ERROR',
        details: error.message
      });
    } else if (error.name === 'ConditionalCheckFailedException') {
      return res.status(500).json({
        success: false,
        message: 'Error de condición en la base de datos',
        error: 'DB_CONDITION_ERROR',
        details: error.message
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR',
      details: error.message || 'Error desconocido'
    });
  }
};

// Obtener perfil del usuario
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('👤 Obteniendo perfil del usuario:', userId);
    
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ Usuario no encontrado:', userId);
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    console.log('✅ Usuario encontrado:', user.username);

    // Excluir contraseña del perfil
    const userProfile = user.select('-password');

    res.json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      user: userProfile
    });
  } catch (error) {
    console.error('❌ Error obteniendo perfil:', error);
    
    // Manejar errores específicos de DynamoDB
    if (error.name === 'ResourceNotFoundException') {
      return res.status(500).json({
        success: false,
        message: 'Error de configuración de la base de datos',
        error: 'DB_CONFIG_ERROR'
      });
    } else if (error.name === 'AccessDeniedException') {
      return res.status(500).json({
        success: false,
        message: 'Error de permisos en la base de datos',
        error: 'DB_PERMISSION_ERROR'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
};
