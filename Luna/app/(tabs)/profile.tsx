import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Alert, ActivityIndicator, TextInput, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import OptimizedImage from '@/components/OptimizedImage';
import apiService from '@/services/apiService';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ImageService } from '@/services/imageService';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, logout, updateUserProfile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para los campos editables
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [profileImage, setProfileImage] = useState('');
  const [location, setLocation] = useState<any>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);

  const [originalName, setOriginalName] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [originalGender, setOriginalGender] = useState<'male' | 'female' | 'other'>('male');
  const [originalBirthDate, setOriginalBirthDate] = useState<Date | null>(null);
  const [originalProfileImage, setOriginalProfileImage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Función para calcular la edad desde birthDate
  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  // Cargar información del perfil desde la base de datos
  useEffect(() => {
    const loadProfileData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('🔄 Cargando información del perfil desde la base de datos...');
        const response = await apiService.get('/profiles');
        console.log('📡 Respuesta del servidor:', response);
        
        if (response.success && response.user) {
          const profileData = response.user;
          console.log('✅ Datos del perfil cargados:', profileData);
          
          // Mapear los datos de la base de datos a los campos del formulario
          setName(profileData.displayName || '');
          setOriginalName(profileData.displayName || '');
          setDescription(profileData.description || 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.');
          setOriginalDescription(profileData.description || 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.');
          setGender(profileData.gender || 'male');
          setOriginalGender(profileData.gender || 'male');
          setProfileImage(profileData.profileImage || '');
          setOriginalProfileImage(profileData.profileImage || '');
          setLocation(profileData.location || null);
          
          // Calcular edad desde birthDate
          if (profileData.birthDate) {
            const date = new Date(profileData.birthDate);
            setBirthDate(date);
            setOriginalBirthDate(date);
            const calculatedAge = calculateAge(profileData.birthDate);
            setAge(calculatedAge.toString());
          }
        } else {
          console.log('⚠️ No se pudieron cargar los datos del perfil, usando datos del contexto');
          // Usar datos del contexto como fallback
          setName(user.displayName || '');
          setOriginalName(user.displayName || '');
          setDescription('Lorem Ipsum is simply dummy text of the printing and typesetting industry.');
          setOriginalDescription('Lorem Ipsum is simply dummy text of the printing and typesetting industry.');
          setGender((user as any)?.gender || 'male');
          setOriginalGender((user as any)?.gender || 'male');
          setProfileImage((user as any)?.profileImage || '');
          setOriginalProfileImage((user as any)?.profileImage || '');
          if ((user as any)?.birthDate) {
            const date = new Date((user as any).birthDate);
            setBirthDate(date);
            setOriginalBirthDate(date);
            const calculatedAge = calculateAge((user as any).birthDate);
            setAge(calculatedAge.toString());
          }
        }
      } catch (error) {
        console.error('❌ Error cargando perfil:', error);
        console.error('❌ Detalles del error:', (error as any).message, (error as any).response?.data);
        // Usar datos del contexto como fallback
        setName(user.displayName || '');
        setOriginalName(user.displayName || '');
        setDescription('Lorem Ipsum is simply dummy text of the printing and typesetting industry.');
        setOriginalDescription('Lorem Ipsum is simply dummy text of the printing and typesetting industry.');
        setGender((user as any)?.gender || 'male');
        setOriginalGender((user as any)?.gender || 'male');
        setProfileImage((user as any)?.profileImage || '');
        setOriginalProfileImage((user as any)?.profileImage || '');
        if ((user as any)?.birthDate) {
          const date = new Date((user as any).birthDate);
          setBirthDate(date);
          setOriginalBirthDate(date);
          const calculatedAge = calculateAge((user as any).birthDate);
          setAge(calculatedAge.toString());
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, [user?.id]);

  useEffect(() => {
    const nameChanged = name !== originalName;
    const descChanged = description !== originalDescription;
    const genderChanged = gender !== originalGender;
    const birthChanged = birthDate && originalBirthDate 
      ? birthDate.getTime() !== originalBirthDate.getTime() 
      : birthDate !== originalBirthDate;
    const imageChanged = profileImage !== originalProfileImage;
    setHasChanges(nameChanged || descChanged || genderChanged || birthChanged || imageChanged);
  }, [name, originalName, description, originalDescription, gender, originalGender, birthDate, originalBirthDate, profileImage, originalProfileImage]);

  // Función para guardar cambios en el perfil
  const saveProfile = async () => {
    if (!user?.id) return;
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      console.log('💾 Guardando cambios del perfil...');
      
      const updateData: any = {};
      
      console.log('🔍 Verificando cambios:');
      console.log('  - name:', name, 'vs user.displayName:', user.displayName);
      console.log('  - gender:', gender, 'vs user.gender:', user.gender);
      console.log('  - description:', description, 'vs user.description:', (user as any).description);
      
      // Siempre enviar los campos principales para asegurar que se actualicen
      if (name !== user.displayName) {
        console.log('✅ Agregando displayName al updateData');
        updateData.displayName = name;
      }
      
      if (gender !== user.gender) {
        console.log('✅ Agregando gender al updateData');
        updateData.gender = gender;
      }
      
      if (description !== (user as any).description) {
        console.log('✅ Agregando description al updateData');
        console.log('📝 Descripción a enviar:', description);
        console.log('📝 Descripción actual del usuario:', (user as any).description);
        updateData.description = description;
      }

      const originalBirthDate = user.birthDate ? new Date(user.birthDate).toISOString() : null;
      const newBirthDate = birthDate ? birthDate.toISOString() : null;
      if (newBirthDate && newBirthDate !== originalBirthDate) {
        updateData.birthDate = newBirthDate;
      }

      if (profileImage && profileImage !== user.profileImage && !profileImage.startsWith('http')) {
        const uploadedUrl = await uploadProfileImage(profileImage);
        if (uploadedUrl) {
          updateData.profileImage = uploadedUrl;
          setProfileImage(uploadedUrl);
        } else {
          Alert.alert('Error', 'No se pudo subir la imagen. Inténtalo de nuevo.');
          setIsSaving(false);
          return;
        }
      }

      // Si hay cambios, actualizar en la base de datos
      if (Object.keys(updateData).length > 0) {
        console.log('📤 Enviando datos al backend:', updateData);
        const response = await apiService.put('/profiles', updateData);
        
        if (response.success) {
          console.log('✅ Perfil actualizado exitosamente');
          
          // Actualizar el contexto local
          updateUserProfile(updateData);
          
          setOriginalName(name);
          setOriginalDescription(description);
          setOriginalGender(gender);
          setOriginalBirthDate(birthDate);
          setOriginalProfileImage(profileImage);
          
          Alert.alert('Éxito', 'Perfil actualizado correctamente');
        } else {
          throw new Error(response.message || 'Error actualizando perfil');
        }
      } else {
        console.log('ℹ️ No hay cambios para guardar');
      }
    } catch (error) {
      console.error('❌ Error guardando perfil:', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    console.log('handleLogout llamado');
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión? Se eliminarán todos los datos de la sesión actual.',
      [
        { 
          text: 'Cancelar', 
          style: 'cancel',
          onPress: () => console.log('Logout cancelado')
        },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive', 
          onPress: async () => {
            console.log('Iniciando proceso de logout...');
            setIsLoggingOut(true);
            try {
              await logout();
              console.log('Logout completado exitosamente');
              // Redirección manual después del logout
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Error durante logout:', error);
              Alert.alert('Error', 'Hubo un problema al cerrar sesión. Inténtalo de nuevo.');
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
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

  const handleImagePick = async () => {
    if (isPickingImage) return;
    
    setIsPickingImage(true);
    
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permisos requeridos', 'Se necesita acceso a la galería para cambiar la foto de perfil.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Mantener cuadrado
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        
        // Subir imagen inmediatamente usando imageService o api
        // Para simplicidad, set local y subir en save
        setProfileImage(imageUri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Inténtalo de nuevo.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const uploadProfileImage = async (uri: string): Promise<string | null> => {
    try {
      console.log('Subiendo imagen de perfil usando ImageService...');
      const uploadedUrl = await ImageService.uploadOptimizedImage(uri, 'profile'); // Using 'profile' folder
      console.log('Imagen subida exitosamente:', uploadedUrl);
      return uploadedUrl;
    } catch (error) {
      console.error('Error subiendo imagen de perfil:', error);
      Alert.alert('Error', 'No se pudo subir la imagen. Inténtalo de nuevo.');
      return null;
    }
  };

  // Función para rotar género
  const handleGenderToggle = () => {
    if (gender === 'male') {
      setGender('female');
    } else if (gender === 'female') {
      setGender('other');
    } else {
      setGender('male');
    }
  };

  const getGenderSymbol = () => {
    switch (gender) {
      case 'male': return '♂';
      case 'female': return '♀';
      case 'other': return '⚧';
    }
  };

  const isGenderSelected = () => true;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header con iconos */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Imagen de perfil grande */}
      <View style={styles.profileImageContainer}>
        {profileImage && profileImage !== 'default' ? (
          <OptimizedImage
            uri={profileImage}
            style={styles.profileImage}
            cachePolicy="memory-disk"
            priority="high"
          />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Text style={styles.initialsText}>{getInitials(name || 'Usuario')}</Text>
          </View>
        )}
        <TouchableOpacity 
          style={[styles.cameraIcon, isPickingImage && styles.cameraIconDisabled]} 
          onPress={handleImagePick} 
          disabled={isPickingImage}
        >
          {isPickingImage ? (
            <ActivityIndicator size="small" color="#FFD700" />
          ) : (
            <Ionicons name="camera" size={20} color="#FFD700" />
          )}
        </TouchableOpacity>
      </View>

      {/* Campos de información */}
      <View style={styles.infoContainer}>
        {/* Nombre */}
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#999999"
          />
        </View>

        {/* Género - Edad - Nacionalidad */}
        <View style={styles.genderAgeNationalityRow}>
          <TouchableOpacity 
            style={[
              styles.genderButton,
              gender === 'male' && styles.genderButtonMale,
              gender === 'female' && styles.genderButtonFemale,
              gender === 'other' && styles.genderButtonOther
            ]}
            onPress={handleGenderToggle}
          >
            <Text style={styles.genderSymbol}>
              {getGenderSymbol()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateInputText}>
              {birthDate ? `${calculateAge(birthDate.toISOString())} años` : 'Seleccionar fecha de nacimiento'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color="#999999" />
          </TouchableOpacity>

          <Text style={styles.countryFlag}>{location?.countryFlag || '🇺🇸'}</Text>
        </View>

        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={birthDate || new Date()}
            mode="date"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selectedDate) {
                setBirthDate(selectedDate);
                const age = calculateAge(selectedDate.toISOString());
                setAge(age.toString());
              }
            }}
          />
        )}

        {/* Descripción */}
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción"
          placeholderTextColor="#999999"
          multiline
          numberOfLines={3}
        />

        {/* Botón para guardar cambios */}
        {hasChanges && (
          <TouchableOpacity 
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
            onPress={saveProfile}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    zIndex: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  profileImageContainer: {
    width: width - 40,
    height: width - 40, // Cuadrada
    alignSelf: 'center',
    marginTop: 90, // Ajustado
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profilePlaceholder: {
    flex: 1,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 80,
    fontWeight: '700',
    color: '#000000',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconDisabled: {
    opacity: 0.6,
  },
  infoContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  nameRow: {
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: '#2f2f2f',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8, // Ajustado a 8 para consistencia con otros
    fontSize: 16,
    color: '#FFFFFF',
    height: 40, // Altura fija para alinear con la fila inferior
  },
  ageInput: {
    width: 80,
    backgroundColor: '#2f2f2f',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    marginRight: 8,
  },
  countryFlag: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  descriptionInput: {
    backgroundColor: '#2f2f2f',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Removido genderContainer, genderButton antigua, genderText, genderTextSelected, ageNationalityRow
  genderAgeNationalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  genderButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2f2f2f',
    borderRadius: 8,
    paddingVertical: 8,
    width: 50, // Ancho fijo más pequeño
    marginRight: 8,
    height: 40, // Aumentado para coincidir con nameInput
  },
  genderButtonMale: {
    backgroundColor: '#007AFF', // Azul para masculino
  },
  genderButtonFemale: {
    backgroundColor: '#FF69B4', // Rosa para femenino
  },
  genderButtonOther: {
    backgroundColor: '#808080', // Gris para otros
  },
  genderSymbol: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Centrado para evitar corte del icono
    backgroundColor: '#2f2f2f',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    width: 140,
    marginRight: 8,
    height: 40, // Aumentado para coincidir con nameInput
  },
  dateInputText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 4,
    textAlign: 'center', // Para centrar el texto con el icono
  },
});
