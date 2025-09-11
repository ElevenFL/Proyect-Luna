import { API_CONFIG } from '../config/api';
import { getSocketConfig, validateSocketIO } from '../config/socketConfig';

// Wrapper para manejar la inicialización segura de Socket.IO
class SocketIOWrapper {
  private io: any = null;
  private Socket: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Inicializa Socket.IO de manera segura
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('🔧 SocketIOWrapper: Inicializando Socket.IO...');
      
      // Validar entorno
      if (!validateSocketIO()) {
        throw new Error('Socket.IO no está configurado correctamente para este entorno');
      }

      // Importación dinámica
      const socketIOClient = await import('socket.io-client');
      
      // Verificar que las exportaciones estén disponibles
      if (!socketIOClient.io) {
        throw new Error('socket.io-client no exporta la función io');
      }

      if (typeof socketIOClient.io !== 'function') {
        throw new Error('socket.io-client.io no es una función');
      }

      this.io = socketIOClient.io;
      this.Socket = socketIOClient.Socket;
      this.isInitialized = true;

      console.log('✅ SocketIOWrapper: Socket.IO inicializado correctamente');
    } catch (error) {
      console.error('❌ SocketIOWrapper: Error inicializando Socket.IO:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Crea una nueva instancia de socket
   */
  async createSocket(url: string, config: any): Promise<any> {
    await this.initialize();
    
    if (!this.io) {
      throw new Error('Socket.IO no está inicializado');
    }

    try {
      console.log('🔌 SocketIOWrapper: Creando socket para URL:', url);
      const socket = this.io(url, config);
      console.log('✅ SocketIOWrapper: Socket creado exitosamente');
      return socket;
    } catch (error) {
      console.error('❌ SocketIOWrapper: Error creando socket:', error);
      throw error;
    }
  }

  /**
   * Verifica si está inicializado
   */
  isReady(): boolean {
    return this.isInitialized && !!this.io;
  }

  /**
   * Obtiene la instancia de io
   */
  getIO(): any {
    if (!this.isInitialized) {
      throw new Error('Socket.IO no está inicializado. Llama a initialize() primero.');
    }
    return this.io;
  }

  /**
   * Obtiene la clase Socket
   */
  getSocketClass(): any {
    if (!this.isInitialized) {
      throw new Error('Socket.IO no está inicializado. Llama a initialize() primero.');
    }
    return this.Socket;
  }
}

// Instancia singleton
const socketIOWrapper = new SocketIOWrapper();

export { socketIOWrapper };
export default socketIOWrapper;
