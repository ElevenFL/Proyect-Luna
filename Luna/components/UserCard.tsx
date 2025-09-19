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
          
          {/* Online Status Indicator */}
          <View style={[
            styles.statusIndicator,
            { backgroundColor: user.isOnline ? '#4CAF50' : '#666666' }
          ]} />
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user.name}</Text>
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
                <View style={styles.countryBadge}>
                  <Text style={styles.countryFlagText}>
                    {user.countryFlag || '🌍'}
                  </Text>
                </View>
              )}
            </View>
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
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  profilePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 38,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  visualInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    justifyContent: 'flex-end',
  },
  infoBadge: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countryBadge: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#333333',
  },
  countryFlagText: {
    fontSize: 14,
  },
  description: {
    fontSize: 12,
    color: '#CCCCCC',
    lineHeight: 16,
  },
  statusContainer: {
    alignItems: 'flex-end',
    marginTop: -20,
    minWidth: 80,
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
