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

// Rutas API
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/chat", chatRoutes);

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

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('authenticate', (userId) => {
    if (userId) {
      userSockets.set(String(userId), socket.id);
      socketUsers.set(socket.id, String(userId));
      socket.userId = userId;
      console.log(`✅ Usuario ${userId} autenticado en socket ${socket.id}`);
      console.log(`📊 Total usuarios conectados: ${userSockets.size}`);
    }
  });

  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`👥 Usuario ${socket.userId} se unió a conversación ${conversationId}`);
    
    // Log de salas activas para debug
    const room = io.sockets.adapter.rooms.get(conversationId);
    const roomSize = room ? room.size : 0;
    console.log(`📊 Sala ${conversationId} tiene ${roomSize} usuarios`);
  });

  socket.on('leave-conversation', (conversationId) => {
    socket.leave(conversationId);
    console.log(`👋 Usuario ${socket.userId} salió de conversación ${conversationId}`);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(String(socket.userId));
      socketUsers.delete(socket.id);
      console.log(`❌ Usuario ${socket.userId} desconectado`);
      console.log(`📊 Total usuarios conectados: ${userSockets.size}`);
    }
  });
});

// Exponer io para usarlo en controladores
app.set('socketio', io);

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📱 CORS configurado para desarrollo`);
  console.log(`🔒 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 WebSockets habilitados`);
});

