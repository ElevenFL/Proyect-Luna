import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { ChatMessage } from '@/services/optimizedChatService';

interface OptimizedMessagesListProps {
  messages: ChatMessage[];
  currentUserId: string;
  onMessagePress?: (message: ChatMessage) => void;
  onSwipeToReply?: (message: ChatMessage) => void;
}

/**
 * Lista optimizada de mensajes con memoización agresiva
 */
export const OptimizedMessagesList = React.memo<OptimizedMessagesListProps>(({
  messages,
  currentUserId,
  onMessagePress,
  onSwipeToReply
}) => {
  
  // Preparar datos memoizados
  const processedMessages = useMemo(() => {
    return messages.map(message => ({
      ...message,
      isMine: String(message.senderId) === String(currentUserId),
      isReply: message.content.startsWith('↳'),
      parsedContent: parseMessageContent(message.content),
      timestamp: formatTimestamp(message.createdAt)
    }));
  }, [messages, currentUserId]);

  const renderMessage = useCallback(({ item }: { item: any }) => (
    <MessageBubble
      message={item}
      onPress={onMessagePress}
      onSwipeToReply={onSwipeToReply}
    />
  ), [onMessagePress, onSwipeToReply]);

  const keyExtractor = useCallback((item: any, index: number) => 
    `${item.messageId}-${index}`, []
  );

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 60, // Altura estimada del mensaje
    offset: 60 * index,
    index,
  }), []);

  return (
    <FlatList
      data={processedMessages}
      renderItem={renderMessage}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={8}
      initialNumToRender={15}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    />
  );
});

/**
 * Componente de burbuja de mensaje memoizado
 */
const MessageBubble = React.memo<{
  message: any;
  onPress?: (message: ChatMessage) => void;
  onSwipeToReply?: (message: ChatMessage) => void;
}>(({ message, onPress, onSwipeToReply }) => {
  
  const handlePress = useCallback(() => {
    onPress?.(message);
  }, [message, onPress]);

  const handleSwipe = useCallback(() => {
    onSwipeToReply?.(message);
  }, [message, onSwipeToReply]);

  return (
    <View style={[
      styles.messageContainer,
      message.isMine ? styles.messageContainerMine : styles.messageContainerOther
    ]}>
      <View style={[
        styles.bubble,
        message.isMine ? styles.bubbleMine : styles.bubbleOther,
        message.isOptimistic && styles.bubbleOptimistic
      ]}>
        {message.isReply ? (
          <ReplyContent content={message.parsedContent} isMine={message.isMine} />
        ) : (
          <Text style={[
            styles.messageText,
            message.isMine ? styles.messageTextMine : styles.messageTextOther
          ]}>
            {message.content}
          </Text>
        )}
        
        <Text style={[
          styles.timestamp,
          message.isMine ? styles.timestampMine : styles.timestampOther
        ]}>
          {message.timestamp}
        </Text>
      </View>
    </View>
  );
});

/**
 * Componente para contenido de respuesta
 */
const ReplyContent = React.memo<{
  content: { original: string; reply: string };
  isMine: boolean;
}>(({ content, isMine }) => (
  <View>
    <View style={[
      styles.originalMessage,
      isMine ? styles.originalMessageMine : styles.originalMessageOther
    ]}>
      <Text style={[
        styles.originalMessageText,
        isMine ? styles.originalMessageTextMine : styles.originalMessageTextOther
      ]} numberOfLines={1}>
        {content.original}
      </Text>
    </View>
    <Text style={[
      styles.messageText,
      isMine ? styles.messageTextMine : styles.messageTextOther
    ]}>
      {content.reply}
    </Text>
  </View>
));

// Funciones de utilidad memoizadas
const parseMessageContent = (content: string) => {
  if (!content.startsWith('↳')) {
    return { original: '', reply: content };
  }
  
  const parts = content.split('\n\n');
  if (parts.length >= 2) {
    return {
      original: parts[0].replace('↳ ', ''),
      reply: parts.slice(1).join('\n\n')
    };
  }
  
  return { original: '', reply: content };
};

const formatTimestamp = (createdAt: string) => {
  try {
    const now = new Date();
    const messageTime = new Date(createdAt);
    const diffMs = now.getTime() - messageTime.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMinutes < 1) return 'Ahora';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    
    return messageTime.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  } catch {
    return 'Ahora';
  }
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '80%',
  },
  messageContainerMine: {
    alignSelf: 'flex-end',
  },
  messageContainerOther: {
    alignSelf: 'flex-start',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
  },
  bubbleMine: {
    backgroundColor: '#F9C80E',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#2A2A2A',
    borderBottomLeftRadius: 4,
  },
  bubbleOptimistic: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageTextMine: {
    color: '#000',
  },
  messageTextOther: {
    color: '#fff',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  timestampMine: {
    color: '#000',
    textAlign: 'right',
  },
  timestampOther: {
    color: '#999',
    textAlign: 'left',
  },
  originalMessage: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  originalMessageMine: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderLeftColor: '#000',
  },
  originalMessageOther: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderLeftColor: '#F9C80E',
  },
  originalMessageText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  originalMessageTextMine: {
    color: 'rgba(0, 0, 0, 0.7)',
  },
  originalMessageTextOther: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

OptimizedMessagesList.displayName = 'OptimizedMessagesList';
