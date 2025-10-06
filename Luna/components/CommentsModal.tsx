import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Story, Comment } from '@/services/storiesService';
import storiesService from '@/services/storiesService';
import { useAuth } from '@/contexts/AuthContext';

interface CommentsModalProps {
  visible: boolean;
  story: Story | null;
  onClose: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

export default function CommentsModal({ visible, story, onClose }: CommentsModalProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Animated value para el desplazamiento del modal
  const translateY = useRef(new Animated.Value(screenHeight)).current;

  // Función para cerrar el modal con animación
  const handleCloseModal = () => {
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setModalVisible(false);
        setTimeout(() => {
          onClose();
        }, 100);
      }
    });
  };

  // PanResponder para el gesto de deslizamiento en todo el modal
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Solo activar si el movimiento es principalmente vertical hacia abajo
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gestureState) => {
        // Solo permitir deslizar hacia abajo (valores positivos)
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Si es un toque rápido en la barra (sin apenas movimiento), cerrar el modal
        if (Math.abs(gestureState.dy) < 5 && Math.abs(gestureState.dx) < 5) {
          handleCloseModal();
        }
        // Si desliza hacia abajo más de 150 píxeles, cerrar el modal
        else if (gestureState.dy > 150) {
          handleCloseModal();
        } else {
          // Regresar a la posición original
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      // Animar la entrada del modal desde abajo
      translateY.setValue(screenHeight);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && story) {
      loadComments();
    }
  }, [visible, story]);

  const loadComments = async () => {
    if (!story) return;

    try {
      setIsLoadingComments(true);
      const response = await storiesService.getComments(story.id);
      setComments(response.comments);
    } catch (error) {
      console.error('Error cargando comentarios:', error);
      Alert.alert('Error', 'No se pudieron cargar los comentarios');
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!story || !newComment.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const response = await storiesService.addComment(story.id, newComment.trim());
      
      // Agregar el nuevo comentario a la lista
      setComments(prev => [...prev, response.comment]);
      setNewComment('');
      
      // Mostrar mensaje de éxito
      Alert.alert('Éxito', 'Comentario agregado');
    } catch (error) {
      console.error('Error agregando comentario:', error);
      Alert.alert('Error', 'No se pudo agregar el comentario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!story) return;

    Alert.alert(
      'Eliminar comentario',
      '¿Estás seguro de que quieres eliminar este comentario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await storiesService.removeComment(story.id, commentId);
              setComments(prev => prev.filter(comment => comment.id !== commentId));
              Alert.alert('Éxito', 'Comentario eliminado');
            } catch (error) {
              console.error('Error eliminando comentario:', error);
              Alert.alert('Error', 'No se pudo eliminar el comentario');
            }
          }
        }
      ]
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const commentDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - commentDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return commentDate.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const canDelete = user?.id === item.userId || user?.id === story?.userId;
    
    return (
      <View style={styles.commentItem}>
        <View style={styles.commentHeader}>
          <View style={styles.commentUserInfo}>
            <View style={styles.commentProfileImageContainer}>
              {item.userProfileImage ? (
                <Image 
                  source={{ uri: item.userProfileImage }} 
                  style={styles.commentProfileImage}
                />
              ) : (
                <View style={[styles.commentProfileImage, styles.commentProfileImagePlaceholder]}>
                  <Text style={styles.commentProfileImageText}>
                    {getInitials(item.userName)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.commentUserDetails}>
              <View style={styles.commentNameAndTimeRow}>
                <Text style={styles.commentUserName}>{item.userName}</Text>
                <Text style={styles.commentTime}>{formatTimeAgo(item.timestamp)}</Text>
              </View>
              <Text style={styles.commentContent}>{item.content}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubble-outline" size={48} color="#666666" />
      <Text style={styles.emptyStateText}>No hay comentarios aún</Text>
      <Text style={styles.emptyStateSubtext}>Sé el primero en comentar</Text>
    </View>
  );

  if (!story) return null;

  return (
    <Modal
      visible={modalVisible}
      animationType="none"
      onRequestClose={onClose}
      transparent={true}
    >
      <Animated.View 
        style={[
          styles.modalOverlay,
          {
            transform: [{ translateY }]
          }
        ]}
      >
         <View style={styles.container} {...panResponder.panHandlers}>
         {/* Barra de deslizamiento */}
         <View style={styles.dragIndicatorContainer}>
           <View style={styles.dragIndicator} />
         </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comentarios</Text>
        </View>

        {/* Story Preview */}
        <View style={styles.storyPreview}>
          <View style={styles.storyUserInfo}>
            <View style={styles.storyProfileImageContainer}>
              {story.userProfileImage ? (
                <Image 
                  source={{ uri: story.userProfileImage }} 
                  style={styles.storyProfileImage}
                />
              ) : (
                <View style={[styles.storyProfileImage, styles.storyProfileImagePlaceholder]}>
                  <Text style={styles.storyProfileImageText}>
                    {getInitials(story.userName)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.storyUserDetails}>
              <View style={styles.storyNameAndTimeRow}>
                <Text style={styles.storyUserName}>{story.userName}</Text>
                <Text style={styles.storyTime}>
                  {formatTimeAgo(story.createdAt)}
                </Text>
              </View>
              {story.content.type === 'image' && story.content.description && (
                <Text style={styles.storyDescription}>{story.content.description}</Text>
              )}
            </View>
          </View>
          {story.content.type === 'text' && (
            <Text style={styles.storyContent} numberOfLines={2}>
              {story.content.data}
            </Text>
          )}
        </View>

        {/* Comments List */}
        <View style={styles.commentsContainer}>
          {isLoadingComments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.loadingText}>Cargando comentarios...</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={comments.length === 0 ? styles.emptyListContainer : undefined}
            />
          )}
        </View>

        {/* Comment Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Escribe un comentario..."
              placeholderTextColor="#666666"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
              editable={!isSubmitting}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!newComment.trim() || isSubmitting) && styles.sendButtonDisabled
              ]}
              onPress={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Ionicons name="send" size={20} color="#000000" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.characterCount}>
            {newComment.length}/500
          </Text>
        </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  dragIndicatorContainer: {
    width: '100%',
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  storyPreview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  storyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  storyProfileImageContainer: {
    marginRight: 12,
  },
  storyProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  storyProfileImagePlaceholder: {
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyProfileImageText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  storyUserDetails: {
    flex: 1,
    marginRight: 8,
  },
  storyNameAndTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  storyUserName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  storyTime: {
    color: '#CCCCCC',
    fontSize: 12,
    marginLeft: 8,
  },
  storyDescription: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  storyContent: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: '#CCCCCC',
    fontSize: 14,
    marginTop: 4,
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentProfileImageContainer: {
    marginRight: 12,
  },
  commentProfileImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  commentProfileImagePlaceholder: {
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentProfileImageText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  commentUserDetails: {
    flex: 1,
  },
  commentNameAndTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  commentTime: {
    color: '#CCCCCC',
    fontSize: 12,
    marginLeft: 8,
  },
  commentContent: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    backgroundColor: '#FFD700',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#666666',
  },
  characterCount: {
    color: '#CCCCCC',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
});
