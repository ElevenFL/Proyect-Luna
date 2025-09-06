import React, { useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import OptimizedImage from '@/components/OptimizedImage';

const { width, height } = Dimensions.get('window');

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  
  // Parsear los datos del usuario de los parámetros
  const user = {
    id: params.id as string,
    name: params.name as string,
    age: parseInt(params.age as string),
    gender: params.gender as string,
    profileImage: params.profileImage as string,
    country: params.country as string,
    countryFlag: params.countryFlag as string,
    isOnline: params.isOnline === 'true',
    description: params.description as string,
  };

  // Estados para acciones
  const [liked, setLiked] = useState(false);
  const [superLiked, setSuperLiked] = useState(false);
  const [friends, setFriends] = useState(false);

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

  const handleSuperLike = () => {
    setSuperLiked(prev => !prev);
    console.log('Super like user:', user.name);
  };

  const handleMore = () => {
    setFriends(prev => !prev);
    console.log('Toggle friends for user:', user.name);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
          <Ionicons name="chatbubble-outline" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSuperLike} style={styles.actionIconButton}>
          <Ionicons name={superLiked ? 'star' : 'star-outline'} size={28} color={superLiked ? '#FFC107' : '#FFFFFF'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMore} style={styles.actionIconButton}>
          <Ionicons name={friends ? 'people' : 'people-outline'} size={28} color={friends ? '#4CAF50' : '#FFFFFF'} />
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
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
