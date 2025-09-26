import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { 
  createStory,
  getUserStories,
  getFriendsStories,
  getAllActiveStories,
  markStoryAsViewed,
  likeStory,
  unlikeStory,
  addReaction,
  deleteStory,
  getStoryStats,
  cleanupExpiredStories
} from '../controllers/storiesController.js';

const router = Router();

// Rutas para Stories

// Crear un nuevo story
router.post('/', auth, createStory);

// Obtener stories de un usuario específico
router.get('/user/:userId', auth, getUserStories);

// Obtener stories de amigos
router.get('/friends', auth, getFriendsStories);

// Obtener todos los stories activos
router.get('/active', auth, getAllActiveStories);

// Marcar un story como visto
router.patch('/:storyId/view', auth, markStoryAsViewed);

// Dar like a un story
router.post('/:storyId/like', auth, likeStory);

// Quitar like de un story
router.delete('/:storyId/like', auth, unlikeStory);

// Agregar reacción a un story
router.post('/:storyId/reaction', auth, addReaction);

// Eliminar un story
router.delete('/:storyId', auth, deleteStory);

// Obtener estadísticas de un story
router.get('/:storyId/stats', auth, getStoryStats);

// Limpiar stories expirados (endpoint administrativo)
router.post('/cleanup', auth, cleanupExpiredStories);

export default router;


