import { API_CONFIG } from '../config/api';
import { getSocketConfig } from '../config/socketConfig';
import { socketIOWrapper } from './socketServiceWrapper';

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
  private socket: any = null;
  private userId: string | null = null;
  private isConnected = false;
  private isConnecting = false;
  private authToken: string | null = null;
  private messageListeners: Set<(message: ChatMessage) => void> = new Set();
  private conversationListeners: Set<(data: { conversationId: string; lastMessage: ChatMessage; updatedAt: string }) => void> = new Set();
  private connectionStateListeners: Set<(isConnected: boolean) => void> = new Set();
  private notificationListeners: Set<(notification: any) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8; // Aumentado a 8 intentos
  private reconnectDelay = 1000; // Reducido a 1000ms para reconexión más rápida
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private joinedConversations: Set<string> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private socketReplaced = false;
  private connectionPromise: Promise<void> | null = null;
  private lastConnectionTime = 0;
  private connectionLock = false;
  private connectionLockTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionQueue: Array<{ userId: string; resolve: () => void; reject: (error: Error) => void }> = [];
  
  // Circuit Breaker para conexiones fallidas
  private failureCount = 0;
  private circuitBreakerOpen = false;
  private circuitBreakerTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 12; // Aumentado a 12 para ser más tolerante
  private readonly CIRCUIT_BREAKER_RESET_TIME = 15000; // Reducido a 15 segundos para recuperación más rápida
  
  // Heartbeat mejorado
  private lastPongTime = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos
  private readonly HEARTBEAT_TIMEOUT = 10000; // 10 segundos
  
  // Throttling más conservador para mejor UX
  private readonly CONNECTION_DEBOUNCE = 2000; // 2 segundos entre conexiones (reducido de 5s)
  private readonly MAX_FAILED_CONNECTIONS = 5; // Aumentado de 3 a 5

  /**
   * Establece el token de autenticación
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Verifica si se debe permitir la conexión (Circuit Breaker)
   */
  private shouldAllowConnection(): boolean {
    if (this.circuitBreakerOpen) {
      console.log('🚫 SocketService: Circuit breaker abierto - conexión bloqueada');
      return false;
    }
    return true;
  }

  /**
   * Abre el circuit breaker
   */
  private openCircuitBreaker(): void {
    console.log('⚡ SocketService: Abriendo circuit breaker por demasiados fallos');
    this.circuitBreakerOpen = true;
    
    this.circuitBreakerTimeout = setTimeout(() => {
      console.log('🔄 SocketService: Reseteando circuit breaker');
      this.circuitBreakerOpen = false;
      this.failureCount = 0;
    }, this.CIRCUIT_BREAKER_RESET_TIME);
  }

  /**
   * Registra un fallo de conexión
   */
  private recordConnectionFailure(): void {
    this.failureCount++;
    console.log(`❌ SocketService: Fallo de conexión ${this.failureCount}/${this.CIRCUIT_BREAKER_THRESHOLD}`);
    
    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.openCircuitBreaker();
    }
  }

  /**
   * Registra una conexión exitosa
   */
  private recordConnectionSuccess(): void {
    this.failureCount = 0;
    if (this.circuitBreakerOpen) {
      console.log('✅ SocketService: Conexión exitosa - cerrando circuit breaker');
      this.circuitBreakerOpen = false;
      if (this.circuitBreakerTimeout) {
        clearTimeout(this.circuitBreakerTimeout);
        this.circuitBreakerTimeout = null;
      }
    }
  }

  /**
   * Resetea manualmente el circuit breaker (para casos de emergencia)
   */
  resetCircuitBreaker(): void {
    console.log('🔄 SocketService: Reseteando circuit breaker manualmente');
    this.circuitBreakerOpen = false;
    this.failureCount = 0;
    if (this.circuitBreakerTimeout) {
      clearTimeout(this.circuitBreakerTimeout);
      this.circuitBreakerTimeout = null;
    }
  }

  /**
   * Resetea manualmente el connectionLock (para casos de emergencia)
   */
  resetConnectionLock(): void {
    console.log('🔄 SocketService: Reseteando connectionLock manualmente');
    this.clearConnectionLock();
    console.log('🔓 SocketService: ConnectionLock reseteado manualmente');
  }

  /**
   * Limpia la cola de conexiones pendientes (para casos de emergencia)
   */
  clearConnectionQueue(): void {
    console.log(`🧹 SocketService: Limpiando cola de conexiones (${this.connectionQueue.length} elementos)`);
    this.connectionQueue.forEach(({ reject }) => {
      reject(new Error('Cola de conexiones limpiada manualmente'));
    });
    this.connectionQueue = [];
    console.log('✅ SocketService: Cola de conexiones limpiada');
  }

  /**
   * Limpia el connectionLock y sus timeouts asociados
   */
  private clearConnectionLock(): void {
    this.connectionLock = false;
    this.isConnecting = false;
    this.connectionPromise = null;
    
    // Limpiar timeout de lock si existe
    if (this.connectionLockTimeout) {
      clearTimeout(this.connectionLockTimeout);
      this.connectionLockTimeout = null;
    }
    
    // Procesar cola de conexiones pendientes
    this.processConnectionQueue();
  }

  /**
   * Procesa la cola de conexiones pendientes
   */
  private processConnectionQueue(): void {
    if (this.connectionQueue.length > 0 && !this.connectionLock && !this.isConnecting) {
      const nextConnection = this.connectionQueue.shift();
      if (nextConnection) {
        console.log('🔄 SocketService: Procesando conexión pendiente de la cola');
        this.connect(nextConnection.userId)
          .then(() => nextConnection.resolve())
          .catch((error) => nextConnection.reject(error));
      }
    }
  }

  /**
   * Añade una conexión a la cola de espera
   */
  private addToConnectionQueue(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verificar si ya hay una conexión para el mismo usuario en la cola
      const existingIndex = this.connectionQueue.findIndex(item => item.userId === userId);
      if (existingIndex !== -1) {
        // Reemplazar la conexión existente
        this.connectionQueue[existingIndex] = { userId, resolve, reject };
        console.log('🔄 SocketService: Reemplazando conexión existente en cola para usuario:', userId);
      } else {
        // Añadir nueva conexión a la cola
        this.connectionQueue.push({ userId, resolve, reject });
        console.log('📋 SocketService: Añadida conexión a cola. Cola actual:', this.connectionQueue.length);
      }
      
      // Configurar timeout para la conexión en cola
      setTimeout(() => {
        const queueIndex = this.connectionQueue.findIndex(item => item.userId === userId);
        if (queueIndex !== -1) {
          console.log('⏰ SocketService: Timeout de conexión en cola para usuario:', userId);
          this.connectionQueue.splice(queueIndex, 1);
          reject(new Error('Timeout esperando en cola de conexiones'));
        }
      }, 15000); // 15 segundos de timeout para conexiones en cola
    });
  }

  /**
   * Activa el connectionLock con timeout automático
   */
  private setConnectionLock(): void {
    this.connectionLock = true;
    this.lastConnectionTime = Date.now();
    
    // Configurar timeout automático para liberar el lock
    if (this.connectionLockTimeout) {
      clearTimeout(this.connectionLockTimeout);
    }
    
    this.connectionLockTimeout = setTimeout(() => {
      console.log('⏰ SocketService: Timeout automático del connectionLock, liberando...');
      this.clearConnectionLock();
    }, 10000); // 10 segundos de timeout automático
  }

  /**
   * Conecta al servidor WebSocket con reconexión automática mejorada
   */
  async connect(userId: string): Promise<void> {
    // Verificar circuit breaker
    if (!this.shouldAllowConnection()) {
      return Promise.reject(new Error('Circuit breaker abierto - demasiados fallos de conexión'));
    }

    // Inicializar Socket.IO de manera segura
    try {
      await socketIOWrapper.initialize();
    } catch (error) {
      console.error('❌ SocketService: Error inicializando Socket.IO:', error);
      return Promise.reject(error);
    }

    // IMPORTANTE: Resetear el estado destruido al intentar conectar
    if (this.isDestroyed) {
      console.log('🔄 SocketService: Reseteando estado destruido para nueva conexión');
      this.isDestroyed = false;
    }

    // Declarar 'now' antes de usarlo
    const now = Date.now();

    // Bloqueo estricto para evitar múltiples conexiones con timeout de seguridad mejorado
    if (this.connectionLock) {
      const lockTime = now - this.lastConnectionTime;
      console.log('🔒 SocketService: ConnectionLock activo:', {
        lockTime: lockTime,
        lastConnectionTime: this.lastConnectionTime,
        isConnecting: this.isConnecting,
        isConnected: this.isConnected,
        hasConnectionPromise: !!this.connectionPromise,
        userId: userId
      });
      
      // Reducir el tiempo de lock a 3 segundos para evitar bloqueos prolongados
      if (lockTime > 3000) {
        console.log('⚠️ SocketService: Lock antiguo detectado (>3s), liberando...');
        this.clearConnectionLock();
        // Limpiar socket si existe pero no está conectado
        if (this.socket && !this.isConnected) {
          console.log('🧹 SocketService: Limpiando socket huérfano');
          this.socket.disconnect();
          this.socket = null;
        }
      } else {
        // Si el lock es reciente pero hay una promesa en progreso, esperar a que termine
        if (this.connectionPromise && this.isConnecting) {
          console.log('⏳ SocketService: Esperando conexión en progreso...');
          return this.connectionPromise.catch(() => {
            // Si la promesa falla, liberar el lock y reintentar
            console.log('🔄 SocketService: Conexión previa falló, reintentando...');
            this.clearConnectionLock();
            return this.connect(userId);
          });
        } else {
          console.log('🚫 SocketService: Conexión bloqueada, añadiendo a cola...');
          return this.addToConnectionQueue(userId);
        }
      }
    }

    // Si ya hay una promesa de conexión en progreso, devolverla
    if (this.connectionPromise) {
      console.log('⏳ SocketService: Conexión ya en progreso, esperando...');
      return this.connectionPromise;
    }

    // Throttling más suave y manejo mejorado de reintentos
    if (now - this.lastConnectionTime < this.CONNECTION_DEBOUNCE && this.reconnectAttempts > 0) {
      const waitTime = Math.min(this.CONNECTION_DEBOUNCE - (now - this.lastConnectionTime), 1000);
      console.log(`⏳ SocketService: Throttling - esperando ${waitTime}ms antes de reconectar`);
      
      // Resetear el estado de conexión antes de reintentar
      this.clearConnectionLock();
      
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            // Verificar si ya hay una conexión activa antes de reintentar
            if (this.isConnected) {
              console.log('✅ SocketService: Conexión establecida durante espera');
              resolve();
              return;
            }
            await this.connect(userId);
            resolve();
          } catch (error) {
            console.error('❌ SocketService: Error en reconexión throttled:', error);
            // Resetear estado en caso de error
            this.clearConnectionLock();
            reject(error);
          }
        }, waitTime);
      });
    }

    this.connectionPromise = new Promise(async (resolve, reject) => {
      if (this.socket && this.isConnected && this.userId === userId && !this.socketReplaced) {
        console.log('✅ SocketService: Ya conectado y autenticado');
        this.connectionPromise = null;
        resolve();
        return;
      }

      // Reset flag al iniciar nueva conexión
      this.socketReplaced = false;
      this.lastConnectionTime = now;

      if (this.isConnecting) {
        console.log('⏳ SocketService: Conexión ya en progreso');
        // Esperar a que termine la conexión actual
        const checkConnection = () => {
          if (!this.isConnecting) {
            this.connectionPromise = null;
            if (this.isConnected) {
              resolve();
            } else {
              reject(new Error('Falló la conexión en progreso'));
            }
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.setConnectionLock(); // Activar bloqueo con timeout automático
      this.isConnecting = true;
      this.userId = userId;
      
      console.log('🔐 SocketService: ConnectionLock activado para usuario:', userId);

      // Desconectar socket anterior si existe
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      // Extraer la URL base sin /api
      const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');
      
      console.log(`🔌 SocketService: Conectando a ${baseUrl} para usuario ${userId}`);
      
      try {
        // Usar configuración optimizada para React Native
        const socketConfig = getSocketConfig(baseUrl, userId, this.authToken || undefined);
        
        // Crear el socket usando el wrapper
        this.socket = await socketIOWrapper.createSocket(baseUrl, socketConfig);
      } catch (initError) {
        console.error('❌ SocketService: Error inicializando socket:', initError);
        this.clearConnectionLock();
        reject(initError);
        return;
      }

      this.socket.on('connect', () => {
        console.log('✅ SocketService: Conectado al servidor WebSocket');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Registrar conexión exitosa para circuit breaker
        this.recordConnectionSuccess();
        
        // Autenticar usuario
        this.socket?.emit('authenticate', userId);
        
        // Reincorporarse a conversaciones que estaba siguiendo
        this.rejoinConversations();
        
        // Iniciar heartbeat mejorado
        this.startHeartbeat();
        
        // Notificar cambio de estado
        this.notifyConnectionState(true);
        
        this.clearConnectionLock();
        console.log('🔓 SocketService: ConnectionLock liberado - conexión exitosa');
        resolve();
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log(`❌ SocketService: Desconectado del servidor: ${reason}`);
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        
        // Notificar cambio de estado
        this.notifyConnectionState(false);
        
        // Mapear razones de desconexión para mejor debugging
        const disconnectReasons = {
          'io server disconnect': 'Servidor desconectó el cliente',
          'io client disconnect': 'Cliente desconectó manualmente',
          'ping timeout': 'Timeout de ping',
          'transport close': 'Transporte cerrado',
          'transport error': 'Error de transporte'
        };
        
        const mappedReason = disconnectReasons[reason as keyof typeof disconnectReasons] || reason;
        console.log(`🔍 SocketService: Razón mapeada: ${mappedReason}`);
        
        // Solo reconectar si no es una desconexión manual y no hay circuit breaker
        if (reason !== 'io client disconnect' && !this.isDestroyed && !this.socketReplaced && !this.circuitBreakerOpen) {
          console.log(`🔄 SocketService: Desconexión detectada (${mappedReason}), programando reconexión...`);
          
          // Delay más conservador con backoff exponencial
          let delay = Math.min(5000 + (this.reconnectAttempts * 3000), 30000);
          
          // Reducir delay para transport errors ya que suelen ser temporales
          if (reason === 'transport close' || reason === 'transport error') {
            delay = Math.min(2000 + (this.reconnectAttempts * 1000), 10000);
          }
          
          this.reconnectTimeout = setTimeout(() => {
            if (!this.isDestroyed && !this.isConnected && !this.isConnecting && !this.socketReplaced && !this.circuitBreakerOpen) {
              this.handleReconnection();
            }
          }, delay);
        } else if (this.socketReplaced) {
          console.log(`ℹ️ SocketService: Socket reemplazado, no reconectando automáticamente`);
          this.socketReplaced = false;
        } else if (this.circuitBreakerOpen) {
          console.log(`🚫 SocketService: Circuit breaker abierto, no reconectando`);
        }
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ SocketService: Error de conexión:', error);
        this.isConnected = false;
        this.isConnecting = false;
        
        // Registrar fallo para circuit breaker
        this.recordConnectionFailure();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.circuitBreakerOpen) {
          this.reconnectAttempts++;
          console.log(`🔄 SocketService: Error de conexión, reintentando (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          // Delay exponencial con backoff más conservador
          const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
          
          this.reconnectTimeout = setTimeout(() => {
            if (!this.isDestroyed && !this.isConnected && !this.circuitBreakerOpen) {
              this.handleReconnection();
            }
          }, delay);
        } else {
          const reason = this.circuitBreakerOpen ? 'Circuit breaker abierto' : 'Máximo de intentos alcanzado';
          console.error(`❌ SocketService: ${reason}`);
          this.clearConnectionLock();
          console.log('🔓 SocketService: ConnectionLock liberado - máximo de intentos alcanzado');
          reject(error);
        }
      });

      this.socket.on('authenticated', (data: any) => {
        console.log('✅ SocketService: Usuario autenticado correctamente:', data);
      });

      this.socket.on('authentication_error', (error: any) => {
        console.error('❌ SocketService: Error de autenticación:', error);
        this.clearConnectionLock();
        console.log('🔓 SocketService: ConnectionLock liberado - error de autenticación');
        reject(new Error(`Error de autenticación: ${error}`));
      });

      // Escuchar nuevos mensajes con mejor manejo de errores
      this.socket.on('new-message', (message: ChatMessage) => {
        console.log('📨 SocketService: Nuevo mensaje recibido:', {
          messageId: message.messageId,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content?.substring(0, 50) + '...',
          type: message.type,
          createdAt: message.createdAt
        });
        
        // Verificar que el mensaje tenga los campos necesarios
        if (!message.messageId || !message.conversationId) {
          console.error('❌ SocketService: Mensaje inválido recibido:', message);
          return;
        }
        
        // Notificar a todos los listeners
        this.messageListeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error('❌ SocketService: Error en listener de mensaje:', error);
          }
        });
        
        console.log(`✅ SocketService: Mensaje notificado a ${this.messageListeners.size} listeners`);
      });

      // Escuchar actualizaciones de conversaciones
      this.socket.on('conversation-updated', (data: any) => {
        console.log('📋 SocketService: Conversación actualizada:', data.conversationId);
        
        // Notificar a los listeners de conversaciones si los hay
        this.conversationListeners.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            console.error('❌ SocketService: Error en listener de conversación:', error);
          }
        });
      });

      // Escuchar notificaciones
      this.socket.on('notification', (notification: any) => {
        console.log('🔔 SocketService: Notificación recibida:', notification);
        
        // Notificar a los listeners de notificaciones
        this.notificationListeners.forEach(listener => {
          try {
            listener(notification);
          } catch (error) {
            console.error('❌ SocketService: Error en listener de notificación:', error);
          }
        });
      });

      // Escuchar pong para verificar conexión
      this.socket.on('pong', () => {
        this.lastPongTime = Date.now();
        console.log('🏓 SocketService: Pong recibido - conexión activa');
      });

      // Escuchar cuando este socket es reemplazado por uno nuevo
      this.socket.on('socket_replaced', (data: any) => {
        console.log('🔄 SocketService: Socket reemplazado por nueva conexión:', data);
        this.socketReplaced = true;
        // No intentar reconectar ya que hay una nueva conexión activa
      });

      // Manejo adicional de eventos para mejor estabilidad
      this.socket.on('reconnect', () => {
        console.log('🔄 SocketService: Reconexión exitosa');
        this.recordConnectionSuccess();
      });

      this.socket.on('reconnect_error', (error: any) => {
        console.error('❌ SocketService: Error en reconexión:', error);
        this.recordConnectionFailure();
      });

      this.socket.on('error', (error: any) => {
        console.error('❌ SocketService: Error general del socket:', error);
        
        // Si es un error crítico, marcar como fallo
        if (error?.type === 'TransportError' || error?.description?.includes('xhr poll error')) {
          console.log('🚨 SocketService: Error de transporte detectado');
          this.recordConnectionFailure();
        }
      });

      // Manejar eventos de transporte para mejor debugging
      this.socket.on('disconnect', () => {
        console.log('🔌 SocketService: Evento disconnect adicional');
      });

      // Manejar eventos específicos del engine
      if (this.socket.io && this.socket.io.engine) {
        this.socket.io.engine.on('close', (reason: string) => {
          console.log(`🔌 SocketService: Engine cerrado: ${reason}`);
        });

        this.socket.io.engine.on('error', (error: any) => {
          console.error('❌ SocketService: Error del engine:', error);
        });

        this.socket.io.engine.on('upgradeError', (error: any) => {
          console.error('❌ SocketService: Error de upgrade:', error);
        });
      }

      // Iniciar la conexión explícitamente si autoConnect está desactivado
      try {
        // Algunos entornos exponen estado como disconnected
        const shouldConnect = this.socket && typeof this.socket.connect === 'function' && (this.socket.disconnected === true || this.socket.connected === false);
        if (shouldConnect) {
          console.log('🚀 SocketService: Iniciando conexión manual (autoConnect=false)');
          this.socket.connect();
        }
      } catch (manualConnectError) {
        console.error('❌ SocketService: Error iniciando conexión manual:', manualConnectError);
        this.clearConnectionLock();
        reject(manualConnectError);
        return;
      }
    });

    return this.connectionPromise;
  }

  /**
   * Maneja la reconexión automática
   */
  private async handleReconnection() {
    // Verificar si realmente necesitamos reconectar
    if (this.isConnected) {
      console.log('✅ SocketService: Ya conectado, no es necesario reconectar');
      return;
    }

    // Si no hay userId, no podemos reconectar
    if (!this.userId) {
      console.log('❌ SocketService: No hay userId para reconectar');
      return;
    }

    // Si está destruido, no reconectar
    if (this.isDestroyed) {
      console.log('❌ SocketService: Socket destruido, no reconectando');
      return;
    }

    // Si está en proceso de conexión, esperar un poco y verificar estado
    if (this.isConnecting) {
      console.log('⏳ SocketService: Conexión en progreso, esperando...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Si después de esperar ya está conectado, salir
      if (this.isConnected) {
        console.log('✅ SocketService: Conexión establecida durante espera');
        return;
      }
      
      // Si sigue conectando después de la espera, resetear estado
      if (this.isConnecting) {
        console.log('⚠️ SocketService: Conexión bloqueada, reseteando estado...');
        this.clearConnectionLock();
      }
    }

    console.log(`🔄 SocketService: Iniciando reconexión (intento ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    try {
      await this.connect(this.userId);
      console.log('✅ SocketService: Reconexión exitosa');
    } catch (error) {
      console.error('❌ SocketService: Error en reconexión:', error);
      // Resetear estado en caso de error
      this.clearConnectionLock();
    }
  }

  /**
   * Inicia el sistema de heartbeat mejorado
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.lastPongTime = 0;
        this.socket.emit('ping');
        
        // Verificar respuesta después del timeout
        setTimeout(() => {
          if (this.lastPongTime === 0) {
            console.warn('⚠️ SocketService: Heartbeat timeout - conexión puede estar perdida');
            this.handleConnectionLoss();
          }
        }, this.HEARTBEAT_TIMEOUT);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Detiene el heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Maneja la pérdida de conexión detectada por heartbeat
   */
  private handleConnectionLoss() {
    if (this.isConnected) {
      console.log('💔 SocketService: Pérdida de conexión detectada por heartbeat');
      this.isConnected = false;
      this.notifyConnectionState(false);
      
      if (!this.isDestroyed && !this.socketReplaced) {
        this.handleReconnection();
      }
    }
  }

  /**
   * Se reincorpora a las conversaciones que estaba siguiendo
   */
  private rejoinConversations() {
    this.joinedConversations.forEach(conversationId => {
      this.joinConversation(conversationId);
    });
  }

  /**
   * Notifica cambios en el estado de conexión
   */
  private notifyConnectionState(isConnected: boolean) {
    this.connectionStateListeners.forEach(listener => {
      try {
        listener(isConnected);
      } catch (error) {
        console.error('❌ SocketService: Error en listener de estado de conexión:', error);
      }
    });
  }


  /**
   * Desconecta del servidor WebSocket
   */
  disconnect() {
    console.log('🔌 SocketService: Desconectando...');
    
    this.isDestroyed = true;
    this.socketReplaced = false;
    this.clearConnectionLock();
    this.stopHeartbeat();
    this.joinedConversations.clear();
    
    // Limpiar cola de conexiones pendientes
    this.connectionQueue.forEach(({ reject }) => {
      reject(new Error('SocketService destruido'));
    });
    this.connectionQueue = [];
    
    // Limpiar timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.circuitBreakerTimeout) {
      clearTimeout(this.circuitBreakerTimeout);
      this.circuitBreakerTimeout = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.userId = null;
    this.authToken = null;
    this.reconnectAttempts = 0;
    this.failureCount = 0;
    this.circuitBreakerOpen = false;
    
    // Notificar cambio de estado
    this.notifyConnectionState(false);
    
    console.log('✅ SocketService: Desconectado correctamente');
  }

  /**
   * Se une a una conversación específica
   */
  joinConversation(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-conversation', conversationId);
      this.joinedConversations.add(conversationId);
      console.log(`👥 SocketService: Unido a conversación ${conversationId}`);
    } else {
      console.warn(`⚠️ SocketService: No se puede unir a conversación ${conversationId} - no conectado`);
      // Guardar para unirse cuando se reconecte
      this.joinedConversations.add(conversationId);
      
      // Si hay un userId y no estamos destruidos, intentar conectar automáticamente
      if (this.userId && !this.isDestroyed && !this.isConnecting) {
        console.log(`🔄 SocketService: Intentando conectar automáticamente para unirse a conversación ${conversationId}`);
        this.connect(this.userId).catch(error => {
          console.error('❌ SocketService: Error en conexión automática:', error);
        });
      }
    }
  }

  /**
   * Se une a una conversación esperando a que esté conectado
   */
  async joinConversationWhenReady(conversationId: string, maxWaitTime: number = 10000): Promise<boolean> {
    // Si ya está conectado, unirse inmediatamente
    if (this.socket && this.isConnected) {
      this.joinConversation(conversationId);
      return true;
    }

    // Si no hay userId, no se puede conectar
    if (!this.userId) {
      console.error('❌ SocketService: No hay userId para conectar y unirse a conversación');
      return false;
    }

    // IMPORTANTE: No rechazar si está destruido, intentar reconectar
    if (this.isDestroyed) {
      console.log('🔄 SocketService: Socket destruido, intentando reconectar para unirse a conversación');
      this.isDestroyed = false; // Resetear estado para permitir reconexión
    }

    console.log(`⏳ SocketService: Esperando conexión para unirse a conversación ${conversationId}`);
    
    // Guardar la conversación para unirse cuando se conecte
    this.joinedConversations.add(conversationId);

    // Intentar conectar si no está conectando
    if (!this.isConnecting) {
      try {
        await this.connect(this.userId);
        // Verificar que realmente se conectó antes de confirmar
        if (this.isConnected) {
          this.joinConversation(conversationId);
          return true;
        } else {
          console.warn('⚠️ SocketService: Connect terminó pero no está conectado');
          return false;
        }
      } catch (error) {
        console.error('❌ SocketService: Error conectando para unirse a conversación:', error);
        return false;
      }
    } else {
      // Si ya está conectando, esperar a que termine
      return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkConnection = () => {
          if (this.isConnected) {
            this.joinConversation(conversationId);
            resolve(true);
          } else if (Date.now() - startTime > maxWaitTime) {
            console.error(`❌ SocketService: Timeout esperando conexión para conversación ${conversationId}`);
            resolve(false);
          } else if (this.isDestroyed) {
            console.error(`❌ SocketService: Socket fue destruido mientras esperaba conexión para conversación ${conversationId}`);
            resolve(false);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        
        checkConnection();
      });
    }
  }

  /**
   * Sale de una conversación específica
   */
  leaveConversation(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-conversation', conversationId);
      console.log(`👋 SocketService: Saliendo de conversación ${conversationId}`);
    }
    this.joinedConversations.delete(conversationId);
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

      try {
        const result = this.connect(this.userId);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch((error) => {
            console.error('❌ SocketService: Error en ensureConnection:', error);
            reject(error);
          });
        } else {
          console.warn('⚠️ SocketService: connect() no retornó promesa en ensureConnection');
          resolve();
        }
      } catch (error) {
        console.error('❌ SocketService: Error sincrónico en ensureConnection:', error);
        reject(error);
      }
    });
  }

  /**
   * Añade listener para cambios en el estado de conexión
   */
  addConnectionStateListener(listener: (isConnected: boolean) => void) {
    this.connectionStateListeners.add(listener);
  }

  /**
   * Remueve listener de estado de conexión
   */
  removeConnectionStateListener(listener: (isConnected: boolean) => void) {
    this.connectionStateListeners.delete(listener);
  }

  /**
   * Añade un listener para notificaciones
   */
  addNotificationListener(listener: (notification: any) => void) {
    this.notificationListeners.add(listener);
  }

  /**
   * Remueve un listener de notificaciones
   */
  removeNotificationListener(listener: (notification: any) => void) {
    this.notificationListeners.delete(listener);
  }

  /**
   * Envía un evento de "usuario escribiendo"
   */
  sendTypingIndicator(conversationId: string, isTyping: boolean) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing-indicator', {
        conversationId,
        userId: this.userId,
        isTyping
      });
    }
  }

  /**
   * Escucha eventos de "usuario escribiendo"
   */
  onTypingIndicator(callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void) {
    if (this.socket) {
      this.socket.on('typing-indicator', callback);
    }
  }

  /**
   * Envía un ping manual para verificar conexión
   */
  ping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping');
    }
  }

  /**
   * Fuerza una reconexión
   */
  forceReconnect() {
    if (this.userId) {
      console.log('🔄 SocketService: Forzando reconexión...');
      
      // Limpiar timeouts existentes
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      const currentUserId = this.userId;
      
      // Limpiar estado actual sin marcar como destruido
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.isConnected = false;
      this.isConnecting = false;
      this.clearConnectionLock();
      this.socketReplaced = false;
      this.reconnectAttempts = 0;
      this.stopHeartbeat();
      
      // NO marcar como destruido para permitir reconexión inmediata
      // this.isDestroyed = false;
      
      // Intentar reconectar inmediatamente
      setTimeout(() => {
        if (!this.isConnected && !this.isConnecting) {
          try {
            const result = this.connect(currentUserId);
            if (result && typeof result.then === 'function') {
              result.catch((error) => {
                console.error('❌ SocketService: Error en forceReconnect:', error);
              });
            }
          } catch (error) {
            console.error('❌ SocketService: Error sincrónico en forceReconnect:', error);
          }
        }
      }, 1000); // Delay reducido para reconexión más rápida
    }
  }

  /**
   * Obtiene las conversaciones a las que está unido
   */
  getJoinedConversations(): string[] {
    return Array.from(this.joinedConversations);
  }

  /**
   * Obtiene estadísticas de la conexión
   */
  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      userId: this.userId,
      reconnectAttempts: this.reconnectAttempts,
      joinedConversations: this.getJoinedConversations(),
      socketId: this.socket?.id || null,
      hasAuthToken: !!this.authToken,
      isDestroyed: this.isDestroyed,
      connectionLock: this.connectionLock,
      lastConnectionTime: this.lastConnectionTime
    };
  }

  /**
   * Verifica si el servicio está listo para operaciones de chat
   */
  isReadyForChat(): boolean {
    return this.isConnected && !!this.userId && !this.isDestroyed && !!this.authToken;
  }

  /**
   * Obtiene el estado detallado de la conexión para debugging
   */
  getDetailedStatus() {
    return {
      connection: {
        isConnected: this.isConnected,
        isConnecting: this.isConnecting,
        isDestroyed: this.isDestroyed,
        connectionLock: this.connectionLock,
        lastConnectionTime: this.lastConnectionTime,
        socketId: this.socket?.id || null,
        hasConnectionPromise: !!this.connectionPromise,
        connectionLockTimeout: !!this.connectionLockTimeout
      },
      queue: {
        pendingConnections: this.connectionQueue.length,
        queueItems: this.connectionQueue.map(item => ({
          userId: item.userId,
          timestamp: Date.now() - this.lastConnectionTime
        }))
      },
      auth: {
        userId: this.userId,
        hasAuthToken: !!this.authToken,
        tokenLength: this.authToken?.length || 0
      },
      reconnection: {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        delay: this.reconnectDelay
      },
      circuitBreaker: {
        isOpen: this.circuitBreakerOpen,
        failureCount: this.failureCount,
        threshold: this.CIRCUIT_BREAKER_THRESHOLD,
        resetTime: this.CIRCUIT_BREAKER_RESET_TIME
      },
      conversations: {
        joined: this.getJoinedConversations(),
        count: this.joinedConversations.size
      },
      ready: this.isReadyForChat()
    };
  }
}

// Singleton global más estricto
let globalSocketService: SocketService | null = null;

export const getSocketService = (): SocketService => {
  if (!globalSocketService) {
    globalSocketService = new SocketService();
    console.log('🔧 SocketService: Nueva instancia creada');
  }
  return globalSocketService;
};

export const socketService = getSocketService();
export default socketService;

