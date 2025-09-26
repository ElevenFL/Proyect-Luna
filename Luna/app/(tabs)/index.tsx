import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { UserCard, User } from '@/components/UserCard';
import FilterModal, { FilterOptions } from '@/components/FilterModal';
import ApiService from '@/services/apiService';
import { getFlagFromAddress } from '@/utils/countryFlags';
import { useAuth } from '@/contexts/AuthContext';
import { usePrefetch, UserWithPrefetch } from '@/contexts/PrefetchContext';
import { useStories } from '@/contexts/StoriesContext';
import StoriesDebugger from '@/components/StoriesDebugger';
import { useFilterPersistence } from '@/hooks/useFilterPersistence';
import { useNotificationCount } from '@/hooks/useNotificationCount';
import NotificationBadge from '@/components/NotificationBadge';

// Datos de ejemplo de usuarios con información de conexión y ubicaciones reales
const createMockUsers = (): User[] => {
  const mockUserData = [
    {
      id: '1',
      name: 'Erlan Sadewa',
      age: 21,
      gender: 'male' as const,
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      country: 'Kuala Lumpur, Malaysia',
      isOnline: true,
      description: 'Aventurero y amante de la tecnología.',
      lastConnection: new Date().toISOString(),
      connectionPriority: Date.now(),
    },
    {
      id: '2',
      name: 'Nafisa Gitari',
      age: 23,
      gender: 'female' as const,
      profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      country: 'Barcelona, Spain',
      isOnline: true,
      description: 'Artista y diseñadora gráfica.',
      lastConnection: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      connectionPriority: Date.now() - 2 * 60 * 1000,
    },
    {
      id: '3',
      name: 'Rodrigo Doria',
      age: 25,
      gender: 'male' as const,
      country: 'São Paulo, Brazil',
      isOnline: false,
      description: 'Desarrollador de software y músico.',
      lastConnection: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      connectionPriority: Date.now() - 15 * 60 * 1000,
    },
    {
      id: '4',
      name: 'Sarah Johnson',
      age: 22,
      gender: 'female' as const,
      country: 'Toronto, Canada',
      isOnline: false,
      description: 'Estudiante de medicina y viajera.',
      lastConnection: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      connectionPriority: Date.now() - 2 * 60 * 60 * 1000,
    },
    {
      id: '5',
      name: 'Ahmed Hassan',
      age: 24,
      gender: 'male' as const,
      country: 'Cairo, Egypt',
      isOnline: false,
      description: 'Ingeniero civil y fotógrafo.',
      lastConnection: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      connectionPriority: Date.now() - 6 * 60 * 60 * 1000,
    },
    {
      id: '6',
      name: 'Maria Garcia',
      age: 26,
      gender: 'female' as const,
      country: 'Mexico City, Mexico',
      isOnline: false,
      description: 'Chef profesional y bloguera gastronómica.',
      lastConnection: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      connectionPriority: Date.now() - 24 * 60 * 60 * 1000,
    },
    {
      id: '7',
      name: 'David Kim',
      age: 23,
      gender: 'male' as const,
      country: 'Seoul, South Korea',
      isOnline: false,
      description: 'Gamer profesional y streamer.',
      lastConnection: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      connectionPriority: Date.now() - 3 * 24 * 60 * 60 * 1000,
    },
    {
      id: '8',
      name: 'Lisa Chen',
      age: 21,
      gender: 'female' as const,
      country: 'Tokyo, Japan',
      isOnline: false,
      description: 'Estudiante de intercambio y amante del anime.',
      lastConnection: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      connectionPriority: Date.now() - 7 * 24 * 60 * 60 * 1000,
    },
  ];

  return mockUserData.map(user => ({
    ...user,
    countryFlag: getFlagFromAddress(user.country)
  }));
};

export default function HomeScreen() {
  const { user: currentUser } = useAuth();
  const { setPrefetchedUsers } = usePrefetch();
  const { getStoriesByUser } = useStories();
  const { filters: currentFilters, setFilters: setCurrentFilters, isLoading: filtersLoading } = useFilterPersistence();
  const { unreadCount, refresh: refreshNotifications } = useNotificationCount();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Función para filtrar al usuario actual de la lista
  const filterCurrentUser = (usersList: User[]) => {
    if (!currentUser?.id) return usersList;
    return usersList.filter(user => user.id !== currentUser.id);
  };

  // Función para ordenar usuarios por estado de conexión (fallback)
  const sortUsersByConnection = (usersList: User[]) => {
    return [...usersList].sort((a, b) => {
      // Primero, usuarios online
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      
      // Si ambos están online o ambos offline, ordenar por última conexión (más reciente primero)
      const aTime = a.connectionPriority || 0;
      const bTime = b.connectionPriority || 0;
      return bTime - aTime;
    });
  };

  // Función para aplicar filtros a los usuarios
  const applyFilters = (usersList: User[], filters: FilterOptions) => {
    return usersList.filter(user => {
      // Filtro por edad
      if (user.age < filters.ageRange[0] || user.age > filters.ageRange[1]) {
        return false;
      }

      // Filtro por género
      if (filters.gender !== 'all' && user.gender !== filters.gender) {
        return false;
      }

      // Filtro por países
      if (filters.countries.length > 0) {
        const userCountry = user.country.split(',')[1]?.trim() || user.country;
        const hasMatchingCountry = filters.countries.some(country => 
          userCountry.toLowerCase().includes(country.toLowerCase())
        );
        if (!hasMatchingCountry) {
          return false;
        }
      }

      return true;
    });
  };

  // Cargar usuarios desde el API
  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando usuarios desde el API...');
      
      const response = await ApiService.getHomeUsers();
      
      if (response.success && response.data) {
        const users = response.data || [];
        const prefetchingInfo = (response as any).prefetching;
        
        console.log('✅ Usuarios cargados desde el API:', users.length);
        console.log('📦 Prefetching habilitado:', prefetchingInfo?.enabled);
        console.log('📦 Datos de prefetching:', prefetchingInfo);
        
        // Asegurar que todos los usuarios tengan bandera correcta
        const usersWithFlags = users.map((user: UserWithPrefetch) => ({
          ...user,
          countryFlag: user.countryFlag || getFlagFromAddress(user.country)
        }));
        
        // Filtrar usuario actual como medida de seguridad adicional
        const filteredUsers = filterCurrentUser(usersWithFlags);
        console.log(`🔍 Filtrado adicional en frontend: ${usersWithFlags.length} -> ${filteredUsers.length} usuarios`);
        
        // Almacenar datos prefetchados para navegación rápida
        if (prefetchingInfo?.enabled) {
          setPrefetchedUsers(filteredUsers as UserWithPrefetch[]);
          console.log('📦 Datos prefetchados almacenados para navegación rápida');
        }
        
        const sortedUsers = sortUsersByConnection(filteredUsers);
        setUsers(sortedUsers);
        
        // Aplicar filtros actuales solo si no están cargando
        if (!filtersLoading) {
          const filteredByCriteria = applyFilters(sortedUsers, currentFilters);
          setFilteredUsers(filteredByCriteria);
        }
      } else {
        console.log('⚠️ No se pudieron cargar usuarios del API, usando datos mock');
        console.log('⚠️ Respuesta del API:', response);
        const mockUsers = createMockUsers();
        const filteredMockUsers = filterCurrentUser(mockUsers);
        const sortedUsers = sortUsersByConnection(filteredMockUsers);
        setUsers(sortedUsers);
        
        // Aplicar filtros actuales solo si no están cargando
        if (!filtersLoading) {
          const filteredByCriteria = applyFilters(sortedUsers, currentFilters);
          setFilteredUsers(filteredByCriteria);
        }
      }
    } catch (error) {
      console.error('❌ Error cargando usuarios del API:', error);
      console.log('🔄 Usando datos mock como fallback');
      const mockUsers = createMockUsers();
      const filteredMockUsers = filterCurrentUser(mockUsers);
      const sortedUsers = sortUsersByConnection(filteredMockUsers);
      setUsers(sortedUsers);
      
      // Aplicar filtros actuales solo si no están cargando
      if (!filtersLoading) {
        const filteredByCriteria = applyFilters(sortedUsers, currentFilters);
        setFilteredUsers(filteredByCriteria);
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para refrescar
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUsers(),
      refreshNotifications()
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Efecto para aplicar filtros cuando cambien o se carguen
  useEffect(() => {
    if (!filtersLoading && users.length > 0) {
      console.log('🔍 Aplicando filtros guardados:', currentFilters);
      const filteredByCriteria = applyFilters(users, currentFilters);
      setFilteredUsers(filteredByCriteria);
    }
  }, [currentFilters, filtersLoading, users]);

  const handleUserPress = (user: User) => {
    console.log('User pressed:', user.name);
    
    // Verificar si el usuario tiene datos prefetchados
    const userWithPrefetch = user as UserWithPrefetch;
    const hasPrefetchData = userWithPrefetch.prefetchData;
    
    console.log('📦 Datos prefetchados disponibles:', !!hasPrefetchData);
    
    // Navegar al perfil del usuario
    router.push({
      pathname: '/user-profile',
      params: {
        id: user.id,
        name: user.name,
        age: user.age.toString(),
        gender: user.gender,
        profileImage: user.profileImage || '',
        country: user.country,
        countryFlag: user.countryFlag,
        isOnline: user.isOnline.toString(),
        description: user.description,
        lastConnection: user.lastConnection || '',
        // Incluir datos prefetchados si están disponibles
        ...(hasPrefetchData && {
          prefetchData: JSON.stringify(userWithPrefetch.prefetchData)
        })
      }
    });
  };

  const handleStoryPress = (user: User) => {
    console.log('Story pressed for user:', user.name);
    
    // Verificar si el usuario tiene historias activas
    const userStories = getStoriesByUser(user.id);
    
    if (userStories.length > 0) {
      // Navegar a la pantalla de historias
      router.push({
        pathname: '/view-stories',
        params: { from: 'home' }
      });
    } else {
      // Si no hay historias, navegar al perfil
      handleUserPress(user);
    }
  };

  const handleFilterPress = () => {
    console.log('Filter pressed');
    setShowFilterModal(true);
  };

  const handleApplyFilters = (filters: FilterOptions) => {
    console.log('Aplicando filtros:', filters);
    setCurrentFilters(filters); // Esto automáticamente guarda los filtros en AsyncStorage
    
    // Aplicar filtros a los usuarios actuales
    const filtered = applyFilters(users, filters);
    setFilteredUsers(filtered);
  };

  const handleNotificationPress = () => {
    console.log('Notifications pressed');
    router.push('/(tabs)/notifications');
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <UserCard 
      user={item} 
      onPress={handleUserPress}
      onStoryPress={handleStoryPress}
    />
  );

  const renderSeparator = () => <View style={styles.separator} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Lunea</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={handleFilterPress} style={styles.iconButton}>
              <Ionicons name="options-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNotificationPress} style={styles.iconButton}>
              <View style={styles.notificationIconContainer}>
                <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
                <NotificationBadge count={unreadCount} size="small" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Users List */}
        {loading && filteredUsers.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Cargando usuarios...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
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
                <Ionicons name="people-outline" size={64} color="#666666" />
                <Text style={styles.emptyText}>No se encontraron usuarios</Text>
                <Text style={styles.emptySubtext}>Intenta ajustar los filtros</Text>
              </View>
            }
          />
        )}

        {/* Filter Modal */}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApplyFilters={handleApplyFilters}
          currentFilters={currentFilters}
        />

        {/* Stories Debugger - Solo en desarrollo */}
        {/* <StoriesDebugger /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerText: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 10,
  },
  headerIcons: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  notificationIconContainer: {
    position: 'relative',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100, // Espacio para el navbar inferior
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
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
  },
  emptyText: {
    color: '#CCCCCC',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#999999',
    fontSize: 14,
    marginTop: 8,
  },
});