import { API_CONFIG } from '../config/api';

interface ApiError extends Error {
  code: string;
  status?: number;
  details?: any;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  user?: T; // Para compatibilidad con respuestas que devuelven user en lugar de data
  message?: string;
  error?: string;
  details?: any;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  duration: number;
}

interface RequestOptions extends RequestInit {
  useCache?: boolean;
  timeout?: number;
}

class ApiService {
  // Variables estáticas privadas
  private static instance: ApiService;
  private token: string = '';
  private retryCount: number = 0;
  private requestCache: Map<string, CacheEntry> = new Map();
  private requestsInProgress: Map<string, Promise<any>> = new Map();
  private readonly CACHE_DURATION = 5000; // 5 segundos de caché
  private readonly CONVERSATIONS_CACHE_DURATION = 15000; // 15 segundos de caché para conversaciones
  private readonly MAX_CONCURRENT_REQUESTS = 3; // Máximo de peticiones concurrentes
  private cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Constructor privado para singleton
  private constructor() {
    // Iniciar limpieza periódica del caché cada 30 segundos
    this.startCacheCleanup();
  }

  /**
   * Inicia la limpieza periódica del caché
   */
  private startCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 30000); // Limpiar cada 30 segundos
  }

  /**
   * Detiene la limpieza periódica del caché
   */
  private stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
  }

  /**
   * Limpia el caché de peticiones expiradas
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > entry.duration) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.requestCache.delete(key);
    });
    
    if (keysToDelete.length > 0 && __DEV__) {
      console.log(`🧹 ApiService: Limpiados ${keysToDelete.length} elementos del caché`);
    }
  }

  /**
   * Genera una clave de caché consistente
   */
  private generateCacheKey(endpoint: string, params: any = {}): string {
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  /**
   * Obtiene la duración de caché apropiada para un endpoint
   */
  private getCacheDuration(endpoint: string): number {
    return endpoint.includes('/chat/conversations') ? 
      this.CONVERSATIONS_CACHE_DURATION : this.CACHE_DURATION;
  }

  /**
   * Limpia peticiones que ya se han resuelto
   */
  private async cleanupResolvedRequests(): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [key, promise] of this.requestsInProgress.entries()) {
      try {
        // Usar Promise.race para verificar si la promesa ya se resolvió
        await Promise.race([
          promise.then(() => true).catch(() => true),
          new Promise(resolve => setTimeout(() => resolve(false), 1))
        ]);
        keysToDelete.push(key);
      } catch {
        // La promesa aún está pendiente
        continue;
      }
    }
    
    keysToDelete.forEach(key => {
      this.requestsInProgress.delete(key);
    });
  }

  // Obtener instancia singleton
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Método privado para realizar peticiones HTTP
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    useCache: boolean = true
  ): Promise<ApiResponse<T>> {
    const { useCache: optionsUseCache, timeout, ...requestOptions } = options;
    const shouldUseCache = optionsUseCache !== undefined ? optionsUseCache : useCache;

    // Verificar caché para peticiones GET
    if (shouldUseCache && (!requestOptions.method || requestOptions.method === 'GET')) {
      const cacheKey = this.generateCacheKey(endpoint, requestOptions.body || {});
      const cached = this.requestCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < cached.duration) {
        if (__DEV__) {
          console.log(`📦 ApiService: Usando caché para ${endpoint} (${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
        }
        return cached.data;
      }
    }

    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...requestOptions.headers as Record<string, string>
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else if (__DEV__) {
      console.warn('⚠️ ApiService: No hay token disponible para la petición a', endpoint);
    }

    const config: RequestInit = {
      ...requestOptions,
      headers
    };

    // Configurar timeout optimizado
    const controller = new AbortController();
    const timeoutDuration = timeout || (endpoint.includes('/chat/') ? API_CONFIG.TIMEOUT * 1.2 : API_CONFIG.TIMEOUT);
    const timeoutId = setTimeout(() => {
      if (__DEV__) {
        console.warn(`⏰ ApiService: Timeout de ${timeoutDuration}ms alcanzado para ${endpoint}`);
      }
      controller.abort();
    }, timeoutDuration);
    config.signal = controller.signal;

    // Generar una clave única para esta petición
    const requestKey = this.generateCacheKey(endpoint, requestOptions.body || {});

    // Verificar si la misma petición ya está en progreso
    const existingRequest = this.requestsInProgress.get(requestKey);
    if (existingRequest) {
      if (__DEV__) {
        console.log('📝 ApiService: Reutilizando petición en progreso para', endpoint);
      }
      return existingRequest;
    }

    // Verificar y manejar peticiones concurrentes
    while (this.requestsInProgress.size >= this.MAX_CONCURRENT_REQUESTS) {
      if (__DEV__) {
        console.warn(`⚠️ ApiService: Demasiadas peticiones concurrentes (${this.requestsInProgress.size}), esperando...`);
      }
      
      // Limpiar peticiones resueltas antes de esperar
      await this.cleanupResolvedRequests();
      
      // Esperar un poco antes de verificar nuevamente
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {

      // Crear la promesa de la petición
      const requestPromise = (async () => {
        let lastError = null;
        
        for (let attempt = 1; attempt <= API_CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
          try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
              // Bypass en desarrollo para endpoints tolerados (no loguear ni reintentar)
              const isDev = __DEV__ === true || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production');
              const isToleratedEndpoint = endpoint === '/users/connection-status';
              if (isDev && isToleratedEndpoint && response.status >= 500) {
                console.warn('🧪 ApiService: Tolerando 5xx en', endpoint, '(dev)');
                return { success: true, data: { devMode: true } as any } as any;
              }

              console.error(`❌ ApiService: Error en la respuesta (intento ${attempt}/${API_CONFIG.RETRY.MAX_ATTEMPTS}):`, {
                status: response.status,
                statusText: response.statusText,
                url: response.url
              });

              const error: ApiError = new Error(data.message || 'Error en la petición') as ApiError;
              error.code = data.error || 'SERVER_ERROR';
              error.status = response.status;
              error.details = data.details;
              throw error;
            }

            // Guardar en caché si es una petición GET exitosa
            if (shouldUseCache && (!requestOptions.method || requestOptions.method === 'GET')) {
              const cacheKey = this.generateCacheKey(endpoint, requestOptions.body || {});
              const cacheDuration = this.getCacheDuration(endpoint);
              
              this.requestCache.set(cacheKey, {
                data: { success: true, data: data.data || data },
                timestamp: Date.now(),
                duration: cacheDuration
              });
              
              // Log para conversaciones
              if (endpoint.includes('/chat/conversations') && __DEV__) {
                console.log(`💾 ApiService: Guardando en caché conversaciones (${data.data?.items?.length || 0} items)`);
              }
            }

            return { success: true, data: data.data || data };
          } catch (error) {
            lastError = error;
            clearTimeout(timeoutId);

            // Si es el último intento, propagar el error
            if (attempt === API_CONFIG.RETRY.MAX_ATTEMPTS) {
              throw error;
            }

            // Calcular delay con jitter
            const baseDelay = Math.min(
              API_CONFIG.RETRY.INITIAL_DELAY * Math.pow(API_CONFIG.RETRY.BACKOFF_FACTOR, attempt - 1),
              API_CONFIG.RETRY.MAX_DELAY
            );
            const jitter = Math.random() * API_CONFIG.RETRY.JITTER;
            const delay = baseDelay + jitter;

            console.log(`🔄 ApiService: Reintentando petición (${attempt}/${API_CONFIG.RETRY.MAX_ATTEMPTS}) en ${Math.round(delay)}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        throw lastError;
      })();

      // Registrar la promesa en progreso
      this.requestsInProgress.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;
        return result;
      } finally {
        // Limpiar la promesa completada
        this.requestsInProgress.delete(requestKey);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Limpiar la petición abortada del mapa
          this.requestsInProgress.delete(requestKey);
          throw new Error('La petición tardó demasiado. Por favor, intente nuevamente.');
        }

        // Errores de red
        if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
          throw new Error('No se puede conectar con el servidor. Verifica tu conexión a internet y que el backend esté funcionando.');
        }

        // Errores de autenticación
        if ('status' in error && error.status === 401) {
          throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
        }

        throw error;
      }

      throw new Error('Error desconocido en la petición.');
    }
  }

  /**
   * Establece el token de autenticación
   */
  public setAuthToken(token: string): void {
    this.token = token;
  }

  /**
   * Obtiene el token de autenticación actual
   */
  public getAuthToken(): string {
    return this.token;
  }

  /**
   * Limpia todas las peticiones en progreso (útil para debugging)
   */
  public clearAllRequests(): void {
    if (__DEV__) {
      console.warn(`🧹 ApiService: Limpiando ${this.requestsInProgress.size} peticiones en progreso`);
    }
    this.requestsInProgress.clear();
  }

  /**
   * Limpia todo el caché
   */
  public clearCache(): void {
    if (__DEV__) {
      console.warn(`🧹 ApiService: Limpiando ${this.requestCache.size} elementos del caché`);
    }
    this.requestCache.clear();
  }

  /**
   * Destruye la instancia y limpia recursos
   */
  public destroy(): void {
    this.stopCacheCleanup();
    this.clearAllRequests();
    this.clearCache();
  }


  /**
   * Realiza una petición GET
   */
  public async get<T = any>(endpoint: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  /**
   * Realiza una petición POST
   */
  public async post<T = any>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Realiza una petición PUT
   */
  public async put<T = any>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Realiza una petición DELETE
   */
  public async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Verifica si hay conexión con el servidor
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.success !== false;
    } catch (error) {
      console.warn('⚠️ ApiService: No se puede conectar con el backend:', error);
      return false;
    }
  }

  /**
   * Verifica la salud del backend usando un endpoint más confiable
   */
  public async checkBackendHealth(): Promise<{ isHealthy: boolean; status?: string; error?: string }> {
    try {
      // Intentar con el endpoint de health primero
      try {
        const response = await this.request<{ status: string; timestamp: string; uptime: number }>('/health', { method: 'GET' }, false);
        return {
          isHealthy: response.success && response.data?.status === 'OK',
          status: response.data?.status
        };
      } catch (healthError) {
        // Si el endpoint /health no existe, intentar con /profile como fallback
        console.log('🔄 ApiService: Endpoint /health no disponible, verificando con /profile...');
        const profileResponse = await this.request('/profile', { method: 'GET' }, false);
        return {
          isHealthy: profileResponse.success !== false,
          status: 'OK'
        };
      }
    } catch (error) {
      console.error('❌ ApiService: Error verificando salud del backend:', error);
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Verifica si un token es válido
   */
  public async verifyToken(token: string): Promise<boolean> {
    try {
      const prevToken = this.token;
      this.token = token;
      await this.get('/users/verify-token');
      this.token = prevToken;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sincroniza un usuario de Amplify con el backend personalizado
   */
  public async syncAmplifyUser(username: string, email: string, sub: string): Promise<ApiResponse<any>> {
    return this.post('/users/sync-amplify', {
      username,
      email,
      sub
    });
  }

  /**
   * Verifica el estado del perfil del usuario
   */
  public async getProfileStatus(): Promise<ApiResponse<{ profileCompleted: boolean; missingFields: string[] }>> {
    return this.get('/users/profile-status');
  }

  /**
   * Obtiene el perfil completo del usuario
   */
  public async getProfile(): Promise<ApiResponse<{
    displayName?: string;
    birthDate?: string;
    gender?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      address?: string;
    };
    profileImage?: string;
    profileCompleted?: boolean;
  }>> {
    return this.get('/profile');
  }

  /**
   * Actualiza el perfil del usuario (onboarding)
   */
  public async updateProfile(profileData: {
    displayName?: string;
    birthDate?: string;
    gender?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      address?: string;
    };
    profileImage?: string;
    profileCompleted?: boolean;
  }): Promise<ApiResponse<{ success: boolean; updatedFields: string[] }>> {
    return this.put('/profile', profileData);
  }

  /**
   * Actualiza solo el nombre del usuario
   */
  public async updateName(displayName: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.put('/profile', { displayName });
  }

  /**
   * Actualiza solo la fecha de nacimiento del usuario
   */
  public async updateBirthDate(birthDate: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.put('/profile', { birthDate });
  }

  /**
   * Actualiza solo el género del usuario
   */
  public async updateGender(gender: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.put('/profile', { gender });
  }

  /**
   * Actualiza solo la ubicación del usuario
   */
  public async updateLocation(location: {
    latitude?: number;
    longitude?: number;
    address?: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    return this.put('/profile', { location });
  }

  /**
   * Actualiza solo la foto de perfil del usuario
   */
  public async updateProfileImage(profileImage: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.put('/profile', { profileImage });
  }

  /**
   * Marca el perfil como completado
   */
  public async markProfileCompleted(): Promise<ApiResponse<{ success: boolean }>> {
    return this.put('/profile', { profileCompleted: true });
  }

  /**
   * Verifica si el perfil está completado
   */
  public async isProfileCompleted(): Promise<boolean> {
    try {
      const response = await this.getProfile();
      return response.success && response.data?.profileCompleted === true;
    } catch (error) {
      console.error('Error verificando estado del perfil:', error);
      return false;
    }
  }

  // ====== CHAT ======
  public async getOrCreateConversationWith(otherUserId: string): Promise<ApiResponse<any>> {
    return this.post(`/chat/conversations/with/${otherUserId}`, {});
  }

  public async listConversations(params: { limit?: number; nextKey?: string } = {}): Promise<ApiResponse<{ items: any[]; nextKey?: string }>> {
    // Optimizar parámetros para mejor caché
    const optimizedParams = {
      limit: Math.min(params.limit || 20, 20), // Limitar a 20 para mejor rendimiento
      ...(params.nextKey && { nextKey: params.nextKey })
    };
    
    // Verificar caché específico para conversaciones
    const cacheKey = this.generateCacheKey('/chat/conversations', optimizedParams);
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < cached.duration) {
      if (__DEV__) {
        console.log(`📦 ApiService: Usando caché para conversaciones (${cached.data.data?.items?.length || 0} items)`);
      }
      return cached.data;
    }
    
    // Solo loggear en casos específicos para evitar spam
    const shouldLog = !this.requestCache.has(cacheKey);
    
    if (__DEV__ && shouldLog) {
      console.log('🌐 ApiService: Llamando a /chat/conversations con params:', optimizedParams);
    }
    
    const result = await this.get('/chat/conversations', optimizedParams);
    
    // Solo loggear respuesta si es la primera vez o hay errores
    if ((__DEV__ && shouldLog) || !result.success) {
      console.log('🌐 ApiService: Respuesta de /chat/conversations:', {
        success: result.success,
        dataKeys: result.data ? Object.keys(result.data) : 'no data',
        itemsCount: result.data?.items?.length || 0,
        message: result.message,
        error: result.error
      });
    }
    
    return result;
  }

  public async listMessages(conversationId: string, params: { limit?: number; nextKey?: string } = {}): Promise<ApiResponse<{ items: any[]; nextKey?: string }>> {
    return this.get(`/chat/conversations/${conversationId}/messages`, params);
  }

  public async sendMessage(conversationId: string, payload: { content: string; receiverId: string; type?: 'text' | 'image' }): Promise<ApiResponse<{ messageId: string; timestamp: string }>> {
    return this.post(`/chat/conversations/${conversationId}/messages`, payload);
  }

  /**
   * Obtiene información del otro usuario en una conversación
   */
  public async getOtherUserInfo(conversationId: string): Promise<ApiResponse<{
    otherUser: {
      id: string;
      name: string;
      username: string;
      email: string;
      profileImage?: string;
      age?: number;
      gender: string;
      country: string;
      countryFlag: string;
      description: string;
      isOnline: boolean;
      lastSeen?: string;
      lastConnection?: string;
      birthDate?: string;
      location?: any;
      profileCompleted: boolean;
    };
  }>> {
    return this.get(`/chat/conversations/${conversationId}/other-user`);
  }

  // ====== USUARIOS ======
  /**
   * Obtiene usuarios ordenados por estado de conexión
   */
  public async getHomeUsers(): Promise<ApiResponse<{ users: any[]; totalCount: number }>> {
    return this.get('/users/home');
  }

  /**
   * Actualiza el estado de conexión del usuario actual
   */
  public async updateConnectionStatus(isOnline: boolean, lastConnection?: string): Promise<ApiResponse<{ success: boolean; devMode?: boolean }>> {
    try {
      return await this.put('/users/connection-status', { isOnline, lastConnection });
    } catch (error) {
      // En desarrollo, tolerar errores 5xx de este endpoint para no ensuciar logs ni bloquear UX
      const isDev = __DEV__ === true || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production');
      const status = (error as any)?.status;
      if (isDev && status && status >= 500) {
        console.warn('🧪 ApiService: Tolerando 5xx en /users/connection-status (dev)');
        return { success: true, data: { success: true, devMode: true } };
      }
      throw error;
    }
  }
}

// Exportar la instancia singleton
const apiService = ApiService.getInstance();
export default apiService;
