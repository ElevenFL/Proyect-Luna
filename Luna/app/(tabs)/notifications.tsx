import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import apiService from '@/services/apiService';

// Tipos para las notificaciones
interface Notification {
  id: string;
  type: 'like' | 'match' | 'message' | 'visit' | 'friend_request';
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  userImage?: string;
  timestamp: string;
  isRead: boolean;
  friendRequestId?: string; // ID específico para la solicitud de amistad
  // Información adicional del usuario para el perfil
  userAge?: number;
  userGender?: string;
  userCountry?: string;
  userCountryFlag?: string;
  userDescription?: string;
  userIsOnline?: boolean;
}

interface NotificationSection {
  title: string;
  icon: string;
  data: Notification[];
}


export default function NotificationsScreen() {
  const [sections, setSections] = useState<NotificationSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<number>(0); // 0: Amigos, 1: Matches, 2: Visitas

  // Cargar notificaciones
  const loadNotifications = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando notificaciones...');
      
      let friendRequestNotifications: Notification[] = [];
      let matchNotifications: Notification[] = [];
      let visitNotifications: Notification[] = [];
      
      // 1. Cargar solicitudes de amistad del backend
      try {
        const friendRequestsResponse = await apiService.get('/friend-requests/received');
        
        if (friendRequestsResponse.success && friendRequestsResponse.data?.friendRequests) {
          friendRequestNotifications = friendRequestsResponse.data.friendRequests.map((request: any) => ({
            id: `fr_${request.id}`,
            type: 'friend_request' as const,
            title: 'Solicitud de amistad',
            message: `${request.senderName} quiere ser tu amiga`,
            userId: request.senderId,
            userName: request.senderName,
            userImage: request.senderImage,
            timestamp: request.createdAt,
            isRead: false,
            friendRequestId: request.friendRequestId
          }));
          
          console.log('✅ Solicitudes de amistad cargadas:', friendRequestNotifications.length);
        }
      } catch (error) {
        console.error('❌ Error cargando solicitudes de amistad:', error);
      }

      // 2. Cargar matches/likes recibidos
      try {
        const matchesResponse = await apiService.get('/users/received-likes');
        if (matchesResponse.success && matchesResponse.data?.likes) {
          matchNotifications = matchesResponse.data.likes.map((like: any) => ({
            id: like.id,
            type: like.type as 'like' | 'match',
            title: like.isMatch ? '¡Es un Match! 🎉' : '¡Nuevo corazón!',
            message: like.isMatch 
              ? `¡Tienes un match con ${like.userName}!`
              : `${like.userName} te ha dado un corazón`,
            userId: like.fromUserId,
            userName: like.userName,
            userImage: like.userImage,
            timestamp: like.timestamp,
            isRead: false,
            // Información adicional del usuario
            userAge: like.userAge,
            userGender: like.userGender,
            userCountry: like.userCountry,
            userCountryFlag: like.userCountryFlag,
            userDescription: like.userDescription,
            userIsOnline: like.userIsOnline,
          }));
          
          console.log('✅ Likes/matches cargados:', matchNotifications.length);
        }
      } catch (error) {
        console.error('❌ Error cargando matches:', error);
      }

      // 3. Cargar visitas al perfil (TODO: implementar endpoint en backend)
      try {
        // const visitsResponse = await apiService.get('/users/profile-visits');
        // if (visitsResponse.success && visitsResponse.data?.visits) {
        //   visitNotifications = visitsResponse.data.visits.map((visit: any) => ({
        //     id: `visit_${visit.id}`,
        //     type: 'visit' as const,
        //     title: 'Visitó tu perfil',
        //     message: `${visit.userName} visitó tu perfil`,
        //     userId: visit.userId,
        //     userName: visit.userName,
        //     userImage: visit.userImage,
        //     timestamp: visit.timestamp,
        //     isRead: false,
        //   }));
        // }
        console.log('⏳ Visitas: Endpoint pendiente de implementación en backend');
      } catch (error) {
        console.error('❌ Error cargando visitas:', error);
      }

      // Organizar en secciones
      const newSections: NotificationSection[] = [
        {
          title: 'Solicitudes de Amistad',
          icon: 'person-add',
          data: friendRequestNotifications,
        },
        {
          title: 'Matches',
          icon: 'heart',
          data: matchNotifications,
        },
        {
          title: 'Visitas al Perfil',
          icon: 'eye',
          data: visitNotifications,
        },
      ];
      
      setSections(newSections);
      console.log('✅ Notificaciones organizadas en secciones');
    } catch (error) {
      console.error('❌ Error cargando notificaciones:', error);
      // En caso de error, mostrar secciones vacías
      setSections([
        { title: 'Solicitudes de Amistad', icon: 'person-add', data: [] },
        { title: 'Matches', icon: 'heart', data: [] },
        { title: 'Visitas al Perfil', icon: 'eye', data: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Función para refrescar
  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  // Marcar notificación como leída
  const markAsRead = (notificationId: string) => {
    setSections(prev => 
      prev.map(section => ({
        ...section,
        data: section.data.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      }))
    );
  };

  // Manejar clic en notificación
  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.userId) {
      // Navegar al perfil del usuario con toda la información disponible
      router.push({
        pathname: '/user-profile',
        params: {
          id: notification.userId,
          name: notification.userName || '',
          profileImage: notification.userImage || '',
          // Información adicional si está disponible
          ...(notification.userAge && { age: notification.userAge.toString() }),
          ...(notification.userGender && { gender: notification.userGender }),
          ...(notification.userCountry && { country: notification.userCountry }),
          ...(notification.userCountryFlag && { countryFlag: notification.userCountryFlag }),
          ...(notification.userDescription && { description: notification.userDescription }),
          ...(notification.userIsOnline !== undefined && { isOnline: notification.userIsOnline.toString() }),
        }
      });
    }
  };

  // Obtener icono según el tipo de notificación
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return 'heart';
      case 'match':
        return 'heart';
      case 'message':
        return 'chatbubble';
      case 'visit':
        return 'eye';
      case 'friend_request':
        return 'person-add';
      default:
        return 'notifications';
    }
  };

  // Manejar aceptar solicitud de amistad
  const handleAcceptFriendRequest = async (notification: Notification) => {
    if (!notification.friendRequestId) return;
    
    try {
      const response = await apiService.post(`/friend-requests/${notification.friendRequestId}/accept`, {});
      
      if (response.success) {
        // Remover la notificación de la sección
        setSections(prev => 
          prev.map(section => ({
            ...section,
            data: section.data.filter(n => n.id !== notification.id)
          }))
        );
        console.log('Solicitud de amistad aceptada:', notification.userName);
      } else {
        console.error('Error aceptando solicitud de amistad:', response.message);
      }
    } catch (error) {
      console.error('Error aceptando solicitud de amistad:', error);
    }
  };

  // Manejar rechazar solicitud de amistad
  const handleRejectFriendRequest = async (notification: Notification) => {
    if (!notification.friendRequestId) return;
    
    try {
      const response = await apiService.post(`/friend-requests/${notification.friendRequestId}/reject`, {});
      
      if (response.success) {
        // Remover la notificación de la sección
        setSections(prev => 
          prev.map(section => ({
            ...section,
            data: section.data.filter(n => n.id !== notification.id)
          }))
        );
        console.log('Solicitud de amistad rechazada:', notification.userName);
      } else {
        console.error('Error rechazando solicitud de amistad:', response.message);
      }
    } catch (error) {
      console.error('Error rechazando solicitud de amistad:', error);
    }
  };

  // Formatear tiempo relativo
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <View
      style={[
        styles.notificationItem,
        !item.isRead && styles.unreadNotification
      ]}
    >
      <TouchableOpacity
        style={styles.notificationContent}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={getNotificationIcon(item.type) as any} 
            size={24} 
            color={item.isRead ? '#999999' : '#FFD700'} 
          />
        </View>
        
        <View style={styles.textContent}>
          <Text style={[
            styles.notificationTitle,
            !item.isRead && styles.unreadText
          ]}>
            {item.title}
          </Text>
          <Text style={styles.notificationMessage}>
            {item.message}
          </Text>
        </View>
        
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>
            {formatTimeAgo(item.timestamp)}
          </Text>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>
      </TouchableOpacity>

      {/* Botones de acción para solicitudes de amistad */}
      {item.type === 'friend_request' && (
        <View style={styles.friendRequestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptFriendRequest(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            <Text style={styles.acceptButtonText}>Aceptar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectFriendRequest(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
            <Text style={styles.rejectButtonText}>Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderSeparator = () => <View style={styles.separator} />;

  // Calcular total de notificaciones no leídas
  const unreadCount = sections.reduce((total, section) => 
    total + section.data.filter(n => !n.isRead).length, 0
  );

  // Obtener datos de la sección activa
  const activeData = sections[activeSection]?.data || [];
  
  // Renderizar pestaña de sección
  const renderSectionTab = (section: NotificationSection, index: number) => {
    const isActive = activeSection === index;
    const notificationCount = section.data.length;
    const unreadInSection = section.data.filter(n => !n.isRead).length;
    
    return (
      <TouchableOpacity
        key={index}
        style={[styles.sectionTab, isActive && styles.sectionTabActive]}
        onPress={() => setActiveSection(index)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionTabContent}>
          <Ionicons 
            name={section.icon as any} 
            size={20} 
            color={isActive ? '#FFD700' : '#666666'} 
          />
          <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>
            {section.title}
          </Text>
        </View>
        {notificationCount > 0 && (
          <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
              {notificationCount}
            </Text>
          </View>
        )}
        {unreadInSection > 0 && (
          <View style={styles.unreadIndicator} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>
            Notificaciones
            {unreadCount > 0 && (
              <Text style={styles.unreadCount}> ({unreadCount})</Text>
            )}
          </Text>
          <TouchableOpacity 
            style={styles.markAllButton}
            onPress={() => {
              setSections(prev => 
                prev.map(section => ({
                  ...section,
                  data: section.data.map(notification => ({ ...notification, isRead: true }))
                }))
              );
            }}
          >
            <Text style={styles.markAllText}>Marcar todas</Text>
          </TouchableOpacity>
        </View>

        {/* Pestañas de secciones */}
        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => renderSectionTab(section, index))}
        </View>
      </View>

      {/* Notifications List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Cargando notificaciones...</Text>
        </View>
      ) : (
        <FlatList
          data={activeData}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderSeparator}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FFD700']}
              tintColor="#FFD700"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons 
                name={sections[activeSection]?.icon as any || 'notifications-outline'} 
                size={64} 
                color="#666666" 
              />
              <Text style={styles.emptyText}>
                {activeSection === 0 && 'No tienes solicitudes de amistad'}
                {activeSection === 1 && 'Nadie te ha dado un corazón todavía'}
                {activeSection === 2 && 'Nadie ha visitado tu perfil recientemente'}
              </Text>
              <Text style={styles.emptySubtext}>
                {activeSection === 0 && 'Las solicitudes de amistad aparecerán aquí'}
                {activeSection === 1 && 'Cuando alguien te dé un corazón o tengas un match, lo verás aquí'}
                {activeSection === 2 && 'Las visitas a tu perfil se mostrarán aquí'}
              </Text>
            </View>
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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  markAllText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  notificationItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  unreadNotification: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContent: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: 4,
  },
  unreadText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 20,
  },
  timeContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
  },
  timeText: {
    fontSize: 12,
    color: '#666666',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingText: {
    color: '#CCCCCC',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#CCCCCC',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#999999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  friendRequestActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  sectionTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  sectionTabActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  sectionTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  sectionTabTextActive: {
    color: '#FFD700',
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'center',
    minWidth: 24,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  tabBadgeText: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '700',
  },
  tabBadgeTextActive: {
    color: '#FFD700',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
  },
});
