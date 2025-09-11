import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { socketService } from '../services/socketService';
import { useAuth } from '../contexts/AuthContext';
import { smartLog } from '../config/logging';

interface WebSocketStatusProps {
  showDetails?: boolean;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ showDetails = false }) => {
  const { user, token } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState(socketService.getConnectionStatus());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listener para cambios en el estado de conexión
    const handleConnectionChange = (isConnected: boolean) => {
      setConnectionStatus(socketService.getConnectionStatus());
      smartLog.info('WebSocketStatus: Estado de conexión actualizado:', isConnected);
    };

    socketService.addConnectionStateListener(handleConnectionChange);

    // Actualizar estado inicial
    setConnectionStatus(socketService.getConnectionStatus());

    return () => {
      socketService.removeConnectionStateListener(handleConnectionChange);
    };
  }, []);

  // Actualizar estado cuando cambie la autenticación
  useEffect(() => {
    setConnectionStatus(socketService.getConnectionStatus());
  }, [user, token]);

  const handleForceConnect = async () => {
    if (user?.id) {
      try {
        smartLog.info('WebSocketStatus: Estado antes de conectar:', socketService.getDetailedStatus());
        await socketService.connect(user.id);
        setConnectionStatus(socketService.getConnectionStatus());
        smartLog.info('WebSocketStatus: Estado después de conectar:', socketService.getDetailedStatus());
      } catch (error) {
        smartLog.error('WebSocketStatus: Error forzando conexión:', error);
        smartLog.error('WebSocketStatus: Estado después del error:', socketService.getDetailedStatus());
      }
    }
  };

  const handleForceDisconnect = async () => {
    try {
      socketService.disconnect();
      setConnectionStatus(socketService.getConnectionStatus());
    } catch (error) {
      smartLog.error('WebSocketStatus: Error forzando desconexión:', error);
    }
  };

  const getStatusColor = () => {
    if (connectionStatus.isConnected) return '#4CAF50'; // Verde
    if (connectionStatus.userId) return '#FF9800'; // Naranja (conectando)
    return '#F44336'; // Rojo (desconectado)
  };

  const getStatusText = () => {
    if (connectionStatus.isConnected) return 'Conectado';
    if (connectionStatus.userId) return 'Conectando...';
    return 'Desconectado';
  };

  if (!isVisible && !showDetails) {
    return (
      <TouchableOpacity 
        style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}
        onPress={() => setIsVisible(true)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {!showDetails && (
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setIsVisible(false)}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.detailText}>
            Usuario: {connectionStatus.userId || 'No autenticado'}
          </Text>
          <Text style={styles.detailText}>
            Socket ID: {connectionStatus.socketId || 'N/A'}
          </Text>
          <Text style={styles.detailText}>
            Autenticado: {user && token ? 'Sí' : 'No'}
          </Text>
          <Text style={styles.detailText}>
            Listo para chat: {socketService.isReadyForChat() ? 'Sí' : 'No'}
          </Text>
          <Text style={styles.detailText}>
            Conversaciones: {socketService.getJoinedConversations().length}
          </Text>
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={() => {
              const detailedStatus = socketService.getDetailedStatus();
              console.log('🔍 WebSocketStatus: Estado detallado:', detailedStatus);
              smartLog.info('WebSocketStatus: Estado detallado:', detailedStatus);
            }}
          >
            <Text style={styles.debugButtonText}>Ver Estado Detallado</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.debugButton, { backgroundColor: '#FF9800' }]}
            onPress={() => {
              socketService.resetConnectionLock();
              setConnectionStatus(socketService.getConnectionStatus());
              smartLog.info('WebSocketStatus: ConnectionLock reseteado');
            }}
          >
            <Text style={styles.debugButtonText}>Reset ConnectionLock</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.debugButton, { backgroundColor: '#9C27B0' }]}
            onPress={() => {
              socketService.resetCircuitBreaker();
              setConnectionStatus(socketService.getConnectionStatus());
              smartLog.info('WebSocketStatus: CircuitBreaker reseteado');
            }}
          >
            <Text style={styles.debugButtonText}>Reset CircuitBreaker</Text>
          </TouchableOpacity>
        </View>
      )}

      {user && token && (
        <View style={styles.actions}>
          {!connectionStatus.isConnected ? (
            <TouchableOpacity style={styles.connectButton} onPress={handleForceConnect}>
              <Text style={styles.buttonText}>Conectar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.disconnectButton} onPress={handleForceDisconnect}>
              <Text style={styles.buttonText}>Desconectar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    margin: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    margin: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  closeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  details: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default WebSocketStatus;
