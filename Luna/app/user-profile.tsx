import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Dimensions, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import OptimizedImage from '@/components/OptimizedImage';
import UserStoriesGrid from '@/components/UserStoriesGrid';
import apiService from '@/services/apiService';
import { usePrefetch } from '@/contexts/PrefetchContext';

const { width, height } = Dimensions.get('window');

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const { getPrefetchedUser } = usePrefetch();
  
  // Función para obtener los datos del usuario (combinando params con datos completos)
  const getUserData = () => {
    // Si tenemos datos completos del usuario, usarlos como prioridad
    if (completeUserData) {
      return {
        id: completeUserData.id || params.id as string || 'unknown',
        name: completeUserData.displayName || completeUserData.username || params.name as string || 'Usuario',
        age: completeUserData.age || parseInt(params.age as string) || 0,
        gender: completeUserData.gender || params.gender as string || 'other',
        profileImage: completeUserData.profileImage || params.profileImage as string || '',
        country: completeUserData.location?.country || params.country as string || 'Unknown',
        countryFlag: completeUserData.location?.countryFlag || params.countryFlag as string || '🌍',
        isOnline: completeUserData.isOnline !== undefined ? completeUserData.isOnline : (params.isOnline === 'true'),
        description: completeUserData.description || params.description as string || 'Usuario de Luna',
      };
    }
    
    // Si no hay datos completos, usar los parámetros
    return {
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
  };

  const user = getUserData();

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
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [isMatch, setIsMatch] = useState(false);
  const [completeUserData, setCompleteUserData] = useState<any>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportCategory, setSelectedReportCategory] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [showReportReasonForm, setShowReportReasonForm] = useState(false);
  
  // Cache simple para evitar llamadas repetidas
  const [cacheTimestamp, setCacheTimestamp] = useState(0);
  const CACHE_DURATION = 30000; // 30 segundos

  // Categorías de reporte
  const reportCategories = [
    { id: 'inappropriate', label: 'Contenido inapropiado', icon: 'warning-outline' },
    { id: 'harassment', label: 'Acoso o intimidación', icon: 'alert-circle-outline' },
    { id: 'spam', label: 'Spam o publicidad', icon: 'mail-outline' },
    { id: 'fake', label: 'Perfil falso', icon: 'person-remove-outline' },
    { id: 'suspicious', label: 'Comportamiento sospechoso', icon: 'eye-outline' },
    { id: 'other', label: 'Otro', icon: 'ellipsis-horizontal-outline' },
  ];

  // Cargar información completa del usuario si faltan datos
  useEffect(() => {
    const loadUserInfo = async () => {
      // Verificar si faltan datos importantes del usuario
      const hasIncompleteData = !user.age || user.age === 0 || 
                               !user.gender || user.gender === 'other' ||
                               !user.country || user.country === 'Unknown' ||
                               !user.description || user.description === 'Usuario de Luna';

      if (hasIncompleteData && user.id !== 'unknown') {
        console.log('🔄 Cargando información completa del usuario...');
        
        try {
          const userInfoResponse = await apiService.get(`/users/${user.id}`);
          
          if (userInfoResponse.success && userInfoResponse.data) {
            const userData = userInfoResponse.data;
            
            // Almacenar los datos completos del usuario
            setCompleteUserData(userData);
            console.log('✅ Información del usuario cargada:', userData);
          }
        } catch (error) {
          console.error('Error cargando información del usuario:', error);
        }
      }
    };

    loadUserInfo();
  }, [user.id]);

  // Cargar contador de estrellas, estado de super like, estado de solicitud de amistad y verificar conversación activa al montar el componente
  useEffect(() => {
    const loadUserStatus = async () => {
      // Si tenemos datos prefetchados, usarlos inmediatamente
      if (hasPrefetchData && prefetchedData) {
        console.log('📦 Usando datos prefetchados para carga instantánea');
        
        // Aplicar datos prefetchados inmediatamente
        const { superLike, friendRequest, conversation, like } = prefetchedData.prefetchData;
        
        setStarsCount(superLike.starsCount || 0);
        setHasGivenSuperLike(superLike.hasGivenSuperLike || false);
        setSuperLiked(superLike.hasGivenSuperLike || false);
        setFriendRequestStatus(friendRequest.status);
        setHasActiveConversation(conversation.hasActiveConversation);
        setLiked(like?.hasGivenLike || false);
        setIsMatch(like?.isMatch || false);
        
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
          const { user: userData, superLike, friendRequest, conversation, like } = profileInfoResponse.data;
          
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
          
          // Actualizar estado de like regular
          if (like) {
            setLiked(like.hasGivenLike || false);
            setIsMatch(like.isMatch || false);
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
        setLiked(false);
        setIsMatch(false);
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

  const handleLike = async () => {
    // Prevenir like duplicado
    if (liked) {
      console.log('Ya se ha dado like a este usuario');
      return;
    }

    try {
      // Enviar like al backend
      const response = await apiService.post(`/users/${user.id}/like`, {});
      
      if (response.success) {
        setLiked(true);
        console.log('Like enviado exitosamente:', user.name);
        
        // Si es un match, mostrar feedback especial y actualizar estado
        if (response.data?.isMatch) {
          console.log('¡Es un match! 🎉');
          setIsMatch(true);
          setShowMatchAnimation(true);
          // Ocultar la animación después de 3 segundos
          setTimeout(() => {
            setShowMatchAnimation(false);
          }, 3000);
        }
      } else {
        console.error('Error en respuesta del servidor:', response.message);
      }
    } catch (error) {
      console.error('Error enviando like:', error);
    }
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

  const handleReport = () => {
    setShowOptionsMenu(false);
    setShowReportModal(true);
    setShowReportReasonForm(false);
    setSelectedReportCategory(null);
    setReportReason('');
  };

  const handleReportCategory = (categoryId: string) => {
    setSelectedReportCategory(categoryId);
    setShowReportReasonForm(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedReportCategory) return;
    
    setShowReportModal(false);
    setShowReportReasonForm(false);
    
    try {
      const response = await apiService.post(`/users/${user.id}/report`, {
        category: selectedReportCategory,
        reason: reportReason,
      });
      
      if (response.success) {
        console.log('Usuario reportado exitosamente:', user.name, 'Categoría:', selectedReportCategory);
        // Aquí podrías mostrar una notificación de éxito
      } else {
        console.error('Error en respuesta del servidor:', response.message);
      }
    } catch (error) {
      console.error('Error reportando usuario:', error);
    } finally {
      // Resetear estados
      setSelectedReportCategory(null);
      setReportReason('');
    }
  };

  const handleBackToCategories = () => {
    setShowReportReasonForm(false);
    setSelectedReportCategory(null);
    setReportReason('');
  };

  const handleBlock = async () => {
    setShowOptionsMenu(false);
    try {
      const response = await apiService.post(`/users/${user.id}/block`, {});
      
      if (response.success) {
        console.log('Usuario bloqueado exitosamente:', user.name);
        // Regresar a la pantalla anterior después de bloquear
        router.back();
      } else {
        console.error('Error en respuesta del servidor:', response.message);
      }
    } catch (error) {
      console.error('Error bloqueando usuario:', error);
    }
  };

  // Función para determinar el color y estado del corazón
  const getHeartState = () => {
    if (isMatch) {
      return {
        name: 'heart' as const,
        color: '#FF4458' // Rojo para match mutuo
      };
    } else if (liked) {
      return {
        name: 'heart' as const,
        color: '#FFFFFF' // Blanco para like unilateral
      };
    } else {
      return {
        name: 'heart-outline' as const,
        color: '#FFFFFF' // Blanco outline para sin like
      };
    }
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

      {/* Animación de Match */}
      {showMatchAnimation && (
        <View style={styles.matchAnimation}>
          <Text style={styles.matchText}>¡Es un Match! 🎉</Text>
        </View>
      )}

      {/* Modal de categorías de reporte */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReportModal(false)}
        statusBarTranslucent={true}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportModal(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.reportModal}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                {!showReportReasonForm ? (
                  // Pantalla de selección de categoría
                  <>
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportTitle}>Reportar usuario</Text>
                      <TouchableOpacity onPress={() => setShowReportModal(false)}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.reportSubtitle}>
                      Selecciona el motivo del reporte:
                    </Text>

                    <View style={styles.reportCategoriesContainer}>
                      {reportCategories.map((category) => (
                        <TouchableOpacity
                          key={category.id}
                          style={styles.reportCategoryItem}
                          onPress={() => handleReportCategory(category.id)}
                        >
                          <Ionicons name={category.icon as any} size={24} color="#F9C80E" />
                          <Text style={styles.reportCategoryText}>{category.label}</Text>
                          <Ionicons name="chevron-forward" size={20} color="#999999" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : (
                  // Pantalla de razón del reporte
                  <>
                    <View style={styles.reportHeader}>
                      <TouchableOpacity onPress={handleBackToCategories} style={styles.backIconButton}>
                        <Ionicons name="chevron-back" size={24} color="#F9C80E" />
                      </TouchableOpacity>
                      <Text style={styles.reportTitle}>Describe el reporte</Text>
                      <TouchableOpacity onPress={() => setShowReportModal(false)}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.reportSubtitle}>
                      Categoría: {reportCategories.find(c => c.id === selectedReportCategory)?.label}
                    </Text>

                    <Text style={styles.reportReasonLabel}>
                      Describe la razón del reporte:
                    </Text>

                    <TextInput
                      style={styles.reportReasonInput}
                      placeholder="Escribe aquí los detalles..."
                      placeholderTextColor="#666666"
                      value={reportReason}
                      onChangeText={setReportReason}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                    />

                    <TouchableOpacity 
                      style={[styles.submitReportButton, !reportReason.trim() && styles.submitReportButtonDisabled]}
                      onPress={handleSubmitReport}
                      disabled={!reportReason.trim()}
                    >
                      <Text style={styles.submitReportButtonText}>Enviar reporte</Text>
                    </TouchableOpacity>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Información del usuario */}
        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            <View style={styles.nameMetaRow}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.genderIcon}>{user.gender === 'male' ? '♂' : user.gender === 'female' ? '♀' : '⚧'}</Text>
              <Text style={styles.userAge}>{user.age}</Text>
              <Text style={styles.countryFlag}>{user.countryFlag}</Text>
            </View>
            <Text style={[styles.statusText, { color: user.isOnline ? '#4CAF50' : '#999999' }]}>
              {user.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
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

          {/* Botón de opciones (3 puntos verticales) */}
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => setShowOptionsMenu(!showOptionsMenu)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Menú de opciones */}
          {showOptionsMenu && (
            <View style={styles.optionsMenu}>
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={handleReport}
              >
                <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
                <Text style={styles.optionText}>Reportar</Text>
              </TouchableOpacity>
              <View style={styles.optionDivider} />
              <TouchableOpacity 
                style={styles.optionItem}
                onPress={handleBlock}
              >
                <Ionicons name="ban-outline" size={20} color="#FF4458" />
                <Text style={[styles.optionText, { color: '#FF4458' }]}>Bloquear</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Fila de acciones */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleLike} style={styles.actionIconButton}>
            <Ionicons name={getHeartState().name} size={28} color={getHeartState().color} />
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

        {/* Descripción del usuario */}
        <View style={styles.descriptionSection}>
          <Text style={styles.description} numberOfLines={3}>
            {user.description}
          </Text>
        </View>

        {/* Grid de historias del usuario */}
        <UserStoriesGrid userId={user.id} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 72,
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
    marginTop: 8,
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
    marginHorizontal: 24,
    marginBottom: 0,
  },
  descriptionSection: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
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
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  matchAnimation: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  matchText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  optionsButton: {
    position: 'absolute',
    top: 4,
    right: 2,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  optionsMenu: {
    position: 'absolute',
    top: 44,
    right: 4,
    backgroundColor: 'rgba(30, 30, 30, 0.98)',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '500',
  },
  optionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  reportModal: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    width: 360,
    maxWidth: '90%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 20,
  },
  reportCategoriesContainer: {
    gap: 8,
  },
  reportCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reportCategoryText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '500',
  },
  backIconButton: {
    padding: 4,
  },
  reportReasonLabel: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 12,
    marginTop: 8,
  },
  reportReasonInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 120,
    marginBottom: 20,
  },
  submitReportButton: {
    backgroundColor: '#F9C80E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReportButtonDisabled: {
    backgroundColor: 'rgba(249, 200, 14, 0.3)',
  },
  submitReportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
});
