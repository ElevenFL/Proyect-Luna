import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getOrCreateConversation, sendMessage, listMessages, listConversations } from '../controllers/chatController.js';

const router = Router();

// Lista conversaciones del usuario autenticado
router.get('/conversations', auth, listConversations);

// Obtiene o crea conversación con otro usuario
router.post('/conversations/with/:otherUserId', auth, getOrCreateConversation);

// Lista mensajes de una conversación
router.get('/conversations/:conversationId/messages', auth, listMessages);

// Envía mensaje
router.post('/conversations/:conversationId/messages', auth, sendMessage);

export default router;



