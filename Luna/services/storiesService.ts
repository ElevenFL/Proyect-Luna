import { API_CONFIG } from '@/config/api';
import ApiService from './apiService';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  content: string;
  timestamp: string;
}

export interface Story {
  id: string;
  userId?: string;
  userName?: string;
  userProfileImage?: string;
  content: {
    type: 'image' | 'text';
    data: string;
    description?: string;
  };
  location?: string;
  createdAt: string;
  expiresAt: string;
  isViewed: boolean;
  stats: {
    views: number;
    likes: number;
    reactions: number;
    comments: number;
    isExpired: boolean;
  };
}

export interface CreateStoryData {
  content: {
    type: 'image' | 'text';
    data: string;
    description?: string;
  };
  location?: string;
}

export interface StoriesByUser {
  userId: string;
  userName: string;
  userProfileImage?: string;
  stories: Story[];
}

class StoriesService {
  private baseUrl = `${API_CONFIG.BASE_URL}/stories`;

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    try {
      const token = this.getAuthToken();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error en StoriesService:', error);
      throw error;
    }
  }

  private getAuthToken(): string {
    return ApiService.getAuthToken();
  }

  // Crear un nuevo story
  async createStory(storyData: CreateStoryData): Promise<Story> {
    const response = await this.makeRequest('/', {
      method: 'POST',
      body: JSON.stringify(storyData),
    });

    if (!response.success) {
      throw new Error(response.message || 'Error creando story');
    }

    return response.data;
  }

  // Obtener stories de un usuario específico
  async getUserStories(userId: string): Promise<StoriesByUser> {
    const response = await this.makeRequest(`/user/${userId}`);

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo stories del usuario');
    }

    return response.data;
  }

  // Obtener stories de amigos
  async getFriendsStories(friendIds?: string[]): Promise<StoriesByUser[]> {
    const queryParams = friendIds ? `?friendIds=${friendIds.join(',')}` : '';
    const response = await this.makeRequest(`/friends${queryParams}`);

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo stories de amigos');
    }

    return response.data.storiesByUser;
  }

  // Obtener todos los stories activos
  async getAllActiveStories(userIds?: string[]): Promise<StoriesByUser[]> {
    const queryParams = userIds ? `?userIds=${userIds.join(',')}` : '';
    const response = await this.makeRequest(`/active${queryParams}`);

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo stories activos');
    }

    return response.data.storiesByUser;
  }

  // Marcar un story como visto
  async markStoryAsViewed(storyId: string): Promise<void> {
    const response = await this.makeRequest(`/${storyId}/view`, {
      method: 'PATCH',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error marcando story como visto');
    }
  }

  // Dar like a un story
  async likeStory(storyId: string): Promise<{ likes: string[]; stats: any }> {
    const response = await this.makeRequest(`/${storyId}/like`, {
      method: 'POST',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error dando like al story');
    }

    return response.data;
  }

  // Quitar like de un story
  async unlikeStory(storyId: string): Promise<{ likes: string[]; stats: any }> {
    const response = await this.makeRequest(`/${storyId}/like`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error quitando like del story');
    }

    return response.data;
  }

  // Agregar reacción a un story
  async addReaction(storyId: string, reactionType: string): Promise<{ reactions: any[]; stats: any }> {
    const response = await this.makeRequest(`/${storyId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ type: reactionType }),
    });

    if (!response.success) {
      throw new Error(response.message || 'Error agregando reacción al story');
    }

    return response.data;
  }

  // Eliminar un story
  async deleteStory(storyId: string): Promise<void> {
    const response = await this.makeRequest(`/${storyId}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error eliminando story');
    }
  }

  // Obtener estadísticas de un story
  async getStoryStats(storyId: string): Promise<any> {
    const response = await this.makeRequest(`/${storyId}/stats`);

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo estadísticas del story');
    }

    return response.data;
  }

  // Limpiar stories expirados (endpoint administrativo)
  async cleanupExpiredStories(): Promise<{ deletedCount: number }> {
    const response = await this.makeRequest('/cleanup', {
      method: 'POST',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error limpiando stories expirados');
    }

    return response.data;
  }

  // Agregar comentario a un story
  async addComment(storyId: string, content: string): Promise<{ comment: Comment; stats: any }> {
    const response = await this.makeRequest(`/${storyId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    if (!response.success) {
      throw new Error(response.message || 'Error agregando comentario');
    }

    return response.data;
  }

  // Obtener comentarios de un story
  async getComments(storyId: string): Promise<{ comments: Comment[]; totalComments: number }> {
    const response = await this.makeRequest(`/${storyId}/comments`);

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo comentarios');
    }

    return response.data;
  }

  // Eliminar comentario de un story
  async removeComment(storyId: string, commentId: string): Promise<{ stats: any }> {
    const response = await this.makeRequest(`/${storyId}/comments/${commentId}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error eliminando comentario');
    }

    return response.data;
  }

  // Método helper para subir imagen de story
  async uploadStoryImage(imageUri: string): Promise<string> {
    try {
      // Aquí implementarías la lógica para subir la imagen
      // Por ahora retornamos la URI original
      return imageUri;
    } catch (error) {
      console.error('❌ Error subiendo imagen del story:', error);
      throw error;
    }
  }

  // Método helper para validar contenido del story
  validateStoryContent(content: CreateStoryData['content']): boolean {
    if (!content || !content.type || !content.data) {
      return false;
    }

    if (!['image', 'text'].includes(content.type)) {
      return false;
    }

    if (content.type === 'text' && content.data.length > 200) {
      return false;
    }

    return true;
  }

  // Método helper para verificar si un story ha expirado
  isStoryExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }

  // Método helper para obtener tiempo restante de un story
  getStoryTimeRemaining(expiresAt: string): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    return Math.max(0, expiry.getTime() - now.getTime());
  }
}

export default new StoriesService();
