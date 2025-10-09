import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  SafeAreaView,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import storiesService, { Story } from '@/services/storiesService';

const { width, height } = Dimensions.get('window');

export default function ViewUserStoriesScreen() {
  const { user } = useAuth();
  const { userId, initialIndex } = useLocalSearchParams<{ userId: string; initialIndex?: string }>();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(parseInt(initialIndex || '0'));
  const [isNavigating, setIsNavigating] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loadUserStories();
  }, [userId]);

  const loadUserStories = async () => {
    try {
      setIsLoading(true);
      console.log('📸 Cargando historias para visualización del usuario:', userId);
      const response = await storiesService.getUserStories(userId);
      
      // Ordenar por fecha de creación (más recientes primero)
      const sortedStories = response.stories.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setStories(sortedStories);
      console.log('✅ Historias cargadas para visualización:', sortedStories.length);
    } catch (error) {
      console.error('❌ Error cargando historias:', error);
      setStories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigation = useCallback(() => {
    if (!isNavigating) {
      setIsNavigating(true);
      
      // Detener cualquier animación en progreso
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      progressAnim.stopAnimation();
      
      router.back();
    }
  }, [isNavigating, progressAnim]);

  const nextStory = useCallback(() => {
    if (stories.length === 0 || isNavigating) return;

    // Detener cualquier animación en progreso antes de cambiar
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    progressAnim.stopAnimation();

    // Si hay más stories
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      // Fin de todos los stories
      handleNavigation();
    }
  }, [currentStoryIndex, stories.length, isNavigating, handleNavigation, progressAnim]);

  const previousStory = useCallback(() => {
    if (isNavigating) return;
    
    // Detener cualquier animación en progreso antes de cambiar
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    progressAnim.stopAnimation();
    
    // Si hay stories anteriores
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    }
  }, [currentStoryIndex, isNavigating, progressAnim]);

  useEffect(() => {
    if (isNavigating || stories.length === 0) return;
    
    if (currentStoryIndex < stories.length) {
      const currentStory = stories[currentStoryIndex];
      
      // Limpiar animación anterior si existe
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }

      // Animar progreso
      progressAnim.setValue(0);
      const animation = Animated.timing(progressAnim, {
        toValue: 1,
        duration: 5000, // 5 segundos por story
        useNativeDriver: false,
      });
      
      animationRef.current = animation;
      
      animation.start(({ finished }) => {
        if (finished && !isNavigating) {
          nextStory();
        }
      });
    }
  }, [currentStoryIndex, isNavigating, stories.length, nextStory]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      progressAnim.stopAnimation();
    };
  }, [progressAnim]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Cargando historias...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (stories.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color="#666666" />
          <Text style={styles.emptyTitle}>No hay historias</Text>
          <Text style={styles.emptySubtitle}>
            No se encontraron historias para mostrar
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleNavigation}
          >
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStory = stories[currentStoryIndex];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Story Content */}
      <View style={styles.storyContainer}>
        {currentStory.content.type === 'image' ? (
          <Image
            source={{ uri: currentStory.content.data }}
            style={styles.storyImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.textStoryContainer}>
            <Text style={styles.storyText}>{currentStory.content.data}</Text>
          </View>
        )}
      </View>

      {/* Progress Bars */}
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: index === currentStoryIndex 
                    ? progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      })
                    : index < currentStoryIndex 
                      ? '100%' 
                      : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.profileImageContainer}>
            {currentStory.userProfileImage ? (
              <Image
                source={{ uri: currentStory.userProfileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitials}>
                  {(currentStory.userName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text style={styles.userName}>{currentStory.userName || 'Usuario'}</Text>
            <Text style={styles.timeAgo}>
              {getTimeAgo(new Date(currentStory.createdAt))}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleNavigation}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Touch Areas */}
      <View style={styles.touchAreas}>
        <TouchableOpacity
          style={styles.leftTouchArea}
          onPress={previousStory}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={styles.rightTouchArea}
          onPress={nextStory}
          activeOpacity={1}
        />
      </View>
    </SafeAreaView>
  );
}

const getTimeAgo = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `hace ${diffDays}d`;
  } else if (diffHours > 0) {
    return `hace ${diffHours}h`;
  } else if (diffMinutes > 0) {
    return `hace ${diffMinutes}m`;
  } else {
    return 'ahora';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  storyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: width,
    height: height,
  },
  textStoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#FFD700',
  },
  storyText: {
    fontSize: 24,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: '600',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
    elevation: 10,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  header: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profilePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timeAgo: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  closeButton: {
    padding: 8,
    zIndex: 11,
    elevation: 11,
  },
  touchAreas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1,
    elevation: 1,
  },
  leftTouchArea: {
    flex: 1,
  },
  rightTouchArea: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});

