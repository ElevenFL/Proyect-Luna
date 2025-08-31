import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

type GenderOption = 'male' | 'female' | 'other';

interface GenderOptionData {
  id: GenderOption;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const genderOptions: GenderOptionData[] = [
  {
    id: 'male',
    label: 'Male',
    icon: 'man',
    description: 'I identify as a man'
  },
  {
    id: 'female',
    label: 'Female',
    icon: 'woman',
    description: 'I identify as a man'
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'person',
    description: 'Another gender identity'
  }
];

export default function GenderScreen() {
  const { displayName, birthDate } = useLocalSearchParams();
  const [selectedGender, setSelectedGender] = useState<GenderOption | null>(null);

  const handleGenderSelect = (gender: GenderOption) => {
    setSelectedGender(gender);
  };

  const handleNext = () => {
    if (selectedGender) {
      router.push({
        pathname: '/onboarding/photo',
        params: { 
          displayName: displayName as string,
          birthDate: birthDate as string,
          gender: selectedGender
        }
      });
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFD700" />
          </TouchableOpacity>
          <Text style={styles.headerText}>Main</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.question}>¿Cuál es tu género?</Text>
          <Text style={styles.subtitle}>
            Esta información nos ayuda a personalizar tu experiencia
          </Text>
          
          {/* Gender Options */}
          <View style={styles.optionsContainer}>
            {genderOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  selectedGender === option.id && styles.optionCardSelected
                ]}
                onPress={() => handleGenderSelect(option.id)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={[
                    styles.iconContainer,
                    selectedGender === option.id && styles.iconContainerSelected
                  ]}>
                    <Ionicons 
                      name={option.icon} 
                      size={32} 
                      color={selectedGender === option.id ? '#000000' : '#FFD700'} 
                    />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[
                      styles.optionLabel,
                      selectedGender === option.id && styles.optionLabelSelected
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.optionDescription,
                      selectedGender === option.id && styles.optionDescriptionSelected
                    ]}>
                      {option.description}
                    </Text>
                  </View>
                  {selectedGender === option.id && (
                    <View style={styles.checkmarkContainer}>
                      <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>

        {/* Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, !selectedGender && styles.buttonDisabled]} 
            onPress={handleNext}
            disabled={!selectedGender}
          >
            <Text style={styles.buttonText}>Siguiente</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  question: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    padding: 20,
    marginHorizontal: 10,
  },
  optionCardSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: '#FFD700',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: '#FFD700',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: '#FFD700',
  },
  optionDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 18,
  },
  optionDescriptionSelected: {
    color: '#FFFFFF',
  },
  checkmarkContainer: {
    marginLeft: 12,
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
