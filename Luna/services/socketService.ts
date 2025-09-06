import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api';

interface ChatMessage {
  messageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image';
  createdAt: string;
  conversationId?: string; // Opcional para compatibilidad con mensajes existentes
}

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private isConnected = false;
  private messageListeners: Set<(message: ChatMessage) => void> = new Set();
  private conversationListeners: Set<(data: { conversationId: string; lastMessage: ChatMessage; updatedAt: string }) => void> = new Set();

  /**
   * Conecta al servidor WebSocket
   */
  connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        resolve();
        return;
      }

      // Extraer la URL base sin /api
      const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');
      
      this.socket = io(baseUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
      });

      this.userId = userId;

      this.socket.on('connect', () => {
        console.log('🔌 Conectado a WebSocket:', this.socket?.id);
        this.isConnected = true;
        
        // Autenticar usuario
        this.socket?.emit('authenticate', userId);
        
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Desconectado de WebSocket');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Error de conexión WebSocket:', error);
        this.isConnected = false;
        reject(error);
      });

      // Escuchar nuevos mensajes
      this.socket.on('new-message', (message: ChatMessage) => {
        console.log('📨 Nuevo mensaje recibido:', message);
        console.log('🔍 Detalles del mensaje:', {
          messageId: message.messageId,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content?.substring(0, 50) + '...',
          type: message.type,
          createdAt: message.createdAt
        });
        
        // Notificar a todos los listeners
        this.messageListeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error('Error en listener de mensaje:', error);
          }
        });
      });

      // Escuchar actualizaciones de conversaciones
      this.socket.on('conversation-updated', (data: { conversationId: string; lastMessage: ChatMessage; updatedAt: string }) => {
        console.log('📋 Conversación actualizada:', {
          conversationId: data.conversationId,
          lastMessage: data.lastMessage?.content?.substring(0, 30) + '...',
          updatedAt: data.updatedAt
        });
        
        // Notificar a los listeners de conversaciones si los hay
        this.conversationListeners.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            console.error('Error en listener de conversación:', error);
          }
        });
      });
    });
  }

  /**
   * Desconecta del servidor WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.userId = null;
      console.log('🔌 WebSocket desconectado');
    }
  }

  /**
   * Se une a una conversación específica
   */
  joinConversation(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-conversation', conversationId);
      console.log(`👥 Unido a conversación: ${conversationId}`);
    }
  }

  /**
   * Sale de una conversación específica
   */
  leaveConversation(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-conversation', conversationId);
      console.log(`👋 Salido de conversación: ${conversationId}`);
    }
  }

  /**
   * Añade un listener para nuevos mensajes
   */
  addMessageListener(listener: (message: ChatMessage) => void) {
    this.messageListeners.add(listener);
  }

  /**
   * Remueve un listener de mensajes
   */
  removeMessageListener(listener: (message: ChatMessage) => void) {
    this.messageListeners.delete(listener);
  }

  /**
   * Añade un listener para actualizaciones de conversaciones
   */
  addConversationListener(listener: (data: { conversationId: string; lastMessage: ChatMessage; updatedAt: string }) => void) {
    this.conversationListeners.add(listener);
  }

  /**
   * Remueve un listener de conversaciones
   */
  removeConversationListener(listener: (data: { conversationId: string; lastMessage: ChatMessage; updatedAt: string }) => void) {
    this.conversationListeners.delete(listener);
  }

  /**
   * Verifica si está conectado
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      userId: this.userId,
      socketId: this.socket?.id || null,
    };
  }

  /**
   * Reconecta automáticamente si se pierde la conexión
   */
  ensureConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      if (!this.userId) {
        reject(new Error('No userId set for reconnection'));
        return;
      }

      this.connect(this.userId).then(resolve).catch(reject);
    });
  }
}

// Singleton
export const socketService = new SocketService();
export default socketService;

