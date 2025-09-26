import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FilterOptions } from '@/components/FilterModal';

const FILTER_STORAGE_KEY = 'user_search_filters';

const defaultFilters: FilterOptions = {
  ageRange: [18, 99],
  gender: 'all',
  countries: []
};

export const useFilterPersistence = () => {
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar filtros guardados al inicializar
  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedFilters = await AsyncStorage.getItem(FILTER_STORAGE_KEY);
      
      if (storedFilters) {
        const parsedFilters = JSON.parse(storedFilters);
        console.log('🔍 Filtros cargados desde AsyncStorage:', parsedFilters);
        setFilters(parsedFilters);
      } else {
        console.log('🔍 No hay filtros guardados, usando valores por defecto');
        setFilters(defaultFilters);
      }
    } catch (error) {
      console.error('❌ Error cargando filtros:', error);
      setFilters(defaultFilters);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveFilters = useCallback(async (newFilters: FilterOptions) => {
    try {
      await AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(newFilters));
      setFilters(newFilters);
      console.log('💾 Filtros guardados en AsyncStorage:', newFilters);
    } catch (error) {
      console.error('❌ Error guardando filtros:', error);
    }
  }, []);

  const resetFilters = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(FILTER_STORAGE_KEY);
      setFilters(defaultFilters);
      console.log('🔄 Filtros reseteados a valores por defecto');
    } catch (error) {
      console.error('❌ Error reseteando filtros:', error);
    }
  }, []);

  return {
    filters,
    setFilters: saveFilters,
    resetFilters,
    isLoading,
    loadFilters
  };
};
