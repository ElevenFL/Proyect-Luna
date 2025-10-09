import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { 
          text: 'Cancelar', 
          style: 'cancel'
        },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Error durante logout:', error);
              Alert.alert('Error', 'Hubo un problema al cerrar sesión. Inténtalo de nuevo.');
            }
          }
        }
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    showArrow = true,
    rightComponent
  }: { 
    icon: any; 
    title: string; 
    subtitle?: string; 
    onPress?: () => void;
    showArrow?: boolean;
    rightComponent?: React.ReactNode;
  }) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color="#FFD700" />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (showArrow && (
        <Ionicons name="chevron-forward" size={20} color="#999999" />
      ))}
    </TouchableOpacity>
  );

  const SettingToggle = ({ 
    icon, 
    title, 
    subtitle, 
    value, 
    onValueChange 
  }: { 
    icon: any; 
    title: string; 
    subtitle?: string; 
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color="#FFD700" />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: '#FFD700' }}
        thumbColor={value ? '#FFFFFF' : '#f4f3f4'}
      />
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Información de la cuenta */}
        <SectionHeader title="CUENTA" />
        <View style={styles.section}>
          <SettingItem
            icon="person-outline"
            title="Información del perfil"
            subtitle={user?.email || ''}
            onPress={() => router.back()}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Privacidad y seguridad"
            onPress={() => Alert.alert('Privacidad', 'Función en desarrollo')}
          />
          <SettingItem
            icon="key-outline"
            title="Cambiar contraseña"
            onPress={() => Alert.alert('Contraseña', 'Función en desarrollo')}
          />
        </View>

        {/* Notificaciones */}
        <SectionHeader title="NOTIFICACIONES" />
        <View style={styles.section}>
          <SettingToggle
            icon="notifications-outline"
            title="Notificaciones push"
            subtitle="Recibir notificaciones de la app"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          <SettingToggle
            icon="volume-high-outline"
            title="Sonidos"
            subtitle="Reproducir sonidos de notificación"
            value={soundEnabled}
            onValueChange={setSoundEnabled}
          />
        </View>

        {/* Apariencia */}
        <SectionHeader title="APARIENCIA" />
        <View style={styles.section}>
          <SettingToggle
            icon="moon-outline"
            title="Modo oscuro"
            subtitle="Tema oscuro activado"
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
          />
          <SettingItem
            icon="color-palette-outline"
            title="Tema de color"
            onPress={() => Alert.alert('Tema', 'Función en desarrollo')}
          />
        </View>

        {/* Almacenamiento */}
        <SectionHeader title="ALMACENAMIENTO" />
        <View style={styles.section}>
          <SettingItem
            icon="trash-outline"
            title="Limpiar caché"
            subtitle="Liberar espacio de almacenamiento"
            onPress={() => Alert.alert('Caché', 'Función en desarrollo')}
          />
          <SettingItem
            icon="download-outline"
            title="Gestionar descargas"
            onPress={() => Alert.alert('Descargas', 'Función en desarrollo')}
          />
        </View>

        {/* Soporte */}
        <SectionHeader title="SOPORTE" />
        <View style={styles.section}>
          <SettingItem
            icon="help-circle-outline"
            title="Centro de ayuda"
            onPress={() => Alert.alert('Ayuda', 'Función en desarrollo')}
          />
          <SettingItem
            icon="chatbubble-outline"
            title="Contactar soporte"
            onPress={() => Alert.alert('Soporte', 'Función en desarrollo')}
          />
          <SettingItem
            icon="document-text-outline"
            title="Términos y condiciones"
            onPress={() => Alert.alert('Términos', 'Función en desarrollo')}
          />
          <SettingItem
            icon="information-circle-outline"
            title="Acerca de"
            subtitle="Versión 1.0.0"
            showArrow={false}
          />
        </View>

        {/* Cerrar sesión */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        {/* Espacio inferior para el scroll */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1a1a1a',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999999',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    backgroundColor: '#2f2f2f',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#999999',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginLeft: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});



