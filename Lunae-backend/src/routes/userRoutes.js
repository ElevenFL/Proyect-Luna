import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/Users.js";
import { auth } from "../middleware/auth.js";
import { getFlagFromAddress } from "../utils/countryFlags.js";
import { giveSuperLike, checkSuperLikeStatus } from "../controllers/profileController.js";
import { sendFriendRequest } from "../controllers/friendRequestController.js";
import { FriendRequest } from "../models/FriendRequest.js";
import { Chat } from "../models/Chat.js";

const router = express.Router();

// Configuración de autenticación
const AUTH_CONFIG = {
  TOKEN_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_here',
  JWT_EXPIRATION: process.env.JWT_EXPIRES_IN || '24h'
};

// POST /api/users/register - Registrar usuario
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log('📝 Intentando registrar usuario:', { username, email });

    // Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Todos los campos son requeridos",
        error: "MISSING_FIELDS"
      });
    }

    // Validar formato de email
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Formato de email inválido",
        error: "INVALID_EMAIL_FORMAT"
      });
    }

    // Validar contraseña
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres, una mayúscula, una minúscula y un número",
        error: "INVALID_PASSWORD_FORMAT"
      });
    }

    // Validar username
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        success: false,
        message: "El username debe tener entre 3 y 30 caracteres y solo puede contener letras, números, guiones y guiones bajos",
        error: "INVALID_USERNAME_FORMAT"
      });
    }

    // Verificar si el email ya existe
    console.log('🔍 Verificando si el email ya existe...');
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      console.log('❌ Email ya existe:', email);
      return res.status(400).json({ 
        success: false,
        message: "El email ya está registrado",
        error: "EMAIL_EXISTS"
      });
    }

    // Verificar si el username ya existe
    console.log('🔍 Verificando si el username ya existe...');
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      console.log('❌ Username ya existe:', username);
      return res.status(400).json({ 
        success: false,
        message: "El username ya está en uso",
        error: "USERNAME_EXISTS"
      });
    }

    // Crear nuevo usuario usando el nuevo modelo
    console.log('👤 Creando nuevo usuario...');
    const newUser = await User.create({
      username,
      email,
      password,
      active: true,
      loginAttempts: 0,
      profileCompleted: false
    });

    console.log('✅ Usuario creado exitosamente:', newUser.id);

    // Generar token JWT
    const token = jwt.sign(
      { 
        userId: newUser.id,
        version: newUser.passwordChangedAt ? newUser.passwordChangedAt.getTime() : undefined
      },
      AUTH_CONFIG.TOKEN_SECRET,
      { expiresIn: AUTH_CONFIG.JWT_EXPIRATION }
    );

    res.status(201).json({
      success: true,
      message: "Usuario registrado exitosamente",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        profileCompleted: false
      }
    });
  } catch (error) {
    console.error("❌ Error en registro:", error);
    
    // Manejar errores específicos de DynamoDB
    if (error.name === 'ConditionalCheckFailedException') {
      return res.status(400).json({
        success: false,
        message: "El usuario ya existe",
        error: "USER_EXISTS"
      });
    } else if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Se creará automáticamente.');
      return res.status(500).json({
        success: false,
        message: "Error de configuración de la base de datos",
        error: "DB_CONFIG_ERROR"
      });
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Error de permisos en DynamoDB.');
      return res.status(500).json({
        success: false,
        message: "Error de permisos en la base de datos",
        error: "DB_PERMISSION_ERROR"
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
});

// POST /api/users/login - Iniciar sesión
router.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    console.log('🔐 Intentando login:', { usernameOrEmail });

    // Validaciones básicas
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Username/Email y contraseña son requeridos",
        error: "MISSING_CREDENTIALS"
      });
    }

    // Buscar usuario por username o email
    let user = null;
    if (usernameOrEmail.includes('@')) {
      console.log('🔍 Buscando usuario por email...');
      user = await User.findByEmail(usernameOrEmail);
    } else {
      console.log('🔍 Buscando usuario por username...');
      user = await User.findByUsername(usernameOrEmail);
    }

    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(401).json({ 
        success: false,
        message: "Credenciales inválidas",
        error: "INVALID_CREDENTIALS"
      });
    }

    console.log('✅ Usuario encontrado:', user.id);

    // Verificar si la cuenta está activa
    if (!user.active) {
      console.log('❌ Cuenta desactivada:', user.id);
      return res.status(401).json({
        success: false,
        message: "Cuenta desactivada. Por favor, contacte a soporte.",
        error: "ACCOUNT_DISABLED"
      });
    }

    // Verificar si la cuenta está bloqueada
    if (user.isLocked()) {
      const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60); // en minutos
      console.log('❌ Cuenta bloqueada:', user.id, 'por', remainingTime, 'minutos');
      return res.status(429).json({
        success: false,
        message: `Cuenta bloqueada temporalmente. Intente nuevamente en ${remainingTime} minutos.`,
        error: "ACCOUNT_LOCKED",
        lockExpires: user.lockUntil
      });
    }

    // Verificar contraseña
    console.log('🔑 Verificando contraseña...');
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('❌ Contraseña incorrecta para usuario:', user.id);
      // Incrementar contador de intentos fallidos
      await user.incrementLoginAttempts();

      // Si la cuenta se bloqueó después de este intento
      if (user.isLocked()) {
        console.log('🚫 Cuenta bloqueada por demasiados intentos fallidos:', user.id);
        return res.status(429).json({
          success: false,
          message: "Demasiados intentos fallidos. Cuenta bloqueada por 1 hora.",
          error: "ACCOUNT_LOCKED",
          lockExpires: user.lockUntil
        });
      }

      return res.status(401).json({ 
        success: false,
        message: "Credenciales inválidas",
        error: "INVALID_CREDENTIALS",
        remainingAttempts: 5 - user.loginAttempts
      });
    }

    console.log('✅ Contraseña correcta para usuario:', user.id);

    // Resetear intentos de login si la contraseña es correcta
    await user.resetLoginAttempts();

    // Generar token JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        version: user.passwordChangedAt ? user.passwordChangedAt.getTime() : undefined
      },
      AUTH_CONFIG.TOKEN_SECRET,
      { expiresIn: AUTH_CONFIG.JWT_EXPIRATION }
    );

    console.log('🎉 Login exitoso para usuario:', user.id);

    res.json({
      success: true,
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        profileImage: user.profileImage,
        profileCompleted: user.profileCompleted
      }
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    
    // Manejar errores específicos de DynamoDB
    if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Se creará automáticamente.');
      return res.status(500).json({
        success: false,
        message: "Error de configuración de la base de datos",
        error: "DB_CONFIG_ERROR"
      });
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Error de permisos en DynamoDB.');
      return res.status(500).json({
        success: false,
        message: "Error de permisos en la base de datos",
        error: "DB_PERMISSION_ERROR"
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
});

// POST /api/users/sync-amplify - Sincronizar usuario de Amplify con DynamoDB
router.post("/sync-amplify", async (req, res) => {
  try {
    const { username, email, sub } = req.body;

    console.log('🔄 Intentando sincronizar usuario de Amplify:', { username, email, sub });

    // Validaciones básicas
    if (!username || !email || !sub) {
      return res.status(400).json({ 
        success: false,
        message: "Username, email y sub son requeridos",
        error: "MISSING_FIELDS"
      });
    }

    // Validar formato de email
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Formato de email inválido",
        error: "INVALID_EMAIL_FORMAT"
      });
    }

    // Validar que el email no sea igual al username (caso problemático)
    if (email === username) {
      return res.status(400).json({
        success: false,
        message: "El email no puede ser igual al username",
        error: "INVALID_EMAIL_USERNAME_MATCH"
      });
    }

    // Verificar si el usuario ya existe en DynamoDB
    console.log('🔍 Verificando si el usuario ya existe...');
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log('✅ Usuario ya existe:', existingUser.id);
      // Si el usuario ya existe, actualizar el sub de Amplify si es necesario
      if (existingUser.amplifySub !== sub) {
        console.log('🔄 Actualizando sub de Amplify...');
        await existingUser.update({ amplifySub: sub });
      }
      
      return res.status(200).json({
        success: true,
        message: "Usuario ya existe en la base de datos",
        data: {
          user: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            profileCompleted: existingUser.profileCompleted
          }
        }
      });
    }

    // Crear nuevo usuario en DynamoDB
    console.log('👤 Creando nuevo usuario en DynamoDB...');
    const newUser = await User.create({
      username,
      email,
      amplifySub: sub, // ID único de Amplify
      active: true,
      profileCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Usuario sincronizado exitosamente:', newUser.id);

    res.status(201).json({
      success: true,
      message: "Usuario sincronizado exitosamente",
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          profileCompleted: false
        }
      }
    });
  } catch (error) {
    console.error("❌ Error en sincronización:", error);
    console.error("❌ Stack trace:", error.stack);
    console.error("❌ Error name:", error.name);
    console.error("❌ Error message:", error.message);
    
    // Manejar errores específicos de DynamoDB
    if (error.name === 'ConditionalCheckFailedException') {
      return res.status(400).json({
        success: false,
        message: "El usuario ya existe",
        error: "USER_EXISTS"
      });
    } else if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Intentando crearla automáticamente...');
      try {
        await User.ensureTableExists();
        console.log('✅ Tabla creada, reintentando sincronización...');
        // Reintentar la operación después de crear la tabla
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
          return res.status(200).json({
            success: true,
            message: "Usuario ya existe en la base de datos",
            data: {
              user: {
                id: existingUser.id,
                username: existingUser.username,
                email: existingUser.email,
                profileCompleted: existingUser.profileCompleted
              }
            }
          });
        } else {
          const newUser = await User.create({
            username,
            email,
            amplifySub: sub,
            active: true,
            profileCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          
          return res.status(201).json({
            success: true,
            message: "Usuario sincronizado exitosamente",
            data: {
              user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                profileCompleted: false
              }
            }
          });
        }
      } catch (retryError) {
        console.error('❌ Error en reintento:', retryError);
        return res.status(500).json({
          success: false,
          message: "Error de configuración de la base de datos",
          error: "DB_CONFIG_ERROR",
          details: retryError.message
        });
      }
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Error de permisos en DynamoDB.');
      return res.status(500).json({
        success: false,
        message: "Error de permisos en la base de datos",
        error: "DB_PERMISSION_ERROR",
        details: "Verifica las credenciales de AWS y los permisos de DynamoDB"
      });
    } else if (error.name === 'UnrecognizedClientException') {
      console.log('💡 Error de configuración del cliente AWS.');
      return res.status(500).json({
        success: false,
        message: "Error de configuración del cliente AWS",
        error: "AWS_CONFIG_ERROR",
        details: "Verifica la región y las credenciales de AWS"
      });
    } else if (error.name === 'ValidationException') {
      console.log('💡 Error de validación en DynamoDB.');
      return res.status(500).json({
        success: false,
        message: "Error de validación en la base de datos",
        error: "DB_VALIDATION_ERROR",
        details: error.message
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR",
      details: error.message
    });
  }
});

// GET /api/users/profile - Obtener perfil del usuario autenticado
router.get("/profile", auth, async (req, res) => {
  try {
    console.log('👤 Obteniendo perfil del usuario:', req.user.id);
    
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error("❌ Error obteniendo perfil:", error);
    res.status(500).json({ 
      message: "Error interno del servidor" 
    });
  }
});

// GET /api/users/profile-status - Verificar estado del perfil del usuario
router.get("/profile-status", auth, async (req, res) => {
  try {
    const user = req.user;
    console.log('📊 Verificando estado del perfil del usuario:', user.id);
    
    res.json({
      success: true,
      message: "Perfil del usuario verificado",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileCompleted: user.profileCompleted
      }
    });
  } catch (error) {
    console.error("❌ Error obteniendo estado del perfil:", error);
    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
});

// GET usuarios ordenados por conexión (para el home) con prefetching de información de perfiles
router.get("/home", auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    console.log('🏠 Obteniendo usuarios para el home...');
    console.log('👤 Usuario actual (excluir de la lista):', currentUserId);
    
    // Primero, obtener solo usuarios para verificar que funciona
    console.log('🔄 Obteniendo usuarios básicos...');
    const users = await User.findUsersOrderedByConnection();
    console.log('📊 Usuarios obtenidos:', users.length);

    // Verificar si tenemos usuarios
    if (!users || users.length === 0) {
      console.log('⚠️ No se encontraron usuarios, devolviendo respuesta sin prefetching');
      return res.json({
        success: true,
        message: "No hay usuarios disponibles",
        data: [],
        prefetching: {
          enabled: false,
          reason: "no_users_found"
        }
      });
    }

    // Filtrar el usuario actual de la lista
    const filteredUsers = users.filter(user => user.id !== currentUserId);
    console.log(`🔍 Usuarios filtrados: ${users.length} -> ${filteredUsers.length} (excluido usuario actual)`);

    // Intentar prefetching solo si tenemos usuarios
    let prefetchingEnabled = false;
    let allFriendRequests = [];
    let conversations = [];
    let prefetchingError = null;

    try {
      console.log('🔄 Intentando prefetching...');
      const [friendRequestsResult, conversationsResult] = await Promise.allSettled([
        FriendRequest.findAll(),
        Chat.listUserConversations(currentUserId)
      ]);

      allFriendRequests = friendRequestsResult.status === 'fulfilled' ? friendRequestsResult.value : [];
      conversations = conversationsResult.status === 'fulfilled' ? conversationsResult.value.items : [];
      
      console.log('📊 Prefetching resultados:');
      console.log('  - FriendRequests:', allFriendRequests.length);
      console.log('  - Conversations:', conversations.length);
      
      prefetchingEnabled = true;
      console.log('✅ Prefetching habilitado exitosamente');
    } catch (prefetchError) {
      console.warn('⚠️ Error en prefetching, continuando sin él:', prefetchError.message);
      prefetchingEnabled = false;
      prefetchingError = prefetchError.message;
    }

    // Crear mapas para búsqueda rápida si el prefetching está habilitado
    const friendRequestMap = new Map();
    const conversationMap = new Map();

    if (prefetchingEnabled) {
      allFriendRequests.forEach(request => {
        const key = `${request.senderId}-${request.receiverId}`;
        const reverseKey = `${request.receiverId}-${request.senderId}`;
        friendRequestMap.set(key, request);
        friendRequestMap.set(reverseKey, request);
      });

      conversations.forEach(conv => {
        if (conv.participants) {
          conv.participants.forEach(participantId => {
            conversationMap.set(participantId, conv);
          });
        }
      });
    }

    // Formatear usuarios
    const formattedUsers = await Promise.all(
      filteredUsers.map(async user => {
        // Obtener la bandera basada en la ubicación del usuario
        const countryFlag = getFlagFromAddress(user.location?.address);
        
        const baseUser = {
          id: user.id,
          name: user.displayName || user.username,
          age: user.birthDate ? Math.floor((Date.now() - new Date(user.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null,
          gender: user.gender,
          profileImage: user.profileImage,
          country: user.location?.country || 'Unknown',
          countryFlag: countryFlag,
          isOnline: user.isOnline,
          description: user.description || (user.displayName ? `Usuario activo en Lunea` : 'Nuevo en Lunea'),
          lastConnection: user.lastConnection,
          connectionPriority: user.connectionPriority
        };

        // Agregar prefetching solo si está habilitado
        if (prefetchingEnabled) {
          let hasGivenSuperLike = false;
          let friendRequestStatus = 'none';
          let hasActiveConversation = false;

          try {
            // Verificar estado de super like
            hasGivenSuperLike = await User.hasGivenSuperLike(currentUserId, user.id);
            
            // Verificar estado de solicitud de amistad
            const friendRequestKey = `${currentUserId}-${user.id}`;
            const reverseFriendRequestKey = `${user.id}-${currentUserId}`;
            const relatedFriendRequest = friendRequestMap.get(friendRequestKey) || friendRequestMap.get(reverseFriendRequestKey);
            friendRequestStatus = relatedFriendRequest ? relatedFriendRequest.status : 'none';
            
            // Verificar conversación activa
            hasActiveConversation = conversationMap.has(user.id);
          } catch (prefetchError) {
            console.warn(`⚠️ Error en prefetching para usuario ${user.id}:`, prefetchError.message);
          }

          return {
            ...baseUser,
            prefetchData: {
              superLike: {
                starsCount: user.starsCount || 0,
                hasGivenSuperLike: hasGivenSuperLike
              },
              friendRequest: {
                status: friendRequestStatus
              },
              conversation: {
                hasActiveConversation: hasActiveConversation
              }
            }
          };
        } else {
          return baseUser;
        }
      })
    );

    // Filtrar solo usuarios con edad válida
    const validUsers = formattedUsers.filter(user => user.age !== null);
    
    console.log(`✅ Encontrados ${validUsers.length} usuarios para el home`);
    console.log(`📦 Prefetching habilitado: ${prefetchingEnabled}`);
    
    const response = {
      success: true,
      message: prefetchingEnabled 
        ? "Usuarios obtenidos exitosamente con prefetching" 
        : "Usuarios obtenidos (prefetching deshabilitado por error)",
      data: validUsers,
      prefetching: {
        enabled: prefetchingEnabled,
        includes: prefetchingEnabled ? ['superLike', 'friendRequest', 'conversation'] : [],
        usersCount: validUsers.length,
        ...(prefetchingError && { error: prefetchingError })
      }
    };

    console.log('📤 Respuesta enviada con prefetching:', prefetchingEnabled);
    
    res.json(response);
  } catch (error) {
    console.error("❌ Error obteniendo usuarios para el home:", error);
    
    // Manejar errores específicos de DynamoDB
    if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Se creará automáticamente.');
      return res.status(500).json({
        success: false,
        message: "Error de configuración de la base de datos",
        error: "DB_CONFIG_ERROR"
      });
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Error de permisos en DynamoDB.');
      return res.status(500).json({
        success: false,
        message: "Error de permisos en la base de datos",
        error: "DB_PERMISSION_ERROR"
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
});

// PUT estado de conexión del usuario
router.put("/connection-status", auth, async (req, res) => {
  try {
    const { isOnline, lastConnection } = req.body;
    const userId = req.user.id;

    console.log(`🔄 Actualizando estado de conexión para usuario ${userId}: ${isOnline ? 'online' : 'offline'}`);
    console.log(`🔍 Debug: req.user =`, { id: req.user.id, username: req.user.username, email: req.user.email });

    // Modo desarrollo: si no hay credenciales AWS, responder éxito sin persistir
    if (process.env.NODE_ENV !== 'production' && (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    )) {
      console.log('🧪 Dev: Sin credenciales AWS, omitiendo persistencia de estado de conexión');
      return res.json({
        success: true,
        message: "Dev: Estado de conexión no persistido (sin AWS)",
        devMode: true
      });
    }

    console.log(`🔍 Buscando usuario en DynamoDB con ID: ${userId}`);
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ Usuario no encontrado en DynamoDB:', userId);
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    console.log(`✅ Usuario encontrado, actualizando estado de conexión...`);
    await user.updateConnectionStatus(isOnline, lastConnection);
    
    res.json({
      success: true,
      message: "Estado de conexión actualizado exitosamente"
    });
  } catch (error) {
    console.error("❌ Error actualizando estado de conexión:", error);
    console.error("❌ Error details:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    
    // En desarrollo, evitar fallar si DynamoDB no está accesible
    if (process.env.NODE_ENV !== 'production') {
      const toleratedErrors = [
        'ResourceNotFoundException',
        'AccessDeniedException',
        'UnrecognizedClientException'
      ];
      if (toleratedErrors.includes(error?.name)) {
        console.log('🧪 Dev: Tolerando error de DynamoDB en updateConnectionStatus:', error?.name);
        return res.json({
          success: true,
          message: "Dev: Estado de conexión no persistido (DynamoDB no disponible)",
          devMode: true
        });
      }
    }

    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
});

// GET usuarios (solo para desarrollo)
router.get("/", auth, async (req, res) => {
  try {
    console.log('📋 Obteniendo todos los usuarios...');
    const users = await User.find();
    const usersWithoutPassword = users.map(user => user.select('-password'));
    console.log(`✅ Encontrados ${users.length} usuarios`);
    res.json(usersWithoutPassword);
  } catch (error) {
    console.error("❌ Error obteniendo usuarios:", error);
    
    // Manejar errores específicos de DynamoDB
    if (error.name === 'ResourceNotFoundException') {
      console.log('💡 La tabla no existe. Se creará automáticamente.');
      return res.status(500).json({
        success: false,
        message: "Error de configuración de la base de datos",
        error: "DB_CONFIG_ERROR"
      });
    } else if (error.name === 'AccessDeniedException') {
      console.log('💡 Error de permisos en DynamoDB.');
      return res.status(500).json({
        success: false,
        message: "Error de permisos en la base de datos",
        error: "DB_PERMISSION_ERROR"
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
});

// Ruta para dar super like a un usuario
router.post('/:userId/super-like', auth, giveSuperLike);

// Ruta para verificar el estado de super like
router.get('/:userId/super-like-status', auth, checkSuperLikeStatus);

// POST /api/users/:userId/friend-request - Enviar solicitud de amistad
router.post('/:userId/friend-request', auth, sendFriendRequest);

// GET usuario por ID (debe ir al final para evitar conflictos con rutas específicas)
router.get("/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    console.log(`👤 Obteniendo información del usuario: ${userId}`);

    // Buscar el usuario
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ Usuario no encontrado:', userId);
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Calcular edad si tiene fecha de nacimiento
    let age = null;
    if (user.birthDate) {
      const birthDate = new Date(user.birthDate);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Obtener bandera del país si tiene ubicación
    let countryFlag = '🌍';
    if (user.location?.address) {
      try {
        countryFlag = getFlagFromAddress(user.location.address);
      } catch (error) {
        console.log('⚠️ Error obteniendo bandera del país:', error.message);
      }
    }

    // Preparar respuesta con información del usuario
    const userInfo = {
      id: user.id,
      name: user.displayName || user.username,
      username: user.username,
      email: user.email,
      profileImage: user.profileImage,
      age: age,
      gender: user.gender,
      country: user.location?.address || 'Unknown',
      countryFlag: countryFlag,
      description: user.description || '',
      isOnline: user.isOnline || false,
      lastSeen: user.lastSeen,
      lastConnection: user.lastConnection,
      birthDate: user.birthDate,
      location: user.location,
      profileCompleted: user.profileCompleted || false
    };

    console.log(`✅ Información del usuario obtenida: ${userInfo.name}`);

    res.json({
      success: true,
      data: {
        user: userInfo
      }
    });

  } catch (error) {
    console.error("❌ Error obteniendo información del usuario:", error);
    res.status(500).json({ 
      success: false,
      message: "Error interno del servidor",
      error: "SERVER_ERROR"
    });
  }
});

export default router;
