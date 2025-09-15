import express from 'express';
import { updateProfile, getProfile, giveSuperLike, getUserProfileInfo } from '../controllers/profileController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Rutas protegidas que requieren autenticación
router.get('/', auth, getProfile);
router.put('/', auth, updateProfile);

// Ruta para dar super like a un usuario
router.post('/:userId/super-like', auth, giveSuperLike);

// Ruta optimizada para obtener toda la información del perfil de un usuario
router.get('/:userId/info', auth, getUserProfileInfo);

export default router;
