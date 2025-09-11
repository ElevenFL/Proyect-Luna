import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { 
  getOrCreateConversation, 
  sendMessage, 
  listMessages, 
  listConversations,
  getNewMessages,
  getConversationStats,
  markMessagesAsRead,
  getOtherUserInfo
} from '../controllers/chatController.js';

const router = Router();

// Rutas optimizadas para chat

// Lista conversaciones del usuario autenticado
router.get('/conversations', auth, listConversations);

// Obtiene o crea conversación con otro usuario
router.post('/conversations/with/:otherUserId', auth, getOrCreateConversation);

// Lista mensajes de una conversación
router.get('/conversations/:conversationId/messages', auth, listMessages);

// Obtiene solo mensajes nuevos (sincronización incremental)
router.get('/conversations/:conversationId/messages/new', auth, getNewMessages);

// Obtiene estadísticas de una conversación
router.get('/conversations/:conversationId/stats', auth, getConversationStats);

// Obtiene información del otro usuario en una conversación
router.get('/conversations/:conversationId/other-user', auth, getOtherUserInfo);

// Envía mensaje
router.post('/conversations/:conversationId/messages', auth, sendMessage);

// Marca mensajes como leídos
router.patch('/conversations/:conversationId/messages/read', auth, markMessagesAsRead);

export default router;