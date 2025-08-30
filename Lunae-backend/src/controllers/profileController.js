import { User } from '../models/Users.js';

// Actualizar perfil del usuario
export const updateProfile = async (req, res) => {
  try {
    const { displayName, birthDate, location } = req.body;
    const userId = req.user.id;

    const updateData = {};
    
    if (displayName) updateData.displayName = displayName;
    if (birthDate) updateData.birthDate = new Date(birthDate);
    if (location) updateData.location = location;
    
    // Marcar el perfil como completado si se proporcionan todos los datos
    if (displayName && birthDate && location) {
      updateData.profileCompleted = true;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      message: 'Perfil actualizado exitosamente',
      user
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Obtener perfil del usuario
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
