import React, { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { User } from './UserCard';
import { getCountryFlag } from '@/utils/countryFlags';

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

// Lista de países ordenada alfabéticamente con sus banderas disponibles
const DEFAULT_COUNTRIES = [
  'Algeria', 'Argentina', 'Australia', 'Austria',
  'Bangladesh', 'Belgium', 'Bolivia', 'Botswana', 'Brazil', 'Bulgaria',
  'Cambodia', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cuba',
  'Czech Republic', 'Denmark', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Ethiopia',
  'Fiji', 'Finland', 'France',
  'Germany', 'Ghana', 'Greece', 'Guatemala',
  'Haiti', 'Honduras', 'Hong Kong', 'Hungary',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Korea', 'Kuwait',
  'Laos', 'Lebanon', 'Libya',
  'Malaysia', 'Mongolia', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Nigeria', 'Norway',
  'Pakistan', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Romania', 'Russia',
  'Samoa', 'Saudi Arabia', 'Senegal', 'Serbia', 'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Thailand', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Venezuela', 'Vietnam',
  'Zambia', 'Zimbabwe'
];


// Nueva sección para el rango de edad
const AgeSection = memo(({ ageRange, onAgeRangeChange, onAgeRangeCommit }: { ageRange: [number, number]; onAgeRangeChange: (values: number[]) => void; onAgeRangeCommit: (values: number[]) => void }) => {
  const [displayAgeRange, setDisplayAgeRange] = useState(ageRange);

  // useEffect para commitear cambios al finalizar el arrastre
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(displayAgeRange) !== JSON.stringify(ageRange)) {
        onAgeRangeCommit([displayAgeRange[0], displayAgeRange[1]]);
      }
    }, 150); // Pequeño delay para detectar fin de arrastre

    return () => clearTimeout(timer);
  }, [displayAgeRange, ageRange, onAgeRangeCommit]);

  const handleValuesChange = useCallback((values: number[]) => {
    setDisplayAgeRange([values[0], values[1]]);
    if (onAgeRangeChange) onAgeRangeChange(values);
  }, [onAgeRangeChange]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Rango de Edad</Text>
      <View style={styles.ageContainer}>
        <Text style={styles.ageLabel}>
          {displayAgeRange[0]} - {displayAgeRange[1]} años
        </Text>
        
        <View style={styles.rangeSliderContainer}>
          <MultiSlider
            values={[displayAgeRange[0], displayAgeRange[1]]}
            sliderLength={280}
            onValuesChange={handleValuesChange}
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
  );
});

AgeSection.displayName = 'AgeSection';

// Nueva sección para género
const GenderSection = memo(({ selectedGender, onGenderSelect }: { selectedGender: 'all' | 'male' | 'female'; onGenderSelect: (gender: 'all' | 'male' | 'female') => void }) => {
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

  return (
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
            onPress={() => onGenderSelect(gender)}
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
  );
});

GenderSection.displayName = 'GenderSection';

// Nueva sección para países
const CountriesSection = memo(({ 
  selectedCountries, 
  availableCountries, 
  countryData, // Nuevo prop para datos pre-computados
  onCountryToggle, 
  onSelectAll, 
  onClear 
}: { 
  selectedCountries: string[]; 
  availableCountries: string[]; 
  countryData: { country: string; flag: string }[]; 
  onCountryToggle: (country: string) => void; 
  onSelectAll: () => void; 
  onClear: () => void; 
}) => {
   
  return (
    <View style={styles.section}>
      <View style={styles.countriesHeader}>
        <Text style={styles.sectionTitle}>Países</Text>
        <View style={styles.countriesActions}>
          <TouchableOpacity onPress={onSelectAll} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClear} style={styles.actionButton}>
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
          {countryData.map(({ country, flag }) => (
            <TouchableOpacity
              key={country}
              style={styles.countryItem}
              onPress={() => onCountryToggle(country)}
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
                <Text style={styles.countryFlag}>{flag}</Text>
                <Text style={styles.countryText}>{country}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
});

CountriesSection.displayName = 'CountriesSection';


export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApplyFilters,
  currentFilters,
  availableCountries = DEFAULT_COUNTRIES
}) => {
  const [ageRange, setAgeRange] = useState<[number, number]>(
    currentFilters?.ageRange || [18, 99]
  );
  const [selectedGender, setSelectedGender] = useState<'all' | 'male' | 'female'>(
    currentFilters?.gender || 'all'
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    currentFilters?.countries || []
  );
  const [countriesLoaded, setCountriesLoaded] = useState(false);

  // Pre-computar banderas para todos los países una sola vez
  const countryData = useMemo(() => 
    availableCountries.map((country) => ({
      country,
      flag: getCountryFlag(country)
    })), 
    [availableCountries]
  );

  // Lazy load países después del mount inicial del modal
  useEffect(() => {
    if (visible) {
      setCountriesLoaded(false);
      const timer = setTimeout(() => {
        setCountriesLoaded(true);
      }, 100); // Delay pequeño para que el modal se abra primero

      return () => clearTimeout(timer);
    } else {
      setCountriesLoaded(false);
    }
  }, [visible]);

  // Función para guardar filtros automáticamente cuando cambien
  const saveFiltersAutomatically = useCallback(() => {
    const filters: FilterOptions = {
      ageRange,
      gender: selectedGender,
      countries: selectedCountries
    };
    onApplyFilters(filters);
  }, [ageRange, selectedGender, selectedCountries, onApplyFilters]);

  const handleAgeRangeCommit = useCallback((values: number[]) => {
    setAgeRange([values[0], values[1]]);
    // Guardar automáticamente al finalizar el arrastre
    setTimeout(() => {
      saveFiltersAutomatically();
    }, 100);
  }, [saveFiltersAutomatically]);

  const handleAgeRangeChange = useCallback((values: number[]) => {
    // Esta función ahora solo se usa para preview si es necesario, pero no actualiza estado principal
  }, []);

  const handleGenderSelect = useCallback((gender: 'all' | 'male' | 'female') => {
    setSelectedGender(gender);
    // Guardar automáticamente cuando cambie el género
    setTimeout(() => {
      saveFiltersAutomatically();
    }, 100);
  }, [saveFiltersAutomatically]);

  const handleCountryToggle = useCallback((country: string) => {
    setSelectedCountries(prev => {
      const newCountries = prev.includes(country) 
        ? prev.filter(c => c !== country)
        : [...prev, country];
      
      // Guardar automáticamente cuando cambien los países
      setTimeout(() => {
        saveFiltersAutomatically();
      }, 100);
      
      return newCountries;
    });
  }, [saveFiltersAutomatically]);

  const handleSelectAllCountries = useCallback(() => {
    setSelectedCountries(availableCountries);
    // Guardar automáticamente
    setTimeout(() => {
      saveFiltersAutomatically();
    }, 100);
  }, [availableCountries, saveFiltersAutomatically]);

  const handleClearCountries = useCallback(() => {
    setSelectedCountries([]);
    // Guardar automáticamente
    setTimeout(() => {
      saveFiltersAutomatically();
    }, 100);
  }, [saveFiltersAutomatically]);

  const handleApplyFilters = useCallback(() => {
    const filters: FilterOptions = {
      ageRange,
      gender: selectedGender,
      countries: selectedCountries
    };
    onApplyFilters(filters);
    onClose();
  }, [ageRange, selectedGender, selectedCountries, onApplyFilters, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade" // Cambiado a fade para apertura más rápida
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
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Rango de Edad */}
            <AgeSection 
              ageRange={ageRange} 
              onAgeRangeChange={handleAgeRangeChange}
              onAgeRangeCommit={handleAgeRangeCommit}
            />
            
            {/* Género */}
            <GenderSection 
              selectedGender={selectedGender} 
              onGenderSelect={handleGenderSelect} 
            />

            {/* Países - lazy loaded */}
            {countriesLoaded && (
              <CountriesSection 
                selectedCountries={selectedCountries}
                availableCountries={availableCountries}
                countryData={countryData}
                onCountryToggle={handleCountryToggle}
                onSelectAll={handleSelectAllCountries}
                onClear={handleClearCountries}
              />
            )}
          </ScrollView>

          {/* Footer con botones */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilters}>
              <Text style={styles.applyButtonText}>Aplicar</Text>
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
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
    maxHeight: screenHeight * 0.9,
    minHeight: screenHeight * 0.75,
    height: screenHeight * 0.75,
    // Sombra para iOS (reemplazada por boxShadow)
    // shadowColor: '#000000',
    // shadowOffset: {
    //   width: 0,
    //   height: -10,
    // },
    // shadowOpacity: 0.7,
    // shadowRadius: 20,
    // Elevación para Android
    elevation: 20,
    boxShadow: '0px -10px 20px rgba(0, 0, 0, 0.7)',
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
    paddingTop: 10,
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
    gap: 16,
    justifyContent: 'center',
  },
  genderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2f2f2f',
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
  countryFlag: {
    fontSize: 18,
    marginRight: 8,
  },
  countryText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
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
 