import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import imageRoutes from "./routes/imageRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import friendRequestRoutes from "./routes/friendRequestRoutes.js";

dotenv.config();

connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(cors({
  origin: true, // Permitir todas las conexiones para desarrollo
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({ message: "Backend funcionando 🚀" });
});

// Ruta de health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ruta de health check para API
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    isHealthy: true
  });
});

// Rutas API
app.use("/api/users", userRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/friend-requests", friendRequestRoutes);

// Middleware para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe`
  });
});

// ===== WEBSOCKETS =====
const userSockets = new Map(); // userId -> socketId
const socketUsers = new Map(); // socketId -> userId
const userConnectionTimes = new Map(); // userId -> lastConnectionTime (para throttling)
const userConnectionCounts = new Map(); // userId -> { count, windowStart } (para rate limiting)

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);


  socket.on('join-conversation', async (conversationId) => {
    try {
      // Verificar que el usuario tiene acceso a la conversación
      if (!socket.userId) {
        socket.emit('error', { type: 'NOT_AUTHENTICATED', conversationId });
        return;
      }

      // Aquí podrías verificar permisos de acceso a la conversación
      // const hasAccess = await Chat.userHasAccessToConversation(socket.userId, conversationId);
      // if (!hasAccess) {
      //   socket.emit('error', { type: 'ACCESS_DENIED', conversationId });
      //   return;
      // }
      
      socket.join(conversationId);
      
      // Confirmar unión exitosa
      socket.emit('joined-conversation', { 
        conversationId, 
        timestamp: new Date().toISOString(),
        participantCount: io.sockets.adapter.rooms.get(conversationId)?.size || 1
      });
      
      console.log(`👥 Usuario ${socket.userId} se unió a conversación ${conversationId}`);
      
      // Log de salas activas para debug
      const room = io.sockets.adapter.rooms.get(conversationId);
      const roomSize = room ? room.size : 0;
      console.log(`📊 Sala ${conversationId} tiene ${roomSize} usuarios`);
      
    } catch (error) {
      console.error(`❌ Error al unirse a conversación ${conversationId}:`, error);
      socket.emit('error', { 
        type: 'JOIN_FAILED', 
        conversationId, 
        error: error.message 
      });
    }
  });

  socket.on('leave-conversation', (conversationId) => {
    try {
      socket.leave(conversationId);
      
      // Confirmar salida
      socket.emit('left-conversation', { 
        conversationId, 
        timestamp: new Date().toISOString() 
      });
      
      console.log(`👋 Usuario ${socket.userId} salió de conversación ${conversationId}`);
      
      // Log de usuarios restantes
      const room = io.sockets.adapter.rooms.get(conversationId);
      const roomSize = room ? room.size : 0;
      console.log(`📊 Sala ${conversationId} ahora tiene ${roomSize} usuarios`);
      
    } catch (error) {
      console.error(`❌ Error al salir de conversación ${conversationId}:`, error);
    }
  });

  // Manejar indicadores de "escribiendo"
  socket.on('typing-indicator', (data) => {
    const { conversationId, userId, isTyping } = data;
    
    if (conversationId && userId && socket.userId === String(userId)) {
      // Emitir a otros usuarios en la conversación
      socket.to(conversationId).emit('typing-indicator', {
        conversationId,
        userId,
        isTyping
      });
      
      console.log(`⌨️ Usuario ${userId} ${isTyping ? 'está escribiendo' : 'dejó de escribir'} en conversación ${conversationId}`);
    }
  });

  // Sistema de heartbeat mejorado
  socket.on('ping', () => {
    const timestamp = new Date().toISOString();
    socket.emit('pong', { timestamp, userId: socket.userId });
    
    // Actualizar última actividad del usuario
    if (socket.userId) {
      socket.lastActivity = Date.now();
    }
    
    console.log(`🏓 Heartbeat de usuario ${socket.userId || 'anónimo'}`);
  });

  // Detectar conexiones inactivas
  const heartbeatCheck = setInterval(() => {
    if (socket.userId && socket.lastActivity) {
      const timeSinceLastActivity = Date.now() - socket.lastActivity;
      const INACTIVE_THRESHOLD = 2 * 60 * 1000; // 2 minutos
      
      if (timeSinceLastActivity > INACTIVE_THRESHOLD) {
        console.log(`⚠️ Usuario ${socket.userId} inactivo por ${Math.round(timeSinceLastActivity/1000)}s - desconectando`);
        socket.emit('inactive-disconnect', { 
          reason: 'Conexión inactiva', 
          inactiveTime: timeSinceLastActivity 
        });
        socket.disconnect(true);
      }
    }
  }, 30000); // Verificar cada 30 segundos

  // Limpiar interval cuando se desconecte
  socket.on('disconnect', () => {
    clearInterval(heartbeatCheck);
  });

  // Manejar autenticación explícita mejorada
  socket.on('authenticate', async (userId) => {
    if (userId) {
      const userIdStr = String(userId);
      const now = Date.now();
      
      // Throttling con exponential backoff
      const lastConnectionTime = userConnectionTimes.get(userIdStr);
      const connectionCount = userConnectionCounts.get(userIdStr)?.count || 0;
      const minimumWaitTime = Math.min(10000 * Math.pow(2, Math.max(0, connectionCount - 2)), 60000); // Max 1 minuto
      
      if (lastConnectionTime && (now - lastConnectionTime) < minimumWaitTime) {
        const waitTime = Math.round((minimumWaitTime - (now - lastConnectionTime)) / 1000);
        console.log(`⏳ Throttling adaptativo: Usuario ${userId} debe esperar ${waitTime}s más (intento ${connectionCount + 1})`);
        socket.emit('authentication_error', {
          message: `Demasiadas conexiones frecuentes. Espera ${waitTime} segundos.`,
          waitTime,
          attemptCount: connectionCount + 1
        });
        socket.disconnect(true);
        return;
      }
      
      userConnectionTimes.set(userIdStr, now);
      
      // Rate limiting mejorado con sliding window
      const windowSize = 60000; // 1 minuto
      const maxConnections = 5; // Aumentado ligeramente
      const userCounts = userConnectionCounts.get(userIdStr) || { count: 0, windowStart: now, attempts: [] };
      
      // Sliding window: mantener timestamps de intentos recientes
      if (!userCounts.attempts) userCounts.attempts = [];
      userCounts.attempts = userCounts.attempts.filter(timestamp => now - timestamp < windowSize);
      userCounts.attempts.push(now);
      userCounts.count = userCounts.attempts.length;
      userCounts.windowStart = now;
      
      userConnectionCounts.set(userIdStr, userCounts);
      
      if (userCounts.count > maxConnections) {
        const oldestAttempt = Math.min(...userCounts.attempts);
        const windowTimeLeft = Math.round((windowSize - (now - oldestAttempt)) / 1000);
        
        console.log(`🚫 Rate limit avanzado: Usuario ${userId} excedió límite (${userCounts.count}/${maxConnections})`);
        socket.emit('authentication_error', {
          message: `Límite de conexiones excedido. Inténtalo en ${windowTimeLeft} segundos.`,
          rateLimited: true,
          retryAfter: windowTimeLeft,
          attemptCount: userCounts.count
        });
        socket.disconnect(true);
        return;
      }
      
      // Verificar si ya hay un socket activo para este usuario
      const oldSocketId = userSockets.get(userIdStr);
      if (oldSocketId && oldSocketId !== socket.id) {
        // Solo desconectar si el socket anterior realmente existe y está conectado
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket && oldSocket.connected) {
          console.log(`🔄 Desconectando socket anterior ${oldSocketId} para usuario ${userId}`);
          // Marcar el socket anterior como reemplazado para evitar reconexión
          oldSocket.emit('socket_replaced', { reason: 'new_connection', newSocketId: socket.id });
          oldSocket.disconnect(true);
        } else {
          // Limpiar referencia de socket anterior que ya no existe
          userSockets.delete(userIdStr);
          if (oldSocketId) {
            socketUsers.delete(oldSocketId);
          }
        }
      }

      // Solo proceder si no es una conexión duplicada del mismo socket
      if (socket.userId !== userId) {
        userSockets.set(userIdStr, socket.id);
        socketUsers.set(socket.id, userIdStr);
        socket.userId = userId;
        
        // Inicializar actividad
        socket.lastActivity = now;
        
        // Actualizar estado isOnline en la base de datos
        try {
          const { User } = await import('./models/Users.js');
          const user = await User.findById(userId);
          if (user) {
            await user.updateConnectionStatus(true, new Date().toISOString());
            console.log(`✅ Estado isOnline actualizado para usuario ${userId}`);
          } else {
            console.log(`⚠️ Usuario ${userId} no encontrado en la base de datos`);
          }
        } catch (error) {
          console.error(`❌ Error actualizando estado isOnline para usuario ${userId}:`, error);
          // No interrumpir la conexión por este error
        }
        
        // Emitir confirmación de autenticación con información adicional
        socket.emit('authenticated', { 
          userId, 
          socketId: socket.id, 
          timestamp: new Date().toISOString(),
          connectionCount: userSockets.size,
          serverVersion: '1.2.0',
          features: ['heartbeat', 'rate_limiting', 'enhanced_error_handling']
        });
        
        console.log(`✅ Usuario ${userId} autenticado en socket ${socket.id}`);
        console.log(`📊 Total usuarios conectados: ${userSockets.size}`);
      } else {
        console.log(`ℹ️ Usuario ${userId} ya autenticado en socket ${socket.id}`);
        // Re-emitir confirmación con timestamp actualizado
        socket.emit('authenticated', { 
          userId, 
          socketId: socket.id, 
          timestamp: new Date().toISOString(),
          reconnection: true,
          connectionCount: userSockets.size
        });
      }
    } else {
      socket.emit('authentication_error', {
        message: 'UserId requerido para autenticación',
        code: 'MISSING_USER_ID',
        timestamp: new Date().toISOString()
      });
      console.log(`❌ Intento de autenticación sin userId desde socket ${socket.id}`);
      
      // Desconectar después de un breve delay
      setTimeout(() => {
        if (!socket.userId) {
          socket.disconnect(true);
        }
      }, 5000);
    }
  });

  socket.on('disconnect', async (reason) => {
    console.log(`❌ Socket ${socket.id} desconectado: ${reason}`);
    
    if (socket.userId) {
      const userIdStr = String(socket.userId);
      userSockets.delete(userIdStr);
      socketUsers.delete(socket.id);
      
      // Limpiar datos solo si no hay otros sockets activos para este usuario
      if (!userSockets.has(userIdStr)) {
        // No limpiar inmediatamente para mantener throttling
        setTimeout(() => {
          if (!userSockets.has(userIdStr)) {
            userConnectionTimes.delete(userIdStr);
            // Mantener intentos de conexión por más tiempo para rate limiting
            setTimeout(() => {
              userConnectionCounts.delete(userIdStr);
            }, 5 * 60 * 1000); // 5 minutos
          }
        }, 30000); // 30 segundos
        
        // Actualizar estado isOnline en la base de datos solo si no hay otros sockets activos
        try {
          const { User } = await import('./models/Users.js');
          const user = await User.findById(socket.userId);
          if (user) {
            await user.updateConnectionStatus(false, new Date().toISOString());
            console.log(`✅ Estado isOnline actualizado a false para usuario ${socket.userId}`);
          } else {
            console.log(`⚠️ Usuario ${socket.userId} no encontrado en la base de datos`);
          }
        } catch (error) {
          console.error(`❌ Error actualizando estado isOnline para usuario ${socket.userId}:`, error);
        }
      }
      
      console.log(`❌ Usuario ${socket.userId} desconectado`);
      console.log(`📊 Total usuarios conectados: ${userSockets.size}`);
      
      // Emitir cambio de estado de usuario de forma más eficiente
      const statusChangeData = {
        userId: socket.userId,
        isOnline: false,
        lastSeen: new Date().toISOString(),
        disconnectReason: reason
      };
      
      // Solo emitir a usuarios que realmente necesitan esta información
      // (por ejemplo, usuarios en conversaciones compartidas)
      socket.broadcast.emit('user-status-changed', statusChangeData);
      
      console.log(`💶 Estado offline emitido para usuario ${socket.userId}`);
    }
  });
});

// Exponer io para usarlo en controladores
app.set('socketio', io);

// Función de limpieza periódica para datos de conexión
setInterval(() => {
  const now = Date.now();
  const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 horas
  
  // Limpiar conexiones muy antiguas
  for (const [userId, timestamp] of userConnectionTimes.entries()) {
    if (now - timestamp > cleanupThreshold) {
      userConnectionTimes.delete(userId);
      console.log(`🧹 Limpieza: Datos de conexión antiguos removidos para usuario ${userId}`);
    }
  }
  
  // Limpiar contadores de rate limiting antiguos
  for (const [userId, data] of userConnectionCounts.entries()) {
    if (data.attempts) {
      data.attempts = data.attempts.filter(timestamp => now - timestamp < 60000);
      if (data.attempts.length === 0) {
        userConnectionCounts.delete(userId);
      } else {
        data.count = data.attempts.length;
        userConnectionCounts.set(userId, data);
      }
    }
  }
  
  console.log(`📊 Estado del servidor: ${userSockets.size} usuarios conectados, ${userConnectionTimes.size} timestamps, ${userConnectionCounts.size} contadores`);
}, 60 * 60 * 1000); // Cada hora

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📱 CORS configurado para desarrollo`);
  console.log(`🔒 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSockets habilitados con funciones mejoradas:`);
  console.log(`  ✅ Sistema de heartbeat`);
  console.log(`  ✅ Rate limiting adaptativo`);
  console.log(`  ✅ Detección de inactividad`);
  console.log(`  ✅ Manejo de errores mejorado`);
  console.log(`  ✅ Limpieza automática de datos`);
});

