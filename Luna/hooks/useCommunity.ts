import { useState, useEffect, useMemo } from 'react';
import { useStories } from '@/contexts/StoriesContext';
import { useAuth } from '@/contexts/AuthContext';
import { Story } from '@/services/storiesService';
import storiesService from '@/services/storiesService';

export type CommunitySection = 'recent' | 'trending' | 'friends';

export interface CommunityData {
  recent: Story[];
  trending: Story[];
  friends: Story[];
  isLoading: boolean;
  error: string | null;
}

export const useCommunity = () => {
  const { stories, isLoading: storiesLoading } = useStories();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friendsStories, setFriendsStories] = useState<Story[]>([]);

  // Obtener stories de amigos
  useEffect(() => {
    const loadFriendsStories = async () => {
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const friendsStoriesData = await storiesService.getFriendsStories();
        
        // Convertir a array plano de stories
        const allFriendsStories: Story[] = [];
        friendsStoriesData.forEach(userStories => {
          const storiesWithUserInfo = userStories.stories.map(story => ({
            ...story,
            userId: userStories.userId,
            userName: userStories.userName,
            userProfileImage: userStories.userProfileImage
          }));
          allFriendsStories.push(...storiesWithUserInfo);
        });
        
        setFriendsStories(allFriendsStories);
      } catch (err) {
        console.error('Error cargando stories de amigos:', err);
        setError('Error cargando stories de amigos');
      } finally {
        setIsLoading(false);
      }
    };

    loadFriendsStories();
  }, [user?.id]);

  // Ordenar stories por tiempo de publicación (más recientes primero)
  const recentStories = useMemo(() => {
    return [...stories].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [stories]);

  // Ordenar stories por tendencia (combinación de likes, views y tiempo)
  const trendingStories = useMemo(() => {
    return [...stories].sort((a, b) => {
      // Calcular score de tendencia
      const getTrendingScore = (story: Story) => {
        const now = new Date();
        const storyTime = new Date(story.createdAt);
        const hoursAgo = (now.getTime() - storyTime.getTime()) / (1000 * 60 * 60);
        
        // Score basado en likes, views y tiempo (más reciente = mejor)
        const likesScore = story.stats.likes * 2;
        const viewsScore = story.stats.views * 0.5;
        const timeScore = Math.max(0, 24 - hoursAgo) * 0.1; // Bonus por ser reciente
        
        return likesScore + viewsScore + timeScore;
      };
      
      return getTrendingScore(b) - getTrendingScore(a);
    });
  }, [stories]);

  // Stories de amigos ordenados por tiempo
  const friendsStoriesSorted = useMemo(() => {
    return [...friendsStories].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [friendsStories]);

  const getStoriesBySection = (section: CommunitySection): Story[] => {
    switch (section) {
      case 'recent':
        return recentStories;
      case 'trending':
        return trendingStories;
      case 'friends':
        return friendsStoriesSorted;
      default:
        return [];
    }
  };

  const refreshSection = async (section: CommunitySection) => {
    if (section === 'friends') {
      // Recargar solo stories de amigos
      if (!user?.id) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const friendsStoriesData = await storiesService.getFriendsStories();
        
        const allFriendsStories: Story[] = [];
        friendsStoriesData.forEach(userStories => {
          const storiesWithUserInfo = userStories.stories.map(story => ({
            ...story,
            userId: userStories.userId,
            userName: userStories.userName,
            userProfileImage: userStories.userProfileImage
          }));
          allFriendsStories.push(...storiesWithUserInfo);
        });
        
        setFriendsStories(allFriendsStories);
      } catch (err) {
        console.error('Error refrescando stories de amigos:', err);
        setError('Error refrescando stories de amigos');
      } finally {
        setIsLoading(false);
      }
    }
    // Para 'recent' y 'trending' no necesitamos recargar ya que usan el contexto global
  };

  return {
    recent: recentStories,
    trending: trendingStories,
    friends: friendsStoriesSorted,
    isLoading: isLoading || storiesLoading,
    error,
    getStoriesBySection,
    refreshSection,
  };
};








