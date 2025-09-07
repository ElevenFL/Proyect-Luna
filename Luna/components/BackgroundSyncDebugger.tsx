import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '@/services/chatService';
import { useConversations } from '@/contexts/ConversationContext';

interface BackgroundSyncDebuggerProps {
  visible?: boolean;
  onClose?: () => void;
}

/**
 * Componente de debugging para mostrar el estado de la sincronización en segundo plano
 * Solo se muestra en desarrollo
 */
export const BackgroundSyncDebugger: React.FC<BackgroundSyncDebuggerProps> = ({ 
  visible = false, 
  onClose 
}) => {
  const [syncStatus, setSyncStatus] = useState<any>({});
  const [syncStats, setSyncStats] = useState<any>({});
  const [cacheInfo, setCacheInfo] = useState<any>({});
  const { conversations } = useConversations();

  useEffect(() => {
    if (visible) {
      refreshData();
      const interval = setInterval(refreshData, 2000); // Actualizar cada 2 segundos
      return () => clearInterval(interval);
    }
  }, [visible]);

  const refreshData = async () => {
    try {
      const [status, stats, cache] = await Promise.all([
        chatService.getBackgroundSyncStatus(),
        chatService.getBackgroundSyncStats(),
        chatService.getCacheInfo()
      ]);
      
      setSyncStatus(status);
      setSyncStats(stats);
      setCacheInfo(cache);
    } catch (error) {
      console.error('Error obteniendo datos de debugging:', error);
    }
  };

  const clearAllCache = async () => {
    try {
      await chatService.clearAllCache();
      await refreshData();
      console.log('✅ Caché limpiado');
    } catch (error) {
      console.error('Error limpiando caché:', error);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔄 Debug Sincronización</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Estadísticas Generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Estadísticas</Text>
          <Text style={styles.text}>Total conversaciones: {syncStats.totalConversations || 0}</Text>
          <Text style={styles.text}>Conversaciones activas: {syncStats.activeConversations || 0}</Text>
          <Text style={styles.text}>Servicio corriendo: {syncStats.isRunning ? '✅' : '❌'}</Text>
          <Text style={styles.text}>Estado de app: {syncStats.appState || 'unknown'}</Text>
        </View>

        {/* Estado de Sincronización */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Estado de Sincronización</Text>
          {Object.keys(syncStatus).length === 0 ? (
            <Text style={styles.text}>No hay conversaciones para sincronizar</Text>
          ) : (
            Object.entries(syncStatus).map(([conversationId, status]: [string, any]) => (
              <View key={conversationId} style={styles.conversationItem}>
                <Text style={styles.conversationId}>{conversationId.slice(0, 8)}...</Text>
                <Text style={styles.text}>
                  Última sync: {new Date(status.lastSync).toLocaleTimeString()}
                </Text>
                <Text style={styles.text}>
                  Activa: {status.isActive ? '✅' : '❌'}
                </Text>
                <Text style={styles.text}>
                  Necesita sync: {status.needsSync ? '🔄' : '✅'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Información del Caché */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Información del Caché</Text>
          {Object.keys(cacheInfo).length === 0 ? (
            <Text style={styles.text}>No hay datos en caché</Text>
          ) : (
            Object.entries(cacheInfo).map(([conversationId, info]: [string, any]) => (
              <View key={conversationId} style={styles.conversationItem}>
                <Text style={styles.conversationId}>{conversationId.slice(0, 8)}...</Text>
                <Text style={styles.text}>Mensajes: {info.messageCount}</Text>
                <Text style={styles.text}>
                  Última actualización: {new Date(info.lastUpdated).toLocaleTimeString()}
                </Text>
                <Text style={styles.text}>
                  Válido: {info.isValid ? '✅' : '❌'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Conversaciones del Contexto */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 Conversaciones del Contexto</Text>
          <Text style={styles.text}>Total: {conversations.length}</Text>
          {conversations.slice(0, 5).map((conv, index) => (
            <View key={conv.conversationId} style={styles.conversationItem}>
              <Text style={styles.conversationId}>
                {conv.conversationId.slice(0, 8)}...
              </Text>
              <Text style={styles.text}>
                Último mensaje: {conv.lastMessagePreview || 'N/A'}
              </Text>
            </View>
          ))}
        </View>

        {/* Acciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Acciones</Text>
          <TouchableOpacity onPress={refreshData} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>🔄 Refrescar Datos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAllCache} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>🗑️ Limpiar Caché</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  sectionTitle: {
    color: '#F9C80E',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  conversationItem: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
  },
  conversationId: {
    color: '#F9C80E',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#F9C80E',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default BackgroundSyncDebugger;

