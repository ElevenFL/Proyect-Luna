import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  StatusBar,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Story } from '@/services/storiesService';
import { useAuth } from '@/contexts/AuthContext';
import { useStories } from '@/contexts/StoriesContext';
import CommentsModal from './CommentsModal';
import apiService from '@/services/apiService';

interface StoryPostProps {
  story: Story;
  onLike?: (storyId: string) => void;
  onComment?: (storyId: string) => void;
  onShare?: (storyId: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function StoryPost({ 
  story, 
  onLike, 
  onComment, 
  onShare 
}: StoryPostProps) {
  const { user } = useAuth();
  const { toggleLike, isLikedByUser } = useStories();
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Estados para el menú de opciones
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportCategory, setSelectedReportCategory] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [showReportReasonForm, setShowReportReasonForm] = useState(false);

  // Categorías de reporte
  const reportCategories = [
    { id: 'inappropriate', label: 'Contenido inapropiado', icon: 'warning-outline' },
    { id: 'harassment', label: 'Acoso o intimidación', icon: 'alert-circle-outline' },
    { id: 'spam', label: 'Spam o publicidad', icon: 'mail-outline' },
    { id: 'fake', label: 'Perfil falso', icon: 'person-remove-outline' },
    { id: 'suspicious', label: 'Comportamiento sospechoso', icon: 'eye-outline' },
    { id: 'other', label: 'Otro', icon: 'ellipsis-horizontal-outline' },
  ];
  
  // Verificar si el usuario actual ha dado like a este story
  const isLiked = isLikedByUser(story.id);

  const handleLike = async () => {
    if (isLoading || !user?.id) return;
    
    try {
      setIsLoading(true);
      await toggleLike(story.id);
      onLike?.(story.id);
    } catch (error) {
      console.error('Error al dar like:', error);
      Alert.alert('Error', 'No se pudo procesar el like');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComment = () => {
    setShowCommentsModal(true);
    onComment?.(story.id);
  };

  const handleShare = () => {
    onShare?.(story.id);
  };

  const handleImagePress = () => {
    if (story.content.type === 'image') {
      setShowImageModal(true);
    }
  };

  // Funciones para manejar reportes y bloqueos
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
    if (!selectedReportCategory || !story.userId) return;
    
    setShowReportModal(false);
    setShowReportReasonForm(false);
    
    try {
      const response = await apiService.post(`/users/${story.userId}/report`, {
        category: selectedReportCategory,
        reason: reportReason,
      });
      
      if (response.success) {
        console.log('Usuario reportado exitosamente:', story.userId, 'Categoría:', selectedReportCategory);
        Alert.alert('Reporte enviado', 'Gracias por tu reporte. Lo revisaremos pronto.');
      } else {
        console.error('Error en respuesta del servidor:', response.message);
        Alert.alert('Error', 'No se pudo enviar el reporte. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error reportando usuario:', error);
      Alert.alert('Error', 'No se pudo enviar el reporte. Inténtalo de nuevo.');
    } finally {
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
    
    Alert.alert(
      'Bloquear usuario',
      '¿Estás seguro de que quieres bloquear a este usuario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Bloquear', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiService.post(`/users/${story.userId}/block`, {});
              
              if (response.success) {
                console.log('Usuario bloqueado exitosamente:', story.userId);
                Alert.alert('Usuario bloqueado', 'Has bloqueado a este usuario exitosamente.');
              } else {
                console.error('Error en respuesta del servidor:', response.message);
                Alert.alert('Error', 'No se pudo bloquear al usuario. Inténtalo de nuevo.');
              }
            } catch (error) {
              console.error('Error bloqueando usuario:', error);
              Alert.alert('Error', 'No se pudo bloquear al usuario. Inténtalo de nuevo.');
            }
          }
        }
      ]
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const storyDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - storyDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return storyDate.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={styles.container}>
      {/* Header con información del usuario */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.profileImageContainer}>
            {story.userProfileImage ? (
              <Image 
                source={{ uri: story.userProfileImage }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                <Text style={styles.profileImageText}>
                  {getInitials(story.userName || 'Usuario')}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <View style={styles.nameAndTimeRow}>
              <Text style={styles.userName}>{story.userName}</Text>
              <Text style={styles.timeAgo}>
                {formatTimeAgo(story.createdAt)}
              </Text>
            </View>
            {story.content.type === 'image' && story.content.description && (
              <Text style={styles.descriptionText}>{story.content.description}</Text>
            )}
          </View>
        </View>

        {/* Botón de opciones */}
        {story.userId !== user?.id && (
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={() => setShowOptionsMenu(!showOptionsMenu)}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}

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

      {/* Contenido de la historia */}
      <View style={styles.content}>
        {story.content.type === 'image' ? (
          <TouchableOpacity onPress={handleImagePress} activeOpacity={0.9}>
            <Image 
              source={{ uri: story.content.data }} 
              style={styles.storyImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.textContent}>
            <Text style={styles.storyText}>{story.content.data}</Text>
          </View>
        )}
      </View>

      {/* Acciones */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.leftButton]} 
          onPress={handleLike}
          disabled={isLoading}
        >
          <View style={styles.likeContainer}>
            <Ionicons 
              name={isLiked ? "star" : "star-outline"} 
              size={24} 
              color={isLiked ? "#FFD700" : "#FFFFFF"} 
            />
            {story.stats.likes > 0 && (
              <Text style={styles.actionText}>{story.stats.likes}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleComment}
        >
          <View style={styles.likeContainer}>
            <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
            {story.stats.comments > 0 && (
              <Text style={styles.actionText}>{story.stats.comments}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.rightButton]} 
          onPress={handleShare}
        >
          <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Modal de Comentarios */}
      <CommentsModal
        visible={showCommentsModal}
        story={story}
        onClose={() => setShowCommentsModal(false)}
      />

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

      {/* Modal de Imagen Completa */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowImageModal(false)}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.imageModalContainer}>
          <TouchableOpacity 
            style={styles.imageModalCloseButton}
            onPress={() => setShowImageModal(false)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.imageModalContent}>
            <Image 
              source={{ uri: story.content.data }} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImageContainer: {
    marginRight: 12,
    marginLeft: -5,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  profileImagePlaceholder: {
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userDetails: {
    flex: 1,
  },
  nameAndTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timeAgo: {
    color: '#CCCCCC',
    fontSize: 12,
    marginLeft: 8,
  },
  descriptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
    marginTop: 4,
  },
  content: {
    width: '100%',
    backgroundColor: '#1a1a1a',
  },
  storyImage: {
    width: '100%',
    height: screenWidth * 0.8, // Aspecto cuadrado
    borderRadius: 16,
  },
  textContent: {
    padding: 20,
    backgroundColor: '#2a2a2a',
    minHeight: 100,
    justifyContent: 'center',
    borderRadius: 16,
  },
  storyText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 50,
  },
  leftButton: {
    justifyContent: 'flex-start',
  },
  rightButton: {
    justifyContent: 'flex-end',
  },
  likeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60, // Ancho fijo para mantener el ícono en posición fija
    justifyContent: 'flex-start',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  imageModalContainer: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 'rgba(0, 0, 0, 0.90)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  optionsButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
  },
  optionsMenu: {
    position: 'absolute',
    top: 48,
    right: 8,
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
