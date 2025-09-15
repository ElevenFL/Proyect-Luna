import express from "express";
import { auth } from "../middleware/auth.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getReceivedFriendRequests,
  getSentFriendRequests,
  cancelFriendRequest,
  getAllFriendRequests,
  getFriends
} from "../controllers/friendRequestController.js";

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(auth);

// POST /api/friend-requests/send/:userId - Enviar solicitud de amistad
router.post("/send/:userId", sendFriendRequest);

// GET /api/friend-requests/received - Obtener solicitudes recibidas
router.get("/received", getReceivedFriendRequests);

// GET /api/friend-requests/sent - Obtener solicitudes enviadas
router.get("/sent", getSentFriendRequests);

// GET /api/friend-requests/all - Obtener todas las solicitudes (enviadas y recibidas)
router.get("/all", getAllFriendRequests);

// GET /api/friend-requests/friends - Obtener lista de amigos aceptados
router.get("/friends", getFriends);

// POST /api/friend-requests/:friendRequestId/accept - Aceptar solicitud
router.post("/:friendRequestId/accept", acceptFriendRequest);

// POST /api/friend-requests/:friendRequestId/reject - Rechazar solicitud
router.post("/:friendRequestId/reject", rejectFriendRequest);

// DELETE /api/friend-requests/:friendRequestId - Cancelar solicitud enviada
router.delete("/:friendRequestId", cancelFriendRequest);

export default router;

