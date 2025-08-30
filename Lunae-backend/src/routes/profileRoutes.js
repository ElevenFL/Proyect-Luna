import express from 'express';
import { updateProfile, getProfile } from '../controllers/profileController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Rutas protegidas que requieren autenticación
router.get('/', authenticateToken, getProfile);
router.put('/', authenticateToken, updateProfile);

export default router;
