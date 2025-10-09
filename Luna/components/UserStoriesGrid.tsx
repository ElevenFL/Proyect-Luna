import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import OptimizedImage from '@/components/OptimizedImage';
import { Story } from '@/services/storiesService';
import storiesService from '@/services/storiesService';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 50) / 2; // 2 columnas con espaciado

interface UserStoriesGridProps {
  userId: string;
}

export default function UserStoriesGrid({ userId }: UserStoriesGridProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    loadUserStories();
  }, [userId]);

  const loadUserStories = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      
      console.log('📸 Cargando historias del usuario:', userId);
      const response = await storiesService.getUserStories(userId);
      
      // Ordenar por fecha de creación (más recientes primero)
      // Incluye TODAS las historias, incluso las expiradas
      const sortedStories = response.stories.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setStories(sortedStories);
      console.log('✅ Historias cargadas:', sortedStories.length, '(incluyendo expiradas)');
    } catch (error) {
      console.error('❌ Error cargando historias del usuario:', error);
      setHasError(true);
      setStories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStoryPress = (story: Story, index: number) => {
    // Navegar a la pantalla de visualización de historias del usuario
    router.push({
      pathname: '/view-user-stories',
      params: { 
        userId: userId,
        initialIndex: index.toString()
      }
    });
  };

  const getTimeAgo = (createdAt: string): string => {
    const now = new Date();
    const storyDate = new Date(createdAt);
    const diffMs = now.getTime() - storyDate.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    
    // Si es más de 1 mes (30 días), mostrar fecha
    if (diffDays > 30) {
      const day = storyDate.getDate().toString().padStart(2, '0');
      const month = (storyDate.getMonth() + 1).toString().padStart(2, '0');
      const year = storyDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    // Menos de 1 hora
    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? '1m' : `${diffMinutes}m`;
    }
    
    // Menos de 24 horas
    if (diffHours < 24) {
      return diffHours === 1 ? '1h' : `${diffHours}h`;
    }
    
    // Menos de 7 días
    if (diffDays < 7) {
      return diffDays === 1 ? '1d' : `${diffDays}d`;
    }
    
    // Menos de 30 días (mostrar en semanas)
    return diffWeeks === 1 ? '1w' : `${diffWeeks}w`;
  };

  const renderStoryItem = ({ item, index }: { item: Story; index: number }) => {
    return (
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => handleStoryPress(item, index)}
        activeOpacity={0.7}
      >
        {item.content.type === 'image' ? (
          <OptimizedImage
            uri={item.content.data}
            style={styles.storyImage}
            cachePolicy="memory-disk"
            priority="normal"
          />
        ) : (
          <View style={styles.textStoryContainer}>
            <Text style={styles.textStoryContent} numberOfLines={3}>
              {item.content.data}
            </Text>
          </View>
        )}
        
        {/* Overlay con estadísticas y tiempo */}
        <View style={styles.storyOverlay}>
          {/* Tiempo en la esquina superior izquierda */}
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{getTimeAgo(item.createdAt)}</Text>
          </View>
          
          {/* Stats en la esquina inferior */}
          <View style={styles.statsContainer}>
            {item.stats.views > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="eye-outline" size={12} color="#FFFFFF" />
                <Text style={styles.statText}>{item.stats.views}</Text>
              </View>
            )}
            {item.stats.likes > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="heart" size={12} color="#FF6B6B" />
                <Text style={styles.statText}>{item.stats.likes}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return null;
    }

    if (hasError) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#999999" />
          <Text style={styles.emptyText}>Error al cargar historias</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserStories}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="images-outline" size={48} color="#999999" />
        <Text style={styles.emptyText}>No hay historias aún</Text>
        <Text style={styles.emptySubtext}>Las historias que publiques aparecerán aquí</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerLeft}>
        <Ionicons name="grid-outline" size={20} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Historias</Text>
        {stories.length > 0 && (
          <Text style={styles.headerCount}>({stories.length})</Text>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Cargando historias...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <FlatList
        data={stories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={renderEmpty()}
        scrollEnabled={false} // Desactivar scroll interno para que fluya con el scroll del perfil
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2f2f2f',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  headerCount: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 4,
  },
  gridContent: {
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  storyItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2f2f2f',
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  textStoryContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  textStoryContent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  storyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 4,
  },
  timeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  timeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    gap: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  statText: {
    fontSize: 10,
    color: '#FFFFFF',
    marginLeft: 2,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#999999',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999999',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});

