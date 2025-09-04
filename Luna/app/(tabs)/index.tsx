import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { UserCard, User } from '@/components/UserCard';

// Datos de ejemplo de usuarios
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Erlan Sadewa',
    age: 21,
    gender: 'male',
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: true,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
  {
    id: '2',
    name: 'Nafisa Gitari',
    age: 23,
    gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: true,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
  {
    id: '3',
    name: 'Rodrigo Doria',
    age: 25,
    gender: 'male',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: false,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
  {
    id: '4',
    name: 'Sarah Johnson',
    age: 22,
    gender: 'female',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: false,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
  {
    id: '5',
    name: 'Ahmed Hassan',
    age: 24,
    gender: 'male',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: false,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
  {
    id: '6',
    name: 'Maria Garcia',
    age: 26,
    gender: 'female',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: false,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
  {
    id: '7',
    name: 'David Kim',
    age: 23,
    gender: 'male',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: false,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
  {
    id: '8',
    name: 'Lisa Chen',
    age: 21,
    gender: 'female',
    country: 'Malaysia',
    countryFlag: '🇲🇾',
    isOnline: false,
    description: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
  },
];

export default function HomeScreen() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setUsers(mockUsers);
    }, 500);
  }, []);

  const handleUserPress = (user: User) => {
    console.log('User pressed:', user.name);
    // Aquí puedes navegar al perfil del usuario o abrir un chat
  };

  const handleFilterPress = () => {
    console.log('Filter pressed');
    // Implementar filtros
  };

  const handleNotificationPress = () => {
    console.log('Notifications pressed');
    // Navegar a notificaciones
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <UserCard user={item} onPress={handleUserPress} />
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
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Users List */}
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderSeparator}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
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
});