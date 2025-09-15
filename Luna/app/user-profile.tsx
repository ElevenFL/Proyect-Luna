import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import OptimizedImage from '@/components/OptimizedImage';
import apiService from '@/services/apiService';
import { usePrefetch } from '@/contexts/PrefetchContext';

const { width, height } = Dimensions.get('window');

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const { getPrefetchedUser } = usePrefetch();
  
  // Parsear los datos del usuario de los parámetros
  const user = {
    id: params.id as string || 'unknown',
    name: params.name as string || 'Usuario',
    age: parseInt(params.age as string) || 0,
    gender: params.gender as string || 'other',
    profileImage: params.profileImage as string || '',
    country: params.country as string || 'Unknown',
    countryFlag: params.countryFlag as string || '🌍',
    isOnline: params.isOnline === 'true',
    description: params.description as string || 'Usuario de Luna',
  };

  // Intentar obtener datos prefetchados
  const prefetchedData = getPrefetchedUser(user.id);
  const hasPrefetchData = !!prefetchedData;

  // Estados para acciones
  const [liked, setLiked] = useState(false);
  const [superLiked, setSuperLiked] = useState(false);
  const [friends, setFriends] = useState(false);
  const [starsCount, setStarsCount] = useState(0);
  const [hasGivenSuperLike, setHasGivenSuperLike] = useState(false);
  const [hasActiveConversation, setHasActiveConversation] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  
  // Cache simple para evitar llamadas repetidas
  const [cacheTimestamp, setCacheTimestamp] = useState(0);
  const CACHE_DURATION = 30000; // 30 segundos

  // Cargar contador de estrellas, estado de super like, estado de solicitud de amistad y verificar conversación activa al montar el componente
  useEffect(() => {
    const loadUserStatus = async () => {
      // Si tenemos datos prefetchados, usarlos inmediatamente
      if (hasPrefetchData && prefetchedData) {
        console.log('📦 Usando datos prefetchados para carga instantánea');
        
        // Aplicar datos prefetchados inmediatamente
        const { superLike, friendRequest, conversation } = prefetchedData.prefetchData;
        
        setStarsCount(superLike.starsCount || 0);
        setHasGivenSuperLike(superLike.hasGivenSuperLike || false);
        setSuperLiked(superLike.hasGivenSuperLike || false);
        setFriendRequestStatus(friendRequest.status);
        setHasActiveConversation(conversation.hasActiveConversation);
        
        if (friendRequest.status === 'accepted') {
          setFriends(true);
        }
        
        setIsLoadingStatus(false);
        return; // No hacer llamadas API adicionales
      }

      // Si no hay datos prefetchados, usar el método tradicional
      console.log('🔄 Cargando datos del usuario desde API...');
      
      // Verificar cache antes de hacer llamadas API
      const now = Date.now();
      if (now - cacheTimestamp < CACHE_DURATION && cacheTimestamp > 0) {
        setIsLoadingStatus(false);
        return;
      }

      setIsLoadingStatus(true);
      
      try {
        // Usar el nuevo endpoint optimizado que obtiene toda la información en una sola llamada
        const profileInfoResponse = await apiService.get(`/profiles/${user.id}/info`);
        
        if (profileInfoResponse.success && profileInfoResponse.data) {
          const { user: userData, superLike, friendRequest, conversation } = profileInfoResponse.data;
          
          // Actualizar estado de super like
          if (superLike) {
            setStarsCount(superLike.starsCount || 0);
            setHasGivenSuperLike(superLike.hasGivenSuperLike || false);
            setSuperLiked(superLike.hasGivenSuperLike || false);
          }
          
          // Actualizar estado de solicitud de amistad
          if (friendRequest) {
            setFriendRequestStatus(friendRequest.status);
            if (friendRequest.status === 'accepted') {
              setFriends(true);
            }
          }
          
          // Actualizar estado de conversación
          if (conversation) {
            setHasActiveConversation(conversation.hasActiveConversation);
          }
        } else {
          throw new Error('Error en la respuesta del servidor');
        }

      } catch (error) {
        console.error('Error cargando estado del usuario:', error);
        // En caso de error, mantener valores por defecto
        setStarsCount(0);
        setHasGivenSuperLike(false);
        setSuperLiked(false);
        setHasActiveConversation(false);
        setFriendRequestStatus('none');
      } finally {
        setIsLoadingStatus(false);
        setCacheTimestamp(Date.now());
      }
    };

    loadUserStatus();
  }, [user.id, hasPrefetchData, prefetchedData]);

  const handleGoBack = () => {
    router.back();
  };

  const handleLike = () => {
    setLiked(prev => !prev);
    console.log('Like user:', user.name);
  };

  const handleMessage = () => {
    router.push({ pathname: '/chat/[userId]', params: { userId: user.id } });
  };

  const handleSuperLike = async () => {
    // Prevenir super like duplicado
    if (hasGivenSuperLike) {
      console.log('Ya se ha dado super like a este usuario');
      return;
    }

    try {
      // Enviar super like al backend
      const response = await apiService.post(`/users/${user.id}/super-like`, {});
      
      if (response.success) {
        setSuperLiked(true);
        setHasGivenSuperLike(true);
        setStarsCount(response.data?.starsCount || 1);
        console.log('Super like enviado exitosamente:', user.name, 'Nuevo contador:', response.data?.starsCount);
      } else {
        console.error('Error en respuesta del servidor:', response.message);
      }
    } catch (error) {
      console.error('Error enviando super like:', error);
    }
  };

  const handleMore = async () => {
    try {
      // Solo enviar solicitud si no hay una pendiente o aceptada
      if (friendRequestStatus === 'pending' || friendRequestStatus === 'accepted') {
        console.log('Ya existe una solicitud de amistad con este usuario');
        return;
      }

      // Enviar solicitud de amistad al backend
      const response = await apiService.post(`/friend-requests/send/${user.id}`, {});
      
      if (response.success) {
        setFriendRequestStatus('pending');
        console.log('Solicitud de amistad enviada exitosamente a:', user.name);
      } else {
        console.error('Error en respuesta del servidor:', response.message);
      }
    } catch (error) {
      console.error('Error enviando solicitud de amistad:', error);
    }
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== 'string') return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Función auxiliar para obtener el estado del icono de solicitud de amistad
  // Estados del icono:
  // - 'accepted': Icono relleno verde (#4CAF50) - Son amigos
  // - 'pending': Icono relleno blanco (#FFFFFF) - Solicitud pendiente
  // - 'rejected': Icono outline gris (#999999) - Solicitud rechazada
  // - 'none': Icono outline blanco (#FFFFFF) - Sin solicitud
  const getFriendRequestIconState = () => {
    switch (friendRequestStatus) {
      case 'accepted':
        return {
          name: 'people' as const,
          color: '#4CAF50' // Verde para amigos
        };
      case 'pending':
        return {
          name: 'people' as const,
          color: '#FFFFFF' // Blanco para solicitud pendiente
        };
      case 'rejected':
        return {
          name: 'people-outline' as const,
          color: '#999999' // Gris para rechazada
        };
      default:
        return {
          name: 'people-outline' as const,
          color: '#FFFFFF' // Blanco por defecto
        };
    }
  };

  const cardWidth = width - 32;
  const cardHeight = Math.min(height * 0.48, 420);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header con botón de regreso */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#F9C80E" />
        </TouchableOpacity>
      </View>

      {/* Tarjeta de imagen */}
      <View style={[styles.imageCardWrapper, { width: cardWidth, height: cardHeight }]}>
        {user.profileImage ? (
          <OptimizedImage
            uri={user.profileImage}
            style={styles.profileImage}
            cachePolicy="memory-disk"
            priority="high"
          />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Text style={styles.initialsText}>{getInitials(user.name)}</Text>
          </View>
        )}

        {/* Gradiente sutil inferior */}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.25)"]} style={styles.gradientOverlay} />
      </View>

      {/* Fila de acciones */}
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={handleLike} style={styles.actionIconButton}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? '#FF4458' : '#FFFFFF'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMessage} style={styles.actionIconButton}>
          <Ionicons 
            name={hasActiveConversation ? "chatbubble" : "chatbubble-outline"} 
            size={28} 
            color={hasActiveConversation ? "#FFFFFF" : "#FFFFFF"} 
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSuperLike} style={styles.actionIconButton}>
          <View style={styles.starContainer}>
            <Ionicons 
              name={superLiked ? 'star' : 'star-outline'} 
              size={28} 
              color={superLiked ? '#FFC107' : '#FFFFFF'} 
            />
            {starsCount > 0 && (
              <Text style={styles.starCountText}>{starsCount}</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMore} style={styles.actionIconButton}>
          <Ionicons 
            name={getFriendRequestIconState().name}
            size={28} 
            color={getFriendRequestIconState().color}
          />
        </TouchableOpacity>
      </View>

      {/* Información del usuario */}
      <View style={styles.infoSection}>
        <View style={styles.titleRow}>
          <View style={styles.nameMetaRow}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.genderIcon}>{user.gender === 'male' ? '♂' : user.gender === 'female' ? '♀' : '⚧'}</Text>
            <Text style={styles.userAge}>{user.age}</Text>
            <Text style={styles.countryFlag}>{user.countryFlag}</Text>
          </View>
          <Text style={styles.statusText}>{user.isOnline ? 'Online' : 'Offline'}</Text>
        </View>

        <Text style={styles.description} numberOfLines={3}>
          {user.description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: 12,
  },
  header: {
    position: 'absolute',
    top: 44,
    left: 12,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.0)',
  },
  imageCardWrapper: {
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: 72,
    backgroundColor: '#141414',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.35)',
    elevation: 8,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    flex: 1,
    backgroundColor: '#F9C80E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 72,
    fontWeight: '700',
    color: '#000000',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  actionRow: {
    marginTop: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionIconButton: {
    padding: 8,
  },
  starContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starCountText: {
    position: 'absolute',
    left: 32,
    color: '#999999',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 6,
  },
  genderIcon: {
    fontSize: 14,
    color: '#4A90E2',
    marginRight: 4,
  },
  userAge: {
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 6,
  },
  countryFlag: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  description: {
    fontSize: 12,
    color: '#CCCCCC',
    lineHeight: 18,
    paddingRight: 24,
  },
});
