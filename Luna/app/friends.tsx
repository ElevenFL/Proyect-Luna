import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  StatusBar, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  TextInput, 
  RefreshControl 
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends, Friend } from '@/hooks/useFriends';
import OptimizedImage from '@/components/OptimizedImage';

export default function FriendsScreen() {
  const { user } = useAuth();
  const { friends, isLoading, error, refreshFriends } = useFriends();
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar amigos por búsqueda
  const filteredFriends = React.useMemo(() => {
    if (!searchQuery.trim()) return friends;
    
    const query = searchQuery.toLowerCase();
    return friends.filter(friend => 
      friend.name.toLowerCase().includes(query) ||
      friend.username.toLowerCase().includes(query)
    );
  }, [friends, searchQuery]);

  // Refrescar cuando la pantalla recibe foco
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('🔄 FriendsScreen: Foco recibido, refrescando amigos');
        refreshFriends();
      }
    }, [user?.id, refreshFriends])
  );

  // Navegar a chat con amigo
  const handleFriendPress = (friend: Friend) => {
    try {
      console.log(`🚀 FriendsScreen: Navegando a chat con ${friend.id}`);
      
      router.push({ 
        pathname: '/chat/[userId]', 
        params: { 
          userId: friend.id,
          userName: friend.name || '',
          userImage: friend.profileImage || '',
          userAge: friend.age?.toString() || '',
          userGender: friend.gender || 'other',
          userCountry: friend.country || 'Unknown',
          userCountryFlag: friend.countryFlag || '🌍',
          isOnline: friend.isOnline?.toString() || 'false'
        } 
      });
    } catch (error) {
      console.error('❌ FriendsScreen: Error navegando a chat:', error);
    }
  };

  // Funciones auxiliares
  const getGenderIcon = (gender?: string) => {
    switch (gender) {
      case 'male': return '♂';
      case 'female': return '♀';
      default: return '⚧';
    }
  };

  const getGenderColor = (gender?: string) => {
    switch (gender) {
      case 'male': return '#4A90E2';
      case 'female': return '#E24A90';
      default: return '#FFD700';
    }
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'U';
    const initials = name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return initials || 'U';
  };

  const getTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Desconocido';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
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
    } catch (error) {
      return 'Desconocido';
    }
  };

  // Componente de item de amigo
  const renderFriendItem = ({ item }: { item: Friend }) => {
    // Debug: Log para verificar los datos
    console.log('🔍 Friend data:', {
      name: item.name,
      age: item.age,
      gender: item.gender,
      country: item.country,
      countryFlag: item.countryFlag
    });

    return (
      <TouchableOpacity 
        style={styles.friendItem}
        onPress={() => handleFriendPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.friendContent}>
          {/* Profile Picture */}
          <View style={styles.profileContainer}>
            {item.profileImage && item.profileImage.trim() !== '' ? (
              <OptimizedImage 
                uri={item.profileImage} 
                style={styles.profileImage}
                cachePolicy="memory-disk"
                priority="normal"
                placeholder={undefined}
                fallback={undefined}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.initialsText}>
                  {getInitials(item.name)}
                </Text>
              </View>
            )}
            
            {/* Online Status Indicator */}
            <View style={[
              styles.statusIndicator,
              { backgroundColor: item.isOnline ? '#4CAF50' : '#666666' }
            ]} />
          </View>

          {/* Friend Info */}
          <View style={styles.friendInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.friendName}>{item.name}</Text>
            </View>
            
            {/* Info Badges */}
            <View style={styles.visualInfoContainer}>
              {/* Género */}
              {item.gender && (
                <View style={[styles.infoBadge, { backgroundColor: getGenderColor(item.gender) }]}>
                  <Text style={styles.infoBadgeText}>
                    {getGenderIcon(item.gender)}
                  </Text>
                </View>
              )}
              
              {/* Edad */}
              {item.age && (
                <View style={styles.infoBadge}>
                  <Text style={styles.infoBadgeText}>
                    {item.age}
                  </Text>
                </View>
              )}
              
              {/* País */}
              {(item.countryFlag || item.country) && (
                <View style={styles.countryBadge}>
                  <Text style={styles.countryFlagText}>
                    {item.countryFlag || '🌍'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Status */}
          <View style={styles.statusContainer}>
            <View style={styles.statusTextContainer}>
              <Text style={[styles.statusText, { color: item.isOnline ? '#4CAF50' : '#ADB5BD' }]}>
                {item.isOnline ? 'Online' : getTimeAgo(item.lastSeen)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#666666" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F9C80E" />
          <Text style={styles.loadingText}>Cargando amigos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Amigos</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar amigos..."
          placeholderTextColor="#888888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <Ionicons name="search" size={20} color="#F9C80E" style={styles.searchIcon} />
      </View>

      {/* Contador de amigos */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {filteredFriends.length} amigo{filteredFriends.length !== 1 ? 's' : ''}
          {searchQuery && ` encontrado${filteredFriends.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* Lista de amigos */}
      {filteredFriends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#444" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No se encontraron amigos' : 'No tienes amigos aún'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery 
              ? 'Intenta con otros términos de búsqueda'
              : 'Ve a perfiles de otros usuarios y envía solicitudes de amistad'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshFriends}
              tintColor="#F9C80E"
              colors={['#F9C80E']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F9C80E',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 3,
    backgroundColor: '#1a1a1a',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  searchIcon: {
    marginLeft: 10,
  },
  countContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  countText: {
    fontSize: 14,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#CCCCCC',
    marginTop: 16,
    fontSize: 16,
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
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 0,
  },
  friendItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileContainer: {
    position: 'relative',
    marginRight: 12,
  },
  profilePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F9C80E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  initialsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
  },
  friendInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendName: {
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
  countryBadge: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    width: 28,
    height: 20,
    marginRight: 5,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryFlagText: {
    fontSize: 14,
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
    marginBottom: 4,
  },
});
