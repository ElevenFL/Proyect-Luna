import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  generateUploadUrl,
  generateDownloadUrl,
  deleteImage,
  listImages
} from '../controllers/imageController.js';

const router = express.Router();

// Rutas específicas primero
router.post('/upload-url', auth, generateUploadUrl);
router.get('/list', auth, listImages);

// Rutas con parámetros después
router.get('/download-url/:imageKey', auth, generateDownloadUrl);
router.delete('/delete/:imageKey', auth, deleteImage);

export default router;
