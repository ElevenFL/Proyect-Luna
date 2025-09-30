import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import StoryRing from './StoryRing';
import { useStories } from '@/contexts/StoriesContext';

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
  const [userStories, setUserStories] = useState<any[]>([]);
  
  // Actualizar historias del usuario cuando cambien las historias globales
  useEffect(() => {
    if (!isLoading && stories.length >= 0) {
      const userStories = getStoriesByUser(user.id);
      setUserStories(userStories);
      if (userStories.length > 0) {
        console.log(`🔄 UserCard: Actualizando historias para ${user.name}: ${userStories.length} stories`);
      }
    }
  }, [stories, isLoading, user.id, getStoriesByUser]);
  
  const hasActiveStories = userStories.length > 0;
  const hasUnviewedStories = userStories.some(story => !story.isViewed);

  // Debug logs (reducidos)
  if (userStories.length > 0) {
    console.log(`✅ UserCard: Usuario ${user.name} tiene ${userStories.length} stories - StoryRing debería aparecer`);
  }

  const getGenderIcon = () => {
    switch (user.gender) {
      case 'male':
        return '♂';
      case 'female':
        return '♀';
      default:
        return '⚧';
    }
  };

  const getGenderColor = () => {
    switch (user.gender) {
      case 'male':
        return '#4A90E2';
      case 'female':
        return '#E24A90';
      default:
        return '#FFD700';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTimeAgo = (dateString: string) => {
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
  };

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
              <View style={[styles.infoBadge, { backgroundColor: getGenderColor() }]}>
                <Text style={styles.infoBadgeText}>
                  {getGenderIcon()}
                </Text>
              </View>
            )}
            
            {/* Edad */}
            {user.age && (
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeText}>
                  {user.age}
                </Text>
              </View>
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
            <Text style={[styles.statusText, { color: user.isOnline ? '#4CAF50' : '#ADB5BD' }]}>
              {user.isOnline ? 'Online' : (user.lastConnection ? getTimeAgo(user.lastConnection) : 'Offline')}
            </Text>
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
