import express from 'express';
import { updateProfile, getProfile } from '../controllers/profileController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Rutas protegidas que requieren autenticación
router.get('/', auth, getProfile);
router.put('/', auth, updateProfile);

export default router;
