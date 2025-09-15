import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ApiService from '@/services/apiService';

export interface Friend {
  id: string;
  name: string;
  username: string;
  profileImage?: string;
  isOnline: boolean;
  lastSeen?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  country?: string;
  countryFlag?: string;
  friendshipDate: string;
}

export interface UseFriendsReturn {
  friends: Friend[];
  isLoading: boolean;
  error: string | null;
  refreshFriends: () => Promise<void>;
  getFriendById: (id: string) => Friend | undefined;
}

export const useFriends = (): UseFriendsReturn => {
  const { user, token } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user?.id || !token) {
      console.log('🔍 useFriends: No hay usuario o token, saltando carga');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('👥 useFriends: Obteniendo lista de amigos...');
      
      const response = await ApiService.get('/friend-requests/friends');
      
      if (response.success && response.data?.friends) {
        setFriends(response.data.friends);
        console.log(`✅ useFriends: ${response.data.friends.length} amigos cargados`);
      } else {
        console.log('⚠️ useFriends: Respuesta inesperada del servidor');
        setFriends([]);
      }
    } catch (err: any) {
      console.error('❌ useFriends: Error obteniendo amigos:', err);
      setError(err.message || 'Error obteniendo lista de amigos');
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, token]);

  const refreshFriends = useCallback(async () => {
    await fetchFriends();
  }, [fetchFriends]);

  const getFriendById = useCallback((id: string): Friend | undefined => {
    return friends.find(friend => friend.id === id);
  }, [friends]);

  // Cargar amigos cuando el usuario esté disponible
  useEffect(() => {
    if (user?.id && token) {
      fetchFriends();
    }
  }, [user?.id, token, fetchFriends]);

  return {
    friends,
    isLoading,
    error,
    refreshFriends,
    getFriendById
  };
};
