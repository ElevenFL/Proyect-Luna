import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useReadStatusSync } from '@/hooks/useReadStatusSync';

interface ReadStatusDebuggerProps {
  visible?: boolean;
  onClose?: () => void;
}

/**
 * Componente de debug para monitorear el estado de sincronización de mensajes leídos
 * Útil para desarrollo y testing
 */
export const ReadStatusDebugger: React.FC<ReadStatusDebuggerProps> = ({ 
  visible = false, 
  onClose 
}) => {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { syncReadStatusQueue, getReadStatusStats, clearReadStatusCache } = useReadStatusSync();

  // Actualizar estadísticas cada 2 segundos
  useEffect(() => {
    if (!visible) return;

    const updateStats = () => {
      const currentStats = getReadStatusStats();
      setStats(currentStats);
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, [visible, getReadStatusStats]);

  const handleSyncNow = async () => {
    setIsLoading(true);
    try {
      await syncReadStatusQueue();
      // Actualizar stats después de sincronizar
      setStats(getReadStatusStats());
    } catch (error) {
      console.error('Error sincronizando:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = async () => {
    setIsLoading(true);
    try {
      await clearReadStatusCache();
      setStats(getReadStatusStats());
    } catch (error) {
      console.error('Error limpiando caché:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Read Status Debugger</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        {stats && (
          <View style={styles.statsContainer}>
            <Text style={styles.sectionTitle}>Estadísticas del Servicio</Text>
            
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Inicializado:</Text>
              <Text style={[styles.statValue, stats.isInitialized ? styles.success : styles.error]}>
                {stats.isInitialized ? 'Sí' : 'No'}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Procesando:</Text>
              <Text style={[styles.statValue, stats.isProcessing ? styles.warning : styles.success]}>
                {stats.isProcessing ? 'Sí' : 'No'}
              </Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Cola de lotes:</Text>
              <Text style={styles.statValue}>{stats.queueLength}</Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Conversaciones en caché:</Text>
              <Text style={styles.statValue}>{stats.localReadStatusCount}</Text>
            </View>

            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total mensajes leídos:</Text>
              <Text style={styles.statValue}>{stats.totalReadMessages}</Text>
            </View>
          </View>
        )}

        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Acciones</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, isLoading && styles.disabledButton]} 
            onPress={handleSyncNow}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>
              {isLoading ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton, isLoading && styles.disabledButton]} 
            onPress={handleClearCache}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>Limpiar Caché</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>Información</Text>
          <Text style={styles.infoText}>
            • Los mensajes se marcan como leídos localmente de forma inmediata
          </Text>
          <Text style={styles.infoText}>
            • La sincronización con la base de datos se hace por lotes cada 2 segundos
          </Text>
          <Text style={styles.infoText}>
            • El estado se persiste localmente para funcionar offline
          </Text>
          <Text style={styles.infoText}>
            • Se reintenta hasta 3 veces si falla la sincronización
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    padding: 15,
  },
  statsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  success: {
    color: '#4CAF50',
  },
  warning: {
    color: '#FF9800',
  },
  error: {
    color: '#F44336',
  },
  actionsContainer: {
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoContainer: {
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    lineHeight: 16,
  },
});

export default ReadStatusDebugger;
