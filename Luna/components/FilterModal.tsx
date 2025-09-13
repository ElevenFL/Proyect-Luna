import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { User } from './UserCard';

const { height: screenHeight } = Dimensions.get('window');

export interface FilterOptions {
  ageRange: [number, number];
  gender: 'all' | 'male' | 'female';
  countries: string[];
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterOptions) => void;
  currentFilters?: FilterOptions;
  availableCountries?: string[];
}

// Lista de países disponibles
const DEFAULT_COUNTRIES = [
  'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Chile', 'China',
  'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France',
  'Germany', 'Greece', 'Hungary', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy',
  'Japan', 'Malaysia', 'Mexico', 'Netherlands', 'New Zealand', 'Norway', 'Peru',
  'Poland', 'Portugal', 'Romania', 'Russia', 'Singapore', 'South Korea', 'Spain',
  'Sweden', 'Switzerland', 'Thailand', 'Turkey', 'Ukraine', 'United Kingdom',
  'United States', 'Venezuela'
];

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApplyFilters,
  currentFilters,
  availableCountries = DEFAULT_COUNTRIES
}) => {
  const [ageRange, setAgeRange] = useState<[number, number]>(
    currentFilters?.ageRange || [18, 65]
  );
  const [selectedGender, setSelectedGender] = useState<'all' | 'male' | 'female'>(
    currentFilters?.gender || 'all'
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    currentFilters?.countries || []
  );

  const handleAgeRangeChange = useCallback((values: number[]) => {
    setAgeRange([values[0], values[1]]);
  }, []);

  const handleGenderSelect = useCallback((gender: 'all' | 'male' | 'female') => {
    setSelectedGender(gender);
  }, []);

  const handleCountryToggle = useCallback((country: string) => {
    setSelectedCountries(prev => {
      if (prev.includes(country)) {
        return prev.filter(c => c !== country);
      } else {
        return [...prev, country];
      }
    });
  }, []);

  const handleSelectAllCountries = useCallback(() => {
    setSelectedCountries(availableCountries);
  }, [availableCountries]);

  const handleClearCountries = useCallback(() => {
    setSelectedCountries([]);
  }, []);

  const handleApplyFilters = useCallback(() => {
    const filters: FilterOptions = {
      ageRange,
      gender: selectedGender,
      countries: selectedCountries
    };
    onApplyFilters(filters);
    onClose();
  }, [ageRange, selectedGender, selectedCountries, onApplyFilters, onClose]);


  const getGenderLabel = (gender: 'all' | 'male' | 'female') => {
    switch (gender) {
      case 'all': return 'Todos';
      case 'male': return 'Hombre';
      case 'female': return 'Mujer';
    }
  };

  const getGenderIcon = (gender: 'all' | 'male' | 'female') => {
    switch (gender) {
      case 'all': return 'people-outline';
      case 'male': return 'male-outline';
      case 'female': return 'female-outline';
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.overlay}
        onPress={onClose}
      >
        <Pressable 
          style={styles.modalContainer}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.title}>Filtros</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Rango de Edad */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rango de Edad</Text>
              <View style={styles.ageContainer}>
                <Text style={styles.ageLabel}>
                  {ageRange[0]} - {ageRange[1]} años
                </Text>
                
                <View style={styles.rangeSliderContainer}>
                  <MultiSlider
                    values={[ageRange[0], ageRange[1]]}
                    sliderLength={280}
                    onValuesChange={handleAgeRangeChange}
                    min={18}
                    max={99}
                    step={1}
                    allowOverlap={false}
                    snapped
                    selectedStyle={styles.selectedTrack}
                    unselectedStyle={styles.unselectedTrack}
                    containerStyle={styles.sliderContainer}
                    trackStyle={styles.track}
                    markerStyle={styles.marker}
                    pressedMarkerStyle={styles.pressedMarker}
                    markerContainerStyle={styles.markerContainer}
                  />
                </View>
                
                <View style={styles.ageRangeLabels}>
                  <Text style={styles.ageRangeLabel}>18</Text>
                  <Text style={styles.ageRangeLabel}>99</Text>
                </View>
              </View>
            </View>

            {/* Género */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Género</Text>
              <View style={styles.genderContainer}>
                {(['all', 'male', 'female'] as const).map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderButton,
                      selectedGender === gender && styles.genderButtonSelected
                    ]}
                    onPress={() => handleGenderSelect(gender)}
                  >
                    <Ionicons
                      name={getGenderIcon(gender)}
                      size={20}
                      color={selectedGender === gender ? '#000000' : '#FFFFFF'}
                    />
                    <Text style={[
                      styles.genderButtonText,
                      selectedGender === gender && styles.genderButtonTextSelected
                    ]}>
                      {getGenderLabel(gender)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Países */}
            <View style={styles.section}>
              <View style={styles.countriesHeader}>
                <Text style={styles.sectionTitle}>Países</Text>
                <View style={styles.countriesActions}>
                  <TouchableOpacity onPress={handleSelectAllCountries} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Todos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleClearCountries} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Ninguno</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.countriesContainer}>
                <ScrollView 
                  style={styles.countriesList}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  {availableCountries.map((country) => (
                    <TouchableOpacity
                      key={country}
                      style={styles.countryItem}
                      onPress={() => handleCountryToggle(country)}
                    >
                      <View style={styles.countryItemContent}>
                        <View style={[
                          styles.checkbox,
                          selectedCountries.includes(country) && styles.checkboxSelected
                        ]}>
                          {selectedCountries.includes(country) && (
                            <Ionicons name="checkmark" size={16} color="#000000" />
                          )}
                        </View>
                        <Text style={styles.countryText}>{country}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </ScrollView>

          {/* Footer con botones */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilters}>
              <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: screenHeight * 0.9,
    minHeight: screenHeight * 0.75,
    height: screenHeight * 0.75,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerSpacer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  ageContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
  },
  ageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 16,
  },
  rangeSliderContainer: {
    alignItems: 'center',
    marginVertical: 0,
    paddingHorizontal: 20,
  },
  sliderContainer: {
    height: 50,
  },
  track: {
    height: 4,
    borderRadius: 2,
  },
  selectedTrack: {
    backgroundColor: '#FFD700',
  },
  unselectedTrack: {
    backgroundColor: '#333333',
  },
  marker: {
    backgroundColor: '#FFD700',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pressedMarker: {
    backgroundColor: '#FFD700',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ageRangeLabel: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  genderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  genderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 100,
    justifyContent: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  genderButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  genderButtonTextSelected: {
    color: '#000000',
  },
  countriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  countriesActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '500',
  },
  countriesContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    maxHeight: 200,
  },
  countriesList: {
    maxHeight: 200,
  },
  countryItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  countryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666666',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  countryText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#666666',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
});

export default FilterModal;
 