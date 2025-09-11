import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '@/services/optimizedChatService';

interface InAppNotificationProps {
  id: string;
  message: ChatMessage;
  senderName?: string;
  timestamp: number;
  onPress?: () => void;
  onDismiss: (id: string) => void;
}

export function InAppNotification({ 
  id, 
  message, 
  senderName, 
  timestamp, 
  onPress, 
  onDismiss 
}: InAppNotificationProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animar entrada
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss después de 5 segundos
    const timeoutId = setTimeout(() => {
      handleDismiss();
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(id);
    });
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
      handleDismiss();
    }
  };

  const getDisplayContent = () => {
    if (message.content.length > 80) {
      return `${message.content.substring(0, 80)}...`;
    }
    return message.content;
  };

  const getTimeAgo = () => {
    const now = Date.now();
    const diffSeconds = Math.floor((now - timestamp) / 1000);
    
    if (diffSeconds < 60) {
      return 'Ahora';
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `Hace ${minutes}m`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `Hace ${hours}h`;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.notification}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.content}>
          {/* Icono */}
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubble" size={20} color="#F9C80E" />
          </View>

          {/* Contenido del mensaje */}
          <View style={styles.messageContent}>
            <View style={styles.header}>
              <Text style={styles.senderName} numberOfLines={1}>
                {senderName || 'Mensaje nuevo'}
              </Text>
              <Text style={styles.timestamp}>
                {getTimeAgo()}
              </Text>
            </View>
            <Text style={styles.messageText} numberOfLines={2}>
              {getDisplayContent()}
            </Text>
          </View>

          {/* Botón de cerrar */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color="#999999" />
          </TouchableOpacity>
        </View>

        {/* Indicador de progreso */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: slideAnim.interpolate({
                  inputRange: [-100, 0],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  notification: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(249, 200, 14, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
    marginRight: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
  messageText: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  progressContainer: {
    height: 2,
    backgroundColor: '#2A2A2A',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#F9C80E',
  },
});

export default InAppNotification;
