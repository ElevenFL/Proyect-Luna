import express from 'express';
import { auth } from '../middleware/auth.js';
import { PushToken } from '../models/PushToken.js';
import { PushNotificationService } from '../services/pushNotificationService.js';

const router = express.Router();

/**
 * POST /api/push-tokens/register
 * Registra un nuevo push token para el usuario
 */
router.post('/register', auth, async (req, res) => {
  try {
    const { userId, pushToken, platform, deviceId } = req.body;

    // Validar que el usuario autenticado coincida con el userId
    if (req.user.id !== userId && String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado para registrar token de otro usuario',
        error: 'FORBIDDEN'
      });
    }

    // Validar campos requeridos
    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token es requerido',
        error: 'MISSING_TOKEN'
      });
    }

    // Validar formato de token de Expo
    const { Expo } = await import('expo-server-sdk');
    if (!Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({
        success: false,
        message: 'Token de push inválido',
        error: 'INVALID_TOKEN'
      });
    }

    // Registrar el token
    const token = await PushToken.register(
      userId,
      pushToken,
      platform || 'unknown',
      deviceId
    );

    console.log(`✅ Token registrado exitosamente para usuario ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Token registrado exitosamente',
      data: {
        userId: token.userId,
        platform: token.platform,
        createdAt: token.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error en POST /push-tokens/register:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/push-tokens/unregister
 * Desactiva un push token
 */
router.post('/unregister', auth, async (req, res) => {
  try {
    const { userId, pushToken } = req.body;

    // Validar que el usuario autenticado coincida con el userId
    if (req.user.id !== userId && String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado',
        error: 'FORBIDDEN'
      });
    }

    // Validar campos requeridos
    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token es requerido',
        error: 'MISSING_TOKEN'
      });
    }

    // Desactivar el token
    const success = await PushToken.deactivate(userId, pushToken);

    if (success) {
      console.log(`✅ Token desactivado exitosamente para usuario ${userId}`);
      res.status(200).json({
        success: true,
        message: 'Token desactivado exitosamente'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Token no encontrado',
        error: 'TOKEN_NOT_FOUND'
      });
    }
  } catch (error) {
    console.error('❌ Error en POST /push-tokens/unregister:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
});

/**
 * GET /api/push-tokens/user/:userId
 * Obtiene todos los tokens activos de un usuario (solo para el propio usuario o admin)
 */
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validar que el usuario autenticado coincida con el userId
    if (req.user.id !== userId && String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'No autorizado',
        error: 'FORBIDDEN'
      });
    }

    const tokens = await PushToken.getTokensByUserId(userId);

    res.status(200).json({
      success: true,
      data: {
        count: tokens.length,
        tokens: tokens.map(t => ({
          platform: t.platform,
          createdAt: t.createdAt,
          lastUsed: t.lastUsed
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error en GET /push-tokens/user/:userId:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/push-tokens/test
 * Envía una notificación de prueba (solo en desarrollo)
 */
router.post('/test', auth, async (req, res) => {
  try {
    // Solo permitir en desarrollo
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint de prueba no disponible en producción',
        error: 'NOT_AVAILABLE'
      });
    }

    const userId = req.user.id;
    const { title, body, data } = req.body;

    const result = await PushNotificationService.sendNotification(
      userId,
      title || 'Notificación de prueba',
      body || 'Esta es una notificación de prueba desde Luna',
      data || { type: 'test' }
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Notificación de prueba enviada',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Error enviando notificación de prueba',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Error en POST /push-tokens/test:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
});

/**
 * DELETE /api/push-tokens/all
 * Desactiva todos los tokens del usuario (útil para logout)
 */
router.delete('/all', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const success = await PushToken.deactivateAllUserTokens(userId);

    if (success) {
      console.log(`✅ Todos los tokens desactivados para usuario ${userId}`);
      res.status(200).json({
        success: true,
        message: 'Todos los tokens desactivados exitosamente'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error desactivando tokens',
        error: 'DEACTIVATION_ERROR'
      });
    }
  } catch (error) {
    console.error('❌ Error en DELETE /push-tokens/all:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
});

export default router;

