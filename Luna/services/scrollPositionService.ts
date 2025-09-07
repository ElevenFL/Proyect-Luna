import AsyncStorage from '@react-native-async-storage/async-storage';

interface ScrollPosition {
  conversationId: string;
  offset: number;
  timestamp: string;
}

/**
 * Servicio para manejar la posición del scroll en las conversaciones
 * Permite guardar y restaurar la posición del scroll para una mejor experiencia de usuario
 */
class ScrollPositionService {
  private readonly SCROLL_POSITION_KEY = 'chat_scroll_positions';
  private readonly MAX_POSITIONS = 50; // Máximo 50 posiciones guardadas
  private readonly POSITION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

  /**
   * Guarda la posición del scroll para una conversación
   */
  async saveScrollPosition(conversationId: string, offset: number): Promise<void> {
    try {
      const positions = await this.getScrollPositions();
      
      positions[conversationId] = {
        conversationId,
        offset,
        timestamp: new Date().toISOString()
      };

      // Limpiar posiciones antiguas si es necesario
      await this.cleanupOldPositions(positions);
      
      await AsyncStorage.setItem(this.SCROLL_POSITION_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Error guardando posición del scroll:', error);
    }
  }

  /**
   * Obtiene la posición del scroll guardada para una conversación
   */
  async getScrollPosition(conversationId: string): Promise<number | null> {
    try {
      const positions = await this.getScrollPositions();
      const position = positions[conversationId];
      
      if (position && this.isPositionValid(position)) {
        return position.offset;
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo posición del scroll:', error);
      return null;
    }
  }

  /**
   * Elimina la posición del scroll guardada para una conversación
   */
  async clearScrollPosition(conversationId: string): Promise<void> {
    try {
      const positions = await this.getScrollPositions();
      delete positions[conversationId];
      await AsyncStorage.setItem(this.SCROLL_POSITION_KEY, JSON.stringify(positions));
    } catch (error) {
      console.error('Error eliminando posición del scroll:', error);
    }
  }

  /**
   * Limpia todas las posiciones del scroll
   */
  async clearAllScrollPositions(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SCROLL_POSITION_KEY);
    } catch (error) {
      console.error('Error limpiando todas las posiciones del scroll:', error);
    }
  }

  /**
   * Obtiene todas las posiciones del scroll guardadas
   */
  private async getScrollPositions(): Promise<{ [conversationId: string]: ScrollPosition }> {
    try {
      const positions = await AsyncStorage.getItem(this.SCROLL_POSITION_KEY);
      return positions ? JSON.parse(positions) : {};
    } catch (error) {
      console.error('Error obteniendo posiciones del scroll:', error);
      return {};
    }
  }

  /**
   * Verifica si una posición del scroll es válida (no expirada)
   */
  private isPositionValid(position: ScrollPosition): boolean {
    const positionAge = Date.now() - new Date(position.timestamp).getTime();
    return positionAge < this.POSITION_EXPIRY_MS;
  }

  /**
   * Limpia posiciones antiguas si excede el límite máximo
   */
  private async cleanupOldPositions(positions: { [conversationId: string]: ScrollPosition }): Promise<void> {
    const conversationIds = Object.keys(positions);
    
    if (conversationIds.length > this.MAX_POSITIONS) {
      // Ordenar por timestamp (más recientes primero)
      const sortedPositions = conversationIds
        .map(id => ({
          id,
          timestamp: positions[id].timestamp
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Mantener solo las posiciones más recientes
      const toKeep = sortedPositions.slice(0, this.MAX_POSITIONS);
      const toRemove = sortedPositions.slice(this.MAX_POSITIONS);
      
      // Eliminar posiciones antiguas
      toRemove.forEach(pos => {
        delete positions[pos.id];
      });
    }
  }
}

// Singleton
export const scrollPositionService = new ScrollPositionService();
export default scrollPositionService;
