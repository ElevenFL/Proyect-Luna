import express from 'express';
import { updateProfile, getProfile, giveSuperLike } from '../controllers/profileController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Rutas protegidas que requieren autenticación
router.get('/', auth, getProfile);
router.put('/', auth, updateProfile);

// Ruta para dar super like a un usuario
router.post('/:userId/super-like', auth, giveSuperLike);

export default router;
