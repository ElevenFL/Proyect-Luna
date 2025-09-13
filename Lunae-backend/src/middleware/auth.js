import jwt from 'jsonwebtoken';
import { User } from '../models/Users.js';

// Configuración de autenticación
const AUTH_CONFIG = {
  TOKEN_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_here'
};

// Función para verificar token de Amplify (AWS Cognito)
const verifyAmplifyToken = async (token) => {
  try {
    // Para tokens de Amplify, necesitamos verificar con AWS Cognito
    // Por ahora, vamos a implementar una verificación básica
    // En producción, deberías usar la librería aws-jwt-verify
    
    // Decodificar el token JWT sin verificar la firma
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      throw new Error('Token inválido');
    }
    
    // Verificar que el token tenga la estructura esperada de Cognito
    if (!decoded.sub || !decoded.username) {
      throw new Error('Token de Cognito inválido');
    }
    
    // Buscar usuario por amplifySub
    const user = await User.findByAmplifySub(decoded.sub);
    
    if (!user) {
      // Si el usuario no existe, crearlo automáticamente
      console.log('🔄 Usuario de Amplify no encontrado, creándolo automáticamente...');
      
      // Validar que tenemos un email válido
      let email = decoded.email;
      
      // Si no hay email o el email es igual al username (caso problemático), 
      // no crear el usuario automáticamente
      if (!email || email === decoded.username || !email.includes('@')) {
        console.log('❌ No se puede crear usuario automáticamente: email inválido o faltante');
        throw new Error('Usuario de Amplify no encontrado y no se puede crear automáticamente sin email válido');
      }
      
      const newUser = await User.create({
        username: decoded.username,
        email: email,
        amplifySub: decoded.sub,
        active: true,
        profileCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Usuario de Amplify creado automáticamente:', newUser.id);
      return newUser;
    }
    
    return user;
  } catch (error) {
    console.error('❌ Error verificando token de Amplify:', error);
    throw error;
  }
};

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Token de acceso requerido',
        error: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    let user = null;

    try {
      // Primero intentar verificar como token JWT local
      try {
        const decoded = jwt.verify(token, AUTH_CONFIG.TOKEN_SECRET);
        user = await User.findById(decoded.userId);
        
        if (!user) {
          throw new Error('Usuario no encontrado');
        }
        
        // Verificar si el token fue emitido antes del último cambio de contraseña
        if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
          throw new Error('La contraseña ha sido cambiada, por favor inicie sesión nuevamente');
        }
        
        console.log('✅ Usuario autenticado con JWT local:', user.id);
      } catch (jwtError) {
        // Si falla la verificación JWT, intentar como token de Amplify
        console.log('🔄 Intentando verificar como token de Amplify...');
        user = await verifyAmplifyToken(token);
        console.log('✅ Usuario autenticado con token de Amplify:', user.id);
      }
      
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expirado',
          error: 'TOKEN_EXPIRED'
        });
      }
      
      if (error.message.includes('Usuario no encontrado')) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        });
      }
      
      if (error.message.includes('La contraseña ha sido cambiada')) {
        return res.status(401).json({
          success: false,
          message: 'La contraseña ha sido cambiada, por favor inicie sesión nuevamente',
          error: 'PASSWORD_CHANGED'
        });
      }
      
      console.error('❌ Error de autenticación:', error);
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'INVALID_TOKEN'
      });
    }

    // Excluir contraseña del usuario
    req.user = user.select ? user.select('-password') : user;
    
    // Debug: Log para verificar la estructura del usuario autenticado (comentado para producción)
    // console.log('🔍 Auth Middleware Debug:', {
    //   'user.id': user?.id,
    //   'user.userId': user?.userId,
    //   'req.user.id': req.user?.id,
    //   'req.user.userId': req.user?.userId
    // });
    
    next();
  } catch (error) {
    console.error('❌ Error en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'SERVER_ERROR'
    });
  }
};
