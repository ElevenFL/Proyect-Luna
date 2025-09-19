import { Story } from '../models/Stories.js';
import { User } from '../models/Users.js';

// Crear un nuevo story
export const createStory = async (req, res) => {
  try {
    const { content, location } = req.body;
    const userId = req.user.id;

    // Validar datos requeridos
    if (!content || !content.type || !content.data) {
      return res.status(400).json({
        success: false,
        message: 'Contenido del story es requerido (type y data)',
        error: 'MISSING_CONTENT'
      });
    }

    // Validar tipo de contenido
    if (!['image', 'text'].includes(content.type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de contenido debe ser "image" o "text"',
        error: 'INVALID_CONTENT_TYPE'
      });
    }

    // Obtener información del usuario
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Crear el story
    const storyData = {
      userId,
      userName: user.displayName || user.username,
      userProfileImage: user.profileImage,
      content,
      location
    };

    const story = await Story.create(storyData);

    console.log(`✅ Story creado: ${story.id} por usuario ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Story creado exitosamente',
      data: {
        id: story.id,
        userId: story.userId,
        userName: story.userName,
        userProfileImage: story.userProfileImage,
        content: story.content,
        location: story.location,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        isViewed: story.isViewed,
        stats: story.getStats()
      }
    });

  } catch (error) {
    console.error('❌ Error creando story:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener stories de un usuario específico
export const getUserStories = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // Verificar que el usuario existe
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Obtener stories del usuario
    const stories = await Story.findByUserId(userId);

    // Filtrar solo stories activos (no expirados)
    const activeStories = stories.filter(story => 
      new Date(story.expiresAt) > new Date()
    );

    // Marcar stories como vistos si el usuario actual los está viendo
    if (userId !== currentUserId) {
      for (const story of activeStories) {
        if (!story.hasBeenViewedBy(currentUserId)) {
          await story.markAsViewed(currentUserId);
        }
      }
    }

    console.log(`✅ Stories obtenidos para usuario ${userId}: ${activeStories.length} activos`);

    res.json({
      success: true,
      data: {
        userId,
        userName: user.displayName || user.username,
        userProfileImage: user.profileImage,
        stories: activeStories.map(story => ({
          id: story.id,
          content: story.content,
          location: story.location,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
          isViewed: story.hasBeenViewedBy(currentUserId),
          stats: story.getStats()
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo stories del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener stories de amigos
export const getFriendsStories = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { friendIds } = req.query;

    let friendsToCheck = [];

    if (friendIds) {
      // Si se proporcionan IDs específicos de amigos
      friendsToCheck = friendIds.split(',');
    } else {
      // Obtener lista de amigos del usuario (esto requeriría implementar la lógica de amigos)
      // Por ahora, retornamos un array vacío
      friendsToCheck = [];
    }

    // Obtener stories de amigos
    const stories = await Story.findStoriesByFriends(currentUserId, friendsToCheck);

    // Agrupar stories por usuario
    const storiesByUser = {};
    stories.forEach(story => {
      if (!storiesByUser[story.userId]) {
        storiesByUser[story.userId] = {
          userId: story.userId,
          userName: story.userName,
          userProfileImage: story.userProfileImage,
          stories: []
        };
      }
      storiesByUser[story.userId].stories.push({
        id: story.id,
        content: story.content,
        location: story.location,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        isViewed: story.hasBeenViewedBy(currentUserId),
        stats: story.getStats()
      });
    });

    console.log(`✅ Stories de amigos obtenidos para usuario ${currentUserId}: ${Object.keys(storiesByUser).length} usuarios con stories`);

    res.json({
      success: true,
      data: {
        storiesByUser: Object.values(storiesByUser),
        totalUsers: Object.keys(storiesByUser).length,
        totalStories: stories.length
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo stories de amigos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todos los stories activos
export const getAllActiveStories = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userIds } = req.query;

    let targetUserIds = [];
    if (userIds) {
      targetUserIds = userIds.split(',');
    }

    // Obtener stories activos
    const stories = await Story.findActiveStories(targetUserIds);

    // Agrupar stories por usuario
    const storiesByUser = {};
    stories.forEach(story => {
      if (!storiesByUser[story.userId]) {
        storiesByUser[story.userId] = {
          userId: story.userId,
          userName: story.userName,
          userProfileImage: story.userProfileImage,
          stories: []
        };
      }
      storiesByUser[story.userId].stories.push({
        id: story.id,
        content: story.content,
        location: story.location,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        isViewed: story.hasBeenViewedBy(currentUserId),
        stats: story.getStats()
      });
    });

    console.log(`✅ Todos los stories activos obtenidos: ${Object.keys(storiesByUser).length} usuarios con stories`);

    res.json({
      success: true,
      data: {
        storiesByUser: Object.values(storiesByUser),
        totalUsers: Object.keys(storiesByUser).length,
        totalStories: stories.length
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo todos los stories activos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Marcar story como visto
export const markStoryAsViewed = async (req, res) => {
  try {
    const { storyId } = req.params;
    const currentUserId = req.user.id;

    // Buscar el story (sin userId para búsqueda general)
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story no encontrado',
        error: 'STORY_NOT_FOUND'
      });
    }

    // Verificar que el story no haya expirado
    if (new Date(story.expiresAt) <= new Date()) {
      return res.status(410).json({
        success: false,
        message: 'Story ha expirado',
        error: 'STORY_EXPIRED'
      });
    }

    // Marcar como visto
    await story.markAsViewed(currentUserId);

    console.log(`✅ Story ${storyId} marcado como visto por usuario ${currentUserId}`);

    res.json({
      success: true,
      message: 'Story marcado como visto',
      data: {
        storyId,
        viewedBy: story.viewedBy,
        stats: story.getStats()
      }
    });

  } catch (error) {
    console.error('❌ Error marcando story como visto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Dar like a un story
export const likeStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const currentUserId = req.user.id;

    // Buscar el story (sin userId para búsqueda general)
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story no encontrado',
        error: 'STORY_NOT_FOUND'
      });
    }

    // Verificar que el story no haya expirado
    if (new Date(story.expiresAt) <= new Date()) {
      return res.status(410).json({
        success: false,
        message: 'Story ha expirado',
        error: 'STORY_EXPIRED'
      });
    }

    // Agregar like
    await story.addLike(currentUserId);

    console.log(`✅ Like agregado al story ${storyId} por usuario ${currentUserId}`);

    res.json({
      success: true,
      message: 'Like agregado exitosamente',
      data: {
        storyId,
        likes: story.likes,
        stats: story.getStats()
      }
    });

  } catch (error) {
    console.error('❌ Error agregando like al story:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Quitar like de un story
export const unlikeStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const currentUserId = req.user.id;

    // Buscar el story (sin userId para búsqueda general)
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story no encontrado',
        error: 'STORY_NOT_FOUND'
      });
    }

    // Quitar like
    await story.removeLike(currentUserId);

    console.log(`✅ Like removido del story ${storyId} por usuario ${currentUserId}`);

    res.json({
      success: true,
      message: 'Like removido exitosamente',
      data: {
        storyId,
        likes: story.likes,
        stats: story.getStats()
      }
    });

  } catch (error) {
    console.error('❌ Error removiendo like del story:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Agregar reacción a un story
export const addReaction = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { type } = req.body;
    const currentUserId = req.user.id;

    // Validar tipo de reacción
    const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
    if (!type || !validReactions.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Tipo de reacción debe ser uno de: ${validReactions.join(', ')}`,
        error: 'INVALID_REACTION_TYPE'
      });
    }

    // Buscar el story (sin userId para búsqueda general)
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story no encontrado',
        error: 'STORY_NOT_FOUND'
      });
    }

    // Verificar que el story no haya expirado
    if (new Date(story.expiresAt) <= new Date()) {
      return res.status(410).json({
        success: false,
        message: 'Story ha expirado',
        error: 'STORY_EXPIRED'
      });
    }

    // Agregar reacción
    await story.addReaction(currentUserId, type);

    console.log(`✅ Reacción ${type} agregada al story ${storyId} por usuario ${currentUserId}`);

    res.json({
      success: true,
      message: 'Reacción agregada exitosamente',
      data: {
        storyId,
        reactions: story.reactions,
        stats: story.getStats()
      }
    });

  } catch (error) {
    console.error('❌ Error agregando reacción al story:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar un story
export const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const currentUserId = req.user.id;

    // Buscar el story (sin userId para búsqueda general)
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story no encontrado',
        error: 'STORY_NOT_FOUND'
      });
    }

    // Verificar que el usuario sea el propietario del story
    if (story.userId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este story',
        error: 'FORBIDDEN'
      });
    }

    // Eliminar el story
    await story.delete();

    console.log(`✅ Story ${storyId} eliminado por usuario ${currentUserId}`);

    res.json({
      success: true,
      message: 'Story eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando story:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener estadísticas de un story
export const getStoryStats = async (req, res) => {
  try {
    const { storyId } = req.params;

    // Buscar el story (sin userId para búsqueda general)
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Story no encontrado',
        error: 'STORY_NOT_FOUND'
      });
    }

    const stats = story.getStats();

    res.json({
      success: true,
      data: {
        storyId,
        stats,
        viewedBy: story.viewedBy,
        likes: story.likes,
        reactions: story.reactions
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas del story:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Limpiar stories expirados (endpoint administrativo)
export const cleanupExpiredStories = async (req, res) => {
  try {
    const deletedCount = await Story.cleanupExpiredStories();

    console.log(`✅ Limpieza de stories expirados completada: ${deletedCount} eliminados`);

    res.json({
      success: true,
      message: 'Limpieza de stories expirados completada',
      data: {
        deletedCount
      }
    });

  } catch (error) {
    console.error('❌ Error limpiando stories expirados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};
