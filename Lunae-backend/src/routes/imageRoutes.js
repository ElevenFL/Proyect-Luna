import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  testConnection,
  getProfileImageUploadUrl,
  updateProfileImageUrl,
  deleteProfileImage,
  getImageDownloadUrl,
} from "../controllers/imageController.js";

const router = express.Router();

// Ruta de prueba de conexión (sin autenticación para testing)
router.get("/test-connection", testConnection);

// Rutas protegidas (requieren autenticación)
router.post("/profile/upload-url", authenticateToken, getProfileImageUploadUrl);
router.put("/profile/update-url", authenticateToken, updateProfileImageUrl);
router.delete("/profile/delete", authenticateToken, deleteProfileImage);
router.get("/download/:key", authenticateToken, getImageDownloadUrl);

export default router;
