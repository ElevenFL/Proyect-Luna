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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Story } from '@/services/storiesService';
import { useAuth } from '@/contexts/AuthContext';
import storiesService from '@/services/storiesService';
import CommentsModal from './CommentsModal';

interface StoryPostProps {
  story: Story;
  onLike?: (storyId: string) => void;
  onComment?: (storyId: string) => void;
  onShare?: (storyId: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function StoryPost({ 
  story, 
  onLike, 
  onComment, 
  onShare 
}: StoryPostProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(story.stats.likes);
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const handleLike = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      
      if (isLiked) {
        await storiesService.unlikeStory(story.id);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await storiesService.likeStory(story.id);
        setLikesCount(prev => prev + 1);
      }
      
      setIsLiked(!isLiked);
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
                  {getInitials(story.userName)}
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
          <Ionicons 
            name={isLiked ? "star" : "star-outline"} 
            size={24} 
            color={isLiked ? "#FFD700" : "#FFFFFF"} 
          />
          {likesCount > 0 && (
            <Text style={styles.actionText}>{likesCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleComment}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
          {story.stats.comments > 0 && (
            <Text style={styles.actionText}>{story.stats.comments}</Text>
          )}
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
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
          <TouchableOpacity 
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.imageModalContent}>
            <View style={styles.imageWrapper}>
              <Image 
                source={{ uri: story.content.data }} 
                style={styles.fullScreenImage}
                resizeMode="cover"
              />
            </View>
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
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 60,
  },
  leftButton: {
    justifyContent: 'flex-start',
  },
  rightButton: {
    justifyContent: 'flex-end',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 60,
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
    paddingHorizontal: 20,
  },
  imageWrapper: {
    width: screenWidth - 20,
    height: screenWidth - 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
});
