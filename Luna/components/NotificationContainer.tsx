import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNotifications } from '@/hooks/useNotifications';
import InAppNotification from './InAppNotification';
import { router } from 'expo-router';

interface NotificationContainerProps {
  currentConversationId?: string;
}

export function NotificationContainer({ currentConversationId }: NotificationContainerProps) {
  const { inAppNotifications, removeInAppNotification } = useNotifications();

  const handleNotificationPress = (conversationId?: string, senderId?: string) => {
    if (conversationId && senderId) {
      // Navegar al chat si no estamos ya en esa conversación
      if (conversationId !== currentConversationId) {
        router.push({
          pathname: '/chat/[userId]',
          params: {
            userId: senderId,
            // Aquí podrías pasar más parámetros si los tienes disponibles
          }
        });
      }
    }
  };

  // Filtrar notificaciones de la conversación actual
  const filteredNotifications = inAppNotifications.filter(notification => 
    notification.message.conversationId !== currentConversationId
  );

  if (filteredNotifications.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {filteredNotifications.map((notification, index) => (
        <View
          key={notification.id}
          style={[
            styles.notificationWrapper,
            { top: index * 80 } // Espaciar notificaciones verticalmente
          ]}
        >
          <InAppNotification
            id={notification.id}
            message={notification.message}
            senderName={notification.message.senderId} // Usar senderId como fallback
            timestamp={notification.timestamp}
            onPress={() => handleNotificationPress(
              notification.message.conversationId,
              notification.message.senderId
            )}
            onDismiss={removeInAppNotification}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },
  notificationWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});

export default NotificationContainer;
