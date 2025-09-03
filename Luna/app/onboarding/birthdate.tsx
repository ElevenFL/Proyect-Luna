import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions, Platform, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useOnboarding } from '@/hooks/useOnboarding';

const { width, height } = Dimensions.get('window');

export default function BirthdateScreen() {
  const { displayName } = useLocalSearchParams();
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateText, setDateText] = useState('');
  const [ageError, setAgeError] = useState('');
  const { updateBirthDate, isLoading, error } = useOnboarding();

  // Función para calcular la edad
  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  // Función para validar la edad
  const validateAge = (date: Date): boolean => {
    const age = calculateAge(date);
    if (age < 18) {
      setAgeError('Debes ser mayor de 18 años para continuar.');
      return false;
    } else {
      setAgeError('');
      return true;
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
      setDateText(selectedDate.toLocaleDateString('es-ES'));
      // Validar la edad cuando se selecciona una fecha
      validateAge(selectedDate);
    }
  };

  const handleNext = async () => {
    if (!dateText || !validateAge(birthDate)) return;

    try {
      // Guardar la fecha de nacimiento en DynamoDB
      const success = await updateBirthDate(birthDate.toISOString());
      
      if (success) {
        // Continuar al siguiente paso
        router.push({
          pathname: '/onboarding/gender',
          params: { 
            displayName: displayName as string,
            birthDate: birthDate.toISOString()
          }
        });
      } else {
        // Mostrar error si no se pudo guardar
        Alert.alert(
          'Error',
          'No se pudo guardar tu fecha de nacimiento. Por favor, intenta de nuevo.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Error guardando fecha de nacimiento:', err);
      Alert.alert(
        'Error',
        'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleBack = () => {
    router.back();
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Principal</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.question}>¿Cuál es tu fecha de nacimiento?</Text>
          
          <View style={styles.inputContainer}>
            <TouchableOpacity 
              style={[styles.input, isLoading && styles.inputDisabled]} 
              onPress={openDatePicker}
              disabled={isLoading}
            >
              <Text style={[styles.inputText, !dateText && styles.placeholderText]}>
                {dateText || 'Fecha de nacimiento'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Mensaje de error de edad */}
          {ageError ? (
            <Text style={styles.errorText}>{ageError}</Text>
          ) : (
            <Text style={styles.helperText}>
              Esto es para personalizar tu experiencia.
            </Text>
          )}

          {/* Mostrar error del hook si existe */}
          {error && (
            <Text style={styles.errorText}>
              {error}
            </Text>
          )}
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>

        {/* Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, (!dateText || ageError || isLoading) && styles.buttonDisabled]} 
            onPress={handleNext}
            disabled={!dateText || !!ageError || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.buttonText}>Siguiente</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  question: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  placeholderText: {
    color: '#666666',
  },
  helperText: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FFD700',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#333333',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
