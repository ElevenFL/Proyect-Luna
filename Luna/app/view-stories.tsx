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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStories } from '@/contexts/StoriesContext';
import { useAuth } from '@/contexts/AuthContext';

const { width, height } = Dimensions.get('window');

export default function ViewStoriesScreen() {
  const { stories, markStoryAsViewed } = useStories();
  const { user } = useAuth();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isUnmounting, setIsUnmounting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Filtrar stories de amigos (excluyendo los del usuario actual)
  const friendsStories = stories.filter(story => story.userId !== user?.id);
  
  // Agrupar stories por usuario
  const storiesByUser = friendsStories.reduce((acc, story) => {
    if (!acc[story.userId]) {
      acc[story.userId] = [];
    }
    acc[story.userId].push(story);
    return acc;
  }, {} as Record<string, typeof stories>);

  const usersWithStories = Object.keys(storiesByUser);

  const handleNavigation = useCallback(() => {
    if (!isNavigating && !isUnmounting) {
      setIsNavigating(true);
      setIsUnmounting(true);
      
      // Detener cualquier animación en progreso
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      progressAnim.stopAnimation();
      
      // Navegar según el parámetro 'from' o intentar back
      try {
        if (from === 'messages') {
          // Si viene de mensajes, regresar a mensajes
          router.replace('/(tabs)/messages');
        } else if (from === 'home') {
          // Si viene del home, regresar al home
          router.replace('/(tabs)');
        } else {
          // Si no hay parámetro, intentar navegación hacia atrás
          if (router.canGoBack()) {
            router.back();
          } else {
            // Fallback al home
            router.replace('/(tabs)');
          }
        }
      } catch (error) {
        // En caso de error, ir al home como fallback
        console.log('Error en navegación, yendo al home:', error);
        router.replace('/(tabs)');
      }
    }
  }, [isNavigating, isUnmounting, progressAnim, from]);

  const nextStory = useCallback(() => {
    if (usersWithStories.length === 0 || isNavigating || isUnmounting || isTransitioning) return;

    setIsTransitioning(true);

    // Detener cualquier animación en progreso antes de cambiar
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    progressAnim.stopAnimation();

    const currentUserStories = storiesByUser[usersWithStories[currentUserIndex]];
    
    if (currentStoryIndex < currentUserStories.length - 1) {
      if (!isUnmounting) {
        setCurrentStoryIndex(currentStoryIndex + 1);
      }
    } else if (currentUserIndex < usersWithStories.length - 1) {
      if (!isUnmounting) {
        setCurrentUserIndex(currentUserIndex + 1);
        setCurrentStoryIndex(0);
      }
    } else {
      // Fin de todos los stories
      handleNavigation();
    }

    // Resetear el estado de transición después de un breve delay
    setTimeout(() => {
      setIsTransitioning(false);
    }, 100);
  }, [currentStoryIndex, currentUserIndex, usersWithStories, storiesByUser, isNavigating, isUnmounting, isTransitioning, handleNavigation, progressAnim]);

  useEffect(() => {
    if (isNavigating || isUnmounting || isTransitioning) return; // Evitar actualizaciones durante navegación, desmontaje o transición
    
    if (usersWithStories.length > 0 && currentUserIndex < usersWithStories.length) {
      const currentUserStories = storiesByUser[usersWithStories[currentUserIndex]];
      if (currentStoryIndex < currentUserStories.length) {
        const currentStory = currentUserStories[currentStoryIndex];
        
        // Marcar como visto
        if (!currentStory.isViewed && !isUnmounting) {
          markStoryAsViewed(currentStory.id);
        }

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
        
        animation.start(() => {
          if (!isNavigating && !isUnmounting && !isTransitioning) {
            nextStory();
          }
        });
      }
    }
  }, [currentUserIndex, currentStoryIndex, isNavigating, isUnmounting, isTransitioning, usersWithStories, storiesByUser, markStoryAsViewed, progressAnim, nextStory]);

  // Cleanup effect para evitar warnings
  useEffect(() => {
    return () => {
      setIsUnmounting(true);
      // Limpiar animaciones cuando el componente se desmonte
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      progressAnim.stopAnimation();
    };
  }, [progressAnim]);

  const previousStory = useCallback(() => {
    if (isNavigating || isUnmounting || isTransitioning) return;
    
    setIsTransitioning(true);
    
    // Detener cualquier animación en progreso antes de cambiar
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    progressAnim.stopAnimation();
    
    if (currentStoryIndex > 0) {
      if (!isUnmounting) {
        setCurrentStoryIndex(currentStoryIndex - 1);
      }
    } else if (currentUserIndex > 0) {
      if (!isUnmounting) {
        setCurrentUserIndex(currentUserIndex - 1);
        const previousUserStories = storiesByUser[usersWithStories[currentUserIndex - 1]];
        setCurrentStoryIndex(previousUserStories.length - 1);
      }
    }

    // Resetear el estado de transición después de un breve delay
    setTimeout(() => {
      setIsTransitioning(false);
    }, 100);
  }, [currentStoryIndex, currentUserIndex, usersWithStories, storiesByUser, isNavigating, isUnmounting, isTransitioning, progressAnim]);

  if (usersWithStories.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.emptyContainer}>
          <Ionicons name="camera-outline" size={64} color="#666666" />
          <Text style={styles.emptyTitle}>No hay stories</Text>
          <Text style={styles.emptySubtitle}>
            Tus amigos aún no han publicado stories
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

  const currentUserStories = storiesByUser[usersWithStories[currentUserIndex]];
  const currentStory = currentUserStories[currentStoryIndex];

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
        {currentUserStories.map((_, index) => (
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
                  {currentStory.userName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View>
            <Text style={styles.userName}>{currentStory.userName}</Text>
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

  if (diffHours > 0) {
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
    backgroundColor: '#1a1a1a',
  },
  storyText: {
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: '500',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
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
    backgroundColor: '#F9C80E',
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
  },
  touchAreas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
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
    backgroundColor: '#F9C80E',
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

