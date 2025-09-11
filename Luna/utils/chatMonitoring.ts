import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sistema de monitoreo y analytics para el chat
 */
export class ChatMonitoring {
  private static instance: ChatMonitoring;
  private sessionId: string;
  private sessionStart: number;
  private metrics: {
    messagesTyped: number;
    messagesSent: number;
    messagesReceived: number;
    connectionLost: number;
    reconnectionAttempts: number;
    averageResponseTime: number;
    scrollEvents: number;
    optimisticMessageFailures: number;
  };

  constructor() {
    this.sessionId = `chat_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStart = Date.now();
    this.metrics = {
      messagesTyped: 0,
      messagesSent: 0,
      messagesReceived: 0,
      connectionLost: 0,
      reconnectionAttempts: 0,
      averageResponseTime: 0,
      scrollEvents: 0,
      optimisticMessageFailures: 0,
    };
  }

  static getInstance(): ChatMonitoring {
    if (!ChatMonitoring.instance) {
      ChatMonitoring.instance = new ChatMonitoring();
    }
    return ChatMonitoring.instance;
  }

  /**
   * Registra el envío de un mensaje
   */
  logMessageSent(messageId: string, content: string) {
    this.metrics.messagesSent++;
    
    console.log('📊 ChatMonitoring: Mensaje enviado', {
      sessionId: this.sessionId,
      messageId,
      contentLength: content.length,
      totalSent: this.metrics.messagesSent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Registra la recepción de un mensaje
   */
  logMessageReceived(messageId: string, senderId: string, responseTime?: number) {
    this.metrics.messagesReceived++;
    
    if (responseTime) {
      // Calcular tiempo de respuesta promedio
      const totalResponses = this.metrics.messagesReceived;
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalResponses - 1) + responseTime) / totalResponses;
    }
    
    console.log('📊 ChatMonitoring: Mensaje recibido', {
      sessionId: this.sessionId,
      messageId,
      senderId,
      responseTime,
      avgResponseTime: Math.round(this.metrics.averageResponseTime),
      totalReceived: this.metrics.messagesReceived,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Registra pérdida de conexión
   */
  logConnectionLost(reason?: string) {
    this.metrics.connectionLost++;
    
    console.log('📊 ChatMonitoring: Conexión perdida', {
      sessionId: this.sessionId,
      reason,
      count: this.metrics.connectionLost,
      sessionDuration: Date.now() - this.sessionStart,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Registra intento de reconexión
   */
  logReconnectionAttempt(attempt: number, successful: boolean) {
    if (!successful) {
      this.metrics.reconnectionAttempts++;
    }
    
    console.log('📊 ChatMonitoring: Intento de reconexión', {
      sessionId: this.sessionId,
      attempt,
      successful,
      totalAttempts: this.metrics.reconnectionAttempts,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Registra evento de scroll
   */
  logScrollEvent(direction: 'up' | 'down', distanceFromBottom: number) {
    this.metrics.scrollEvents++;
    
    // Solo log cada 10 eventos para evitar spam
    if (this.metrics.scrollEvents % 10 === 0) {
      console.log('📊 ChatMonitoring: Eventos de scroll', {
        sessionId: this.sessionId,
        totalScrollEvents: this.metrics.scrollEvents,
        lastDirection: direction,
        lastDistanceFromBottom: Math.round(distanceFromBottom),
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Registra fallo de mensaje optimista
   */
  logOptimisticMessageFailure(messageId: string, reason: string) {
    this.metrics.optimisticMessageFailures++;
    
    console.log('📊 ChatMonitoring: Fallo mensaje optimista', {
      sessionId: this.sessionId,
      messageId,
      reason,
      totalFailures: this.metrics.optimisticMessageFailures,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Obtiene resumen de métricas
   */
  getMetricsSummary() {
    const sessionDuration = Date.now() - this.sessionStart;
    
    return {
      sessionId: this.sessionId,
      sessionDuration,
      sessionStart: new Date(this.sessionStart).toISOString(),
      metrics: { ...this.metrics },
      ratios: {
        messagesPerMinute: (this.metrics.messagesSent / (sessionDuration / 60000)),
        connectionStability: this.metrics.connectionLost === 0 ? 100 : 
          Math.max(0, 100 - (this.metrics.connectionLost * 10)),
        optimisticFailureRate: this.metrics.messagesSent === 0 ? 0 :
          (this.metrics.optimisticMessageFailures / this.metrics.messagesSent) * 100,
      },
    };
  }

  /**
   * Guarda métricas en almacenamiento local
   */
  async saveMetrics() {
    try {
      const summary = this.getMetricsSummary();
      const key = `chat_metrics_${this.sessionId}`;
      await AsyncStorage.setItem(key, JSON.stringify(summary));
      
      console.log('📊 ChatMonitoring: Métricas guardadas', { sessionId: this.sessionId });
    } catch (error) {
      console.error('❌ ChatMonitoring: Error guardando métricas:', error);
    }
  }

  /**
   * Obtiene métricas de sesiones anteriores
   */
  async getPreviousMetrics(limit = 10): Promise<any[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const metricKeys = keys.filter(key => key.startsWith('chat_metrics_'));
      
      const recentKeys = metricKeys
        .sort((a, b) => {
          const timestampA = parseInt(a.split('_')[2]);
          const timestampB = parseInt(b.split('_')[2]);
          return timestampB - timestampA;
        })
        .slice(0, limit);

      const metrics = [];
      for (const key of recentKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            metrics.push(JSON.parse(data));
          }
        } catch (error) {
          console.error(`❌ Error leyendo métricas ${key}:`, error);
        }
      }

      return metrics;
    } catch (error) {
      console.error('❌ ChatMonitoring: Error obteniendo métricas anteriores:', error);
      return [];
    }
  }

  /**
   * Limpia métricas antiguas (mantener solo las últimas 20 sesiones)
   */
  async cleanupOldMetrics() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const metricKeys = keys.filter(key => key.startsWith('chat_metrics_'));
      
      if (metricKeys.length > 20) {
        const sortedKeys = metricKeys.sort((a, b) => {
          const timestampA = parseInt(a.split('_')[2]);
          const timestampB = parseInt(b.split('_')[2]);
          return timestampA - timestampB; // Más antiguos primero
        });

        const keysToDelete = sortedKeys.slice(0, metricKeys.length - 20);
        
        for (const key of keysToDelete) {
          await AsyncStorage.removeItem(key);
        }

        console.log(`📊 ChatMonitoring: ${keysToDelete.length} métricas antiguas limpiadas`);
      }
    } catch (error) {
      console.error('❌ ChatMonitoring: Error limpiando métricas:', error);
    }
  }

  /**
   * Finaliza la sesión y guarda métricas
   */
  async endSession() {
    await this.saveMetrics();
    await this.cleanupOldMetrics();
    
    const summary = this.getMetricsSummary();
    console.log('📊 ChatMonitoring: Sesión finalizada', summary);
    
    return summary;
  }
}

// Instancia singleton
export const chatMonitoring = ChatMonitoring.getInstance();

/**
 * Hook para usar el sistema de monitoreo en componentes React
 */
export const useChatMonitoring = () => {
  const monitoring = ChatMonitoring.getInstance();
  
  return {
    logMessageSent: monitoring.logMessageSent.bind(monitoring),
    logMessageReceived: monitoring.logMessageReceived.bind(monitoring),
    logConnectionLost: monitoring.logConnectionLost.bind(monitoring),
    logReconnectionAttempt: monitoring.logReconnectionAttempt.bind(monitoring),
    logScrollEvent: monitoring.logScrollEvent.bind(monitoring),
    logOptimisticMessageFailure: monitoring.logOptimisticMessageFailure.bind(monitoring),
    getMetricsSummary: monitoring.getMetricsSummary.bind(monitoring),
    endSession: monitoring.endSession.bind(monitoring),
    getPreviousMetrics: monitoring.getPreviousMetrics.bind(monitoring),
  };
};
