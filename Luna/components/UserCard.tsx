import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import StoryRing from './StoryRing';
import { useStories } from '@/contexts/StoriesContext';
import { usePrefetch, UserWithPrefetch } from '@/contexts/PrefetchContext';

export interface User {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  profileImage?: string;
  country: string;
  countryFlag: string;
  isOnline: boolean;
  description: string;
  lastSeen?: string;
  lastConnection?: string;
  connectionPriority?: number; // Para ordenamiento: mayor = más reciente
}

interface UserCardProps {
  user: User;
  onPress?: (user: User) => void;
  onStoryPress?: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onPress, onStoryPress }) => {
  const { getStoriesByUser, isLoading, stories } = useStories();
  const { getPrefetchedUser } = usePrefetch();
  const [userStories, setUserStories] = useState<any[]>([]);
  
  // Intentar obtener datos prefetchados primero
  const prefetchedUser = useMemo(() => getPrefetchedUser(user.id), [user.id, getPrefetchedUser]);
  
  // Determinar si usar datos prefetchados o del contexto de stories
  const hasActiveStories = useMemo(() => {
    if (prefetchedUser?.prefetchData?.stories) {
      return prefetchedUser.prefetchData.stories.hasActiveStories;
    }
    return userStories.length > 0;
  }, [prefetchedUser?.prefetchData?.stories?.hasActiveStories, userStories.length]);
  
  const hasUnviewedStories = useMemo(() => {
    if (prefetchedUser?.prefetchData?.stories) {
      return prefetchedUser.prefetchData.stories.hasUnviewedStories;
    }
    return userStories.some(story => !story.isViewed);
  }, [prefetchedUser?.prefetchData?.stories?.hasUnviewedStories, userStories]);
  
  // Actualizar historias del usuario cuando cambien las historias globales (fallback)
  useEffect(() => {
    // Solo hacer la búsqueda costosa si no hay datos prefetchados
    if (!prefetchedUser?.prefetchData?.stories && !isLoading && stories.length >= 0) {
      const userStories = getStoriesByUser(user.id);
      setUserStories(userStories);
      if (userStories.length > 0) {
        console.log(`🔄 UserCard: Actualizando historias para ${user.name}: ${userStories.length} stories`);
      }
    }
  }, [stories, isLoading, user.id, getStoriesByUser, prefetchedUser]);

  // Debug logs (reducidos) - solo cuando realmente cambie hasActiveStories
  useEffect(() => {
    if (hasActiveStories) {
      const source = prefetchedUser?.prefetchData?.stories ? 'prefetch' : 'context';
      const count = prefetchedUser?.prefetchData?.stories?.storiesCount || userStories.length;
      console.log(`✅ UserCard: Usuario ${user.name} tiene ${count} stories (${source}) - StoryRing debería aparecer`);
    }
  }, [hasActiveStories]);

  const getGenderIcon = useCallback(() => {
    switch (user.gender) {
      case 'male':
        return 'male';
      case 'female':
        return 'female';
      default:
        return 'male-female';
    }
  }, [user.gender]);

  const getGenderIconColor = useCallback(() => {
    switch (user.gender) {
      case 'male':
        return '#4A90E2'; // Azul
      case 'female':
        return '#E24A90'; // Rosa
      default:
        return '#FFFFFF'; // Blanco
    }
  }, [user.gender]);

  const getInitials = useCallback((name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const getTimeAgo = useCallback((dateString: string) => {
    const now = new Date();
    const lastSeen = new Date(dateString);
    const diffMs = now.getTime() - lastSeen.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? 'Hace 1 min' : `Hace ${diffMinutes} min`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? 'Hace 1 hora' : `Hace ${diffHours} horas`;
    } else {
      return diffDays === 1 ? 'Hace 1 día' : `Hace ${diffDays} días`;
    }
  }, []);

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={() => onPress?.(user)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Profile Picture with Story Ring */}
        <View style={styles.profileContainer}>
          <TouchableOpacity
            onPress={() => {
              if (hasActiveStories && onStoryPress) {
                onStoryPress(user);
              } else if (onPress) {
                onPress(user);
              }
            }}
            activeOpacity={0.7}
          >
            <StoryRing
              size={56}
              hasStory={hasActiveStories}
              isViewed={!hasUnviewedStories}
            >
              {user.profileImage ? (
                <OptimizedImage 
                  uri={user.profileImage} 
                  style={styles.profileImage}
                  cachePolicy="memory-disk"
                  priority="normal"
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.initialsText}>
                    {getInitials(user.name)}
                  </Text>
                </View>
              )}
            </StoryRing>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user.name}</Text>
          </View>
          
          {/* Info Badges */}
          <View style={styles.visualInfoContainer}>
            {/* Género */}
            {user.gender && (
              <Ionicons 
                name={getGenderIcon() as any} 
                size={14} 
                color={getGenderIconColor()}
                style={{ marginRight: 8 }}
              />
            )}
            
            {/* Edad */}
            {user.age && (
              <Text style={styles.ageText}>
                {user.age}
              </Text>
            )}
            
            {/* País */}
            {(user.countryFlag || user.country) && (
              <Text style={styles.countryFlagText}>
                {user.countryFlag || '🌍'}
              </Text>
            )}
          </View>
          
          <Text style={styles.description} numberOfLines={2}>
            {user.description}
          </Text>
        </View>

        {/* Online Status */}
        <View style={styles.statusContainer}>
          <View style={styles.statusTextContainer}>
            {user.isOnline ? (
              <Ionicons name="ellipse" size={16} color="#4CAF50" />
            ) : (
              <Text style={styles.statusText}>
                {user.lastConnection ? getTimeAgo(user.lastConnection) : 'Offline'}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  visualInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  infoBadge: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    width: 28,
    height: 20,
    marginRight: 5,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  countryFlagText: {
    fontSize: 14,
    marginRight: 8,
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: '#CCCCCC',
    lineHeight: 16,
  },
  statusContainer: {
    alignItems: 'flex-end',
    marginTop: 2,
    minWidth: 80,
    alignSelf: 'flex-start',
  },
  statusTextContainer: {
    alignItems: 'flex-end',
    minWidth: 60,
  },
  statusText: {
    fontSize: 12,
    color: '#ADB5BD',
    fontWeight: '500',
  },
});

export default UserCard;
