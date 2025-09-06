import { API_CONFIG } from '../config/api';

interface ApiError extends Error {
  code: string;
  status?: number;
  details?: any;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
}

class ApiService {
  private static token: string = '';
  private static retryCount: number = 0;

  /**
   * Establece el token de autenticación
   */
  static setAuthToken(token: string) {
    this.token = token;
  }

  /**
   * Realiza una petición a la API con reintentos y manejo de errores
   */
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers
    };

    // Configurar timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    config.signal = controller.signal;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || 'Error en la petición') as ApiError;
        error.code = data.error || 'UNKNOWN_ERROR';
        error.status = response.status;
        error.details = data.details;
        throw error;
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          if (this.retryCount < API_CONFIG.RETRY.MAX_ATTEMPTS) {
            this.retryCount++;
            const delay = API_CONFIG.RETRY.DELAY * Math.pow(API_CONFIG.RETRY.BACKOFF_FACTOR, this.retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.request(endpoint, options);
          }
          throw new Error('La petición tardó demasiado. Por favor, intente nuevamente.');
        }

        // Errores de autenticación
        if ('status' in error && error.status === 401) {
          throw new Error('Sesión expirada. Por favor, inicie sesión nuevamente.');
        }

        throw error;
      }

      throw new Error('Error desconocido en la petición.');
    } finally {
      this.retryCount = 0;
    }
  }

  /**
   * Realiza una petición GET
   */
  static async get<T = any>(endpoint: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  /**
   * Realiza una petición POST
   */
  static async post<T = any>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Realiza una petición PUT
   */
  static async put<T = any>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Realiza una petición DELETE
   */
  static async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Verifica si hay conexión con el servidor
   */
  static async checkConnection(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verifica si un token es válido
   */
  static async verifyToken(token: string): Promise<boolean> {
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
  static async syncAmplifyUser(username: string, email: string, sub: string): Promise<ApiResponse<any>> {
    return this.post('/users/sync-amplify', {
      username,
      email,
      sub
    });
  }

  /**
   * Verifica el estado del perfil del usuario
   */
  static async getProfileStatus(): Promise<ApiResponse<any>> {
    return this.get('/users/profile-status');
  }

  /**
   * Obtiene el perfil completo del usuario
   */
  static async getProfile(): Promise<ApiResponse<any>> {
    return this.get('/profile');
  }

  /**
   * Actualiza el perfil del usuario (onboarding)
   */
  static async updateProfile(profileData: {
    displayName?: string;
    birthDate?: string;
    gender?: string;
    location?: {
      latitude?: number;
      longitude?: number;
      address?: string;
    };
    profileImage?: string;
  }): Promise<ApiResponse<any>> {
    return this.put('/profile', profileData);
  }

  /**
   * Actualiza solo el nombre del usuario
   */
  static async updateName(displayName: string): Promise<ApiResponse<any>> {
    return this.put('/profile', { displayName });
  }

  /**
   * Actualiza solo la fecha de nacimiento del usuario
   */
  static async updateBirthDate(birthDate: string): Promise<ApiResponse<any>> {
    return this.put('/profile', { birthDate });
  }

  /**
   * Actualiza solo el género del usuario
   */
  static async updateGender(gender: string): Promise<ApiResponse<any>> {
    return this.put('/profile', { gender });
  }

  /**
   * Actualiza solo la ubicación del usuario
   */
  static async updateLocation(location: {
    latitude?: number;
    longitude?: number;
    address?: string;
  }): Promise<ApiResponse<any>> {
    return this.put('/profile', { location });
  }

  /**
   * Actualiza solo la foto de perfil del usuario
   */
  static async updateProfileImage(profileImage: string): Promise<ApiResponse<any>> {
    return this.put('/profile', { profileImage });
  }

  /**
   * Marca el perfil como completado
   */
  static async markProfileCompleted(): Promise<ApiResponse<any>> {
    return this.put('/profile', { profileCompleted: true });
  }

  // ====== CHAT ======
  static async getOrCreateConversationWith(otherUserId: string): Promise<ApiResponse<any>> {
    return this.post(`/chat/conversations/with/${otherUserId}`, {});
  }

  static async listConversations(params: { limit?: number; nextKey?: any } = {}): Promise<ApiResponse<any>> {
    return this.get('/chat/conversations', params as any);
  }

  static async listMessages(conversationId: string, params: { limit?: number; nextKey?: any } = {}): Promise<ApiResponse<any>> {
    return this.get(`/chat/conversations/${conversationId}/messages`, params as any);
  }

  static async sendMessage(conversationId: string, payload: { content: string; receiverId: string; type?: 'text' | 'image' }): Promise<ApiResponse<any>> {
    return this.post(`/chat/conversations/${conversationId}/messages`, payload as any);
  }

  // ====== USUARIOS ======
  /**
   * Obtiene usuarios ordenados por estado de conexión
   */
  static async getHomeUsers(): Promise<ApiResponse<any>> {
    return this.get('/users/home');
  }

  /**
   * Actualiza el estado de conexión del usuario actual
   */
  static async updateConnectionStatus(isOnline: boolean, lastConnection?: string): Promise<ApiResponse<any>> {
    return this.put('/users/connection-status', { isOnline, lastConnection });
  }
}

export default ApiService;
