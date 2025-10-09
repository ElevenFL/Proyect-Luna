import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Story } from '@/services/storiesService';
import { useAuth } from '@/contexts/AuthContext';
import { useStories } from '@/contexts/StoriesContext';
import CommentsModal from './CommentsModal';

interface StoryPostProps {
  story: Story;
  onLike?: (storyId: string) => void;
  onComment?: (storyId: string) => void;
  onShare?: (storyId: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function StoryPost({ 
  story, 
  onLike, 
  onComment, 
  onShare 
}: StoryPostProps) {
  const { user } = useAuth();
  const { toggleLike, isLikedByUser } = useStories();
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Verificar si el usuario actual ha dado like a este story
  const isLiked = isLikedByUser(story.id);

  const handleLike = async () => {
    if (isLoading || !user?.id) return;
    
    try {
      setIsLoading(true);
      await toggleLike(story.id);
      onLike?.(story.id);
    } catch (error) {
      console.error('Error al dar like:', error);
      Alert.alert('Error', 'No se pudo procesar el like');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComment = () => {
    setShowCommentsModal(true);
    onComment?.(story.id);
  };

  const handleShare = () => {
    onShare?.(story.id);
  };

  const handleImagePress = () => {
    if (story.content.type === 'image') {
      setShowImageModal(true);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const storyDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - storyDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return storyDate.toLocaleDateString('es-ES', { 
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

  return (
    <View style={styles.container}>
      {/* Header con información del usuario */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.profileImageContainer}>
            {story.userProfileImage ? (
              <Image 
                source={{ uri: story.userProfileImage }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                <Text style={styles.profileImageText}>
                  {getInitials(story.userName || 'Usuario')}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <View style={styles.nameAndTimeRow}>
              <Text style={styles.userName}>{story.userName}</Text>
              <Text style={styles.timeAgo}>
                {formatTimeAgo(story.createdAt)}
              </Text>
            </View>
            {story.content.type === 'image' && story.content.description && (
              <Text style={styles.descriptionText}>{story.content.description}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Contenido de la historia */}
      <View style={styles.content}>
        {story.content.type === 'image' ? (
          <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
            <Image 
              source={{ uri: story.content.data }} 
              style={styles.storyImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.textContent}>
            <Text style={styles.storyText}>{story.content.data}</Text>
          </View>
        )}
      </View>

      {/* Acciones */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.leftButton]} 
          onPress={handleLike}
          disabled={isLoading}
        >
          <View style={styles.likeContainer}>
            <Ionicons 
              name={isLiked ? "star" : "star-outline"} 
              size={24} 
              color={isLiked ? "#FFD700" : "#FFFFFF"} 
            />
            {story.stats.likes > 0 && (
              <Text style={styles.actionText}>{story.stats.likes}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleComment}
        >
          <View style={styles.likeContainer}>
            <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
            {story.stats.comments > 0 && (
              <Text style={styles.actionText}>{story.stats.comments}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.rightButton]} 
          onPress={handleShare}
        >
          <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Modal de Comentarios */}
      <CommentsModal
        visible={showCommentsModal}
        story={story}
        onClose={() => setShowCommentsModal(false)}
      />

      {/* Modal de Imagen Completa */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowImageModal(false)}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.imageModalContent}>
            <Image 
              source={{ uri: story.content.data }} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImageContainer: {
    marginRight: 12,
    marginLeft: -5,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  profileImagePlaceholder: {
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userDetails: {
    flex: 1,
  },
  nameAndTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timeAgo: {
    color: '#CCCCCC',
    fontSize: 12,
    marginLeft: 8,
  },
  descriptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
    marginTop: 4,
  },
  content: {
    width: '100%',
    backgroundColor: '#1a1a1a',
  },
  storyImage: {
    width: '100%',
    height: screenWidth * 0.8, // Aspecto cuadrado
    borderRadius: 16,
  },
  textContent: {
    padding: 20,
    backgroundColor: '#2a2a2a',
    minHeight: 100,
    justifyContent: 'center',
    borderRadius: 16,
  },
  storyText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 50,
  },
  leftButton: {
    justifyContent: 'flex-start',
  },
  rightButton: {
    justifyContent: 'flex-end',
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60, // Ancho fijo para mantener el ícono en posición fija
    justifyContent: 'flex-start',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  imageModalContainer: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 'rgba(0, 0, 0, 0.90)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
