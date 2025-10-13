import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, StatusBar, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hiddenModeEnabled, setHiddenModeEnabled] = useState(false);
  
  // TODO: Obtener el estado pro del usuario desde el backend
  // Por ahora, se establece como false hasta que se implemente
  const isProUser = false;

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
    rightComponent,
    isPro = false
  }: { 
    icon: any; 
    title: string; 
    subtitle?: string; 
    onPress?: () => void;
    showArrow?: boolean;
    rightComponent?: React.ReactNode;
    isPro?: boolean;
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
          <View style={styles.titleWithBadgeRow}>
            <Text style={styles.settingTitle}>{title}</Text>
            {isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
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
    onValueChange,
    isPro = false,
    disabled = false
  }: { 
    icon: any; 
    title: string; 
    subtitle?: string; 
    value: boolean;
    onValueChange: (value: boolean) => void;
    isPro?: boolean;
    disabled?: boolean;
  }) => (
    <View style={[styles.settingItem, disabled && styles.settingItemDisabled]}>
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={disabled ? "#999999" : "#FFD700"} />
        </View>
        <View style={styles.settingTextContainer}>
          <View style={styles.titleWithBadgeRow}>
            <Text style={[styles.settingTitle, disabled && styles.settingTitleDisabled]}>{title}</Text>
            {isPro && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          {subtitle && <Text style={[styles.settingSubtitle, disabled && styles.settingSubtitleDisabled]}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? () => Alert.alert('Función PRO', 'Esta función solo está disponible para usuarios PRO. Actualiza tu cuenta para acceder.') : onValueChange}
        disabled={disabled}
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
          <Ionicons name="chevron-back" size={24} color="#F9C80E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Configuración general */}
        <SectionHeader title="GENERAL" />
        <View style={styles.section}>
          <SettingItem
            icon="key-outline"
            title="Cambiar contraseña"
            onPress={() => Alert.alert('Contraseña', 'Función en desarrollo')}
          />
          <SettingToggle
            icon="eye-off-outline"
            title="Modo oculto"
            subtitle="Oculta tu perfil de otros usuarios"
            value={hiddenModeEnabled}
            onValueChange={setHiddenModeEnabled}
          />
          <SettingItem
            icon="remove-circle-outline"
            title="Quitar anuncios"
            subtitle="Disfruta de una experiencia sin publicidad"
            onPress={() => Alert.alert('Función PRO', 'Esta función solo está disponible para usuarios PRO. Actualiza tu cuenta para acceder.')}
          />
          <SettingToggle
            icon="notifications-outline"
            title="Notificaciones push"
            subtitle="Recibir notificaciones de la app"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          <SettingItem
            icon="language-outline"
            title="Idioma de la app"
            subtitle="Español"
            onPress={() => Alert.alert('Idioma', 'Función en desarrollo')}
          />
        </View>

        {/* Soporte */}
        <SectionHeader title="SOPORTE" />
        <View style={styles.section}>
          <SettingItem
            icon="bug-outline"
            title="Informar de un error"
            onPress={() => Alert.alert('Informar error', 'Función en desarrollo')}
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
    backgroundColor: 'rgba(0, 0, 0, 0)',
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
    marginTop: 10,
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
  settingTitleDisabled: {
    color: '#666666',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#999999',
  },
  settingSubtitleDisabled: {
    color: '#555555',
  },
  settingItemDisabled: {
    opacity: 0.6,
  },
  titleWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 20,
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




