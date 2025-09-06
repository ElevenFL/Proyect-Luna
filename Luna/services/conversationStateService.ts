import AsyncStorage from '@react-native-async-storage/async-storage';

interface ConversationState {
  conversationId: string;
  isInitialized: boolean;
  lastAccessTime: string;
  isActive: boolean;
  participants: string[];
  lastMessageId?: string;
  version: number;
}

interface ConversationStates {
  [conversationId: string]: ConversationState;
}

/**
 * Servicio para manejar el estado de las conversaciones
 * Evita reinicializaciones innecesarias y mantiene el estado persistente
 */
class ConversationStateService {
  private readonly STATE_KEY = 'conversation_states';
  private readonly MAX_STATES = 50; // Máximo 50 conversaciones en estado
  private readonly STATE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

  /**
   * Obtiene el estado de una conversación
   */
  async getConversationState(conversationId: string): Promise<ConversationState | null> {
    try {
      const states = await this.getConversationStates();
      const state = states[conversationId];
      
      if (state && this.isStateValid(state)) {
        return state;
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo estado de conversación:', error);
      return null;
    }
  }

  /**
   * Actualiza el estado de una conversación
   */
  async updateConversationState(
    conversationId: string, 
    updates: Partial<ConversationState>
  ): Promise<void> {
    try {
      const states = await this.getConversationStates();
      const currentState = states[conversationId];
      
      const updatedState: ConversationState = {
        conversationId,
        isInitialized: false,
        lastAccessTime: new Date().toISOString(),
        isActive: false,
        participants: [],
        version: 0,
        ...currentState,
        ...updates,
        lastAccessTime: new Date().toISOString(),
        version: (currentState?.version || 0) + 1
      };
      
      states[conversationId] = updatedState;
      
      // Limpiar estados antiguos
      await this.cleanupOldStates(states);
      
      await AsyncStorage.setItem(this.STATE_KEY, JSON.stringify(states));
      console.log(`📊 Estado: Actualizado estado de conversación ${conversationId} (v${updatedState.version})`);
    } catch (error) {
      console.error('Error actualizando estado de conversación:', error);
    }
  }

  /**
   * Marca una conversación como inicializada
   */
  async markConversationAsInitialized(conversationId: string, participants: string[]): Promise<void> {
    await this.updateConversationState(conversationId, {
      isInitialized: true,
      participants,
      isActive: true
    });
  }

  /**
   * Marca una conversación como activa/inactiva
   */
  async setConversationActive(conversationId: string, isActive: boolean): Promise<void> {
    await this.updateConversationState(conversationId, { isActive });
  }

  /**
   * Verifica si una conversación ya está inicializada
   */
  async isConversationInitialized(conversationId: string): Promise<boolean> {
    const state = await this.getConversationState(conversationId);
    return state ? state.isInitialized : false;
  }

  /**
   * Verifica si una conversación está activa
   */
  async isConversationActive(conversationId: string): Promise<boolean> {
    const state = await this.getConversationState(conversationId);
    return state ? state.isActive : false;
  }

  /**
   * Obtiene todas las conversaciones activas
   */
  async getActiveConversations(): Promise<ConversationState[]> {
    try {
      const states = await this.getConversationStates();
      return Object.values(states).filter(state => 
        state.isActive && this.isStateValid(state)
      );
    } catch (error) {
      console.error('Error obteniendo conversaciones activas:', error);
      return [];
    }
  }

  /**
   * Obtiene todas las conversaciones inicializadas
   */
  async getInitializedConversations(): Promise<ConversationState[]> {
    try {
      const states = await this.getConversationStates();
      return Object.values(states).filter(state => 
        state.isInitialized && this.isStateValid(state)
      );
    } catch (error) {
      console.error('Error obteniendo conversaciones inicializadas:', error);
      return [];
    }
  }

  /**
   * Limpia el estado de una conversación
   */
  async clearConversationState(conversationId: string): Promise<void> {
    try {
      const states = await this.getConversationStates();
      delete states[conversationId];
      await AsyncStorage.setItem(this.STATE_KEY, JSON.stringify(states));
      console.log(`🗑️ Estado: Limpiado estado de conversación ${conversationId}`);
    } catch (error) {
      console.error('Error limpiando estado de conversación:', error);
    }
  }

  /**
   * Limpia todos los estados de conversaciones
   */
  async clearAllStates(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STATE_KEY);
      console.log('🗑️ Estado: Limpiados todos los estados de conversaciones');
    } catch (error) {
      console.error('Error limpiando todos los estados:', error);
    }
  }

  /**
   * Obtiene información de todos los estados para debugging
   */
  async getStatesInfo(): Promise<{ [conversationId: string]: { 
    isInitialized: boolean; 
    isActive: boolean; 
    lastAccessTime: string; 
    version: number;
    isValid: boolean;
  } }> {
    try {
      const states = await this.getConversationStates();
      const info: { [conversationId: string]: { 
        isInitialized: boolean; 
        isActive: boolean; 
        lastAccessTime: string; 
        version: number;
        isValid: boolean;
      } } = {};
      
      Object.keys(states).forEach(conversationId => {
        const state = states[conversationId];
        info[conversationId] = {
          isInitialized: state.isInitialized,
          isActive: state.isActive,
          lastAccessTime: state.lastAccessTime,
          version: state.version,
          isValid: this.isStateValid(state)
        };
      });
      
      return info;
    } catch (error) {
      console.error('Error obteniendo información de estados:', error);
      return {};
    }
  }

  // Métodos privados

  private async getConversationStates(): Promise<ConversationStates> {
    try {
      const states = await AsyncStorage.getItem(this.STATE_KEY);
      return states ? JSON.parse(states) : {};
    } catch (error) {
      console.error('Error obteniendo estados de conversaciones:', error);
      return {};
    }
  }

  private isStateValid(state: ConversationState): boolean {
    const stateAge = Date.now() - new Date(state.lastAccessTime).getTime();
    return stateAge < this.STATE_EXPIRY_MS;
  }

  private async cleanupOldStates(states: ConversationStates): Promise<void> {
    const validStates: ConversationStates = {};
    const now = Date.now();
    
    // Filtrar estados válidos
    Object.keys(states).forEach(conversationId => {
      const state = states[conversationId];
      if (this.isStateValid(state)) {
        validStates[conversationId] = state;
      }
    });
    
    // Si hay demasiados estados, eliminar los más antiguos
    const stateEntries = Object.entries(validStates);
    if (stateEntries.length > this.MAX_STATES) {
      // Ordenar por tiempo de acceso (más antiguos primero)
      stateEntries.sort((a, b) => 
        new Date(a[1].lastAccessTime).getTime() - new Date(b[1].lastAccessTime).getTime()
      );
      
      // Mantener solo los más recientes
      const recentStates = stateEntries.slice(-this.MAX_STATES);
      Object.keys(validStates).forEach(conversationId => {
        delete validStates[conversationId];
      });
      
      recentStates.forEach(([conversationId, state]) => {
        validStates[conversationId] = state;
      });
    }
    
    // Actualizar el objeto states con los estados válidos
    Object.keys(states).forEach(conversationId => {
      if (!validStates[conversationId]) {
        delete states[conversationId];
      }
    });
  }
}

// Singleton
export const conversationStateService = new ConversationStateService();
export default conversationStateService;
