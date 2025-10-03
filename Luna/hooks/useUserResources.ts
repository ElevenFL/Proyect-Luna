import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserResources {
  hearts: number;
  maxHearts: number;
  stars: number;
  lastHeartRefill: number;
  heartRefillInterval: number; // en milisegundos (5 horas)
}

const DEFAULT_RESOURCES: UserResources = {
  hearts: 5,
  maxHearts: 5,
  stars: 100, // Usuario comienza con 100 estrellas
  lastHeartRefill: Date.now(),
  heartRefillInterval: 5 * 60 * 60 * 1000, // 5 horas
};

const STORAGE_KEY = 'user_resources';

export function useUserResources() {
  const [resources, setResources] = useState<UserResources>(DEFAULT_RESOURCES);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar recursos desde AsyncStorage
  const loadResources = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedResources = JSON.parse(stored);
        
        // Verificar si necesitamos rellenar corazones
        const now = Date.now();
        const timeSinceLastRefill = now - parsedResources.lastHeartRefill;
        const refillCount = Math.floor(timeSinceLastRefill / parsedResources.heartRefillInterval);
        
        if (refillCount > 0) {
          const newHearts = Math.min(
            parsedResources.maxHearts,
            parsedResources.hearts + refillCount
          );
          
          const updatedResources = {
            ...parsedResources,
            hearts: newHearts,
            lastHeartRefill: parsedResources.lastHeartRefill + (refillCount * parsedResources.heartRefillInterval)
          };
          
          setResources(updatedResources);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedResources));
        } else {
          setResources(parsedResources);
        }
      } else {
        // Primera vez, guardar recursos por defecto
        setResources(DEFAULT_RESOURCES);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_RESOURCES));
      }
    } catch (error) {
      console.error('Error loading user resources:', error);
      setResources(DEFAULT_RESOURCES);
    } finally {
      setIsLoading(false);
    }
  };

  // Guardar recursos en AsyncStorage
  const saveResources = async (newResources: UserResources) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newResources));
      setResources(newResources);
    } catch (error) {
      console.error('Error saving user resources:', error);
    }
  };

  // Usar corazón
  const useHeart = async () => {
    if (resources.hearts > 0) {
      const newResources = {
        ...resources,
        hearts: resources.hearts - 1
      };
      await saveResources(newResources);
      return true;
    }
    return false;
  };

  // Agregar corazones (para compras o recompensas)
  const addHearts = async (amount: number) => {
    const newResources = {
      ...resources,
      hearts: Math.min(resources.maxHearts, resources.hearts + amount)
    };
    await saveResources(newResources);
  };

  // Agregar estrellas
  const addStars = async (amount: number) => {
    const newResources = {
      ...resources,
      stars: resources.stars + amount
    };
    await saveResources(newResources);
  };

  // Usar estrellas
  const useStars = async (amount: number) => {
    if (resources.stars >= amount) {
      const newResources = {
        ...resources,
        stars: resources.stars - amount
      };
      await saveResources(newResources);
      return true;
    }
    return false;
  };

  // Verificar si puede usar un corazón
  const canUseHeart = () => {
    return resources.hearts > 0;
  };

  // Verificar si puede usar estrellas
  const canUseStars = (amount: number) => {
    return resources.stars >= amount;
  };

  // Obtener tiempo hasta el próximo corazón
  const getTimeUntilNextHeart = () => {
    if (resources.hearts >= resources.maxHearts) {
      return null;
    }

    const now = Date.now();
    const timeSinceLastRefill = now - resources.lastHeartRefill;
    const timeUntilNext = resources.heartRefillInterval - (timeSinceLastRefill % resources.heartRefillInterval);
    
    return Date.now() + timeUntilNext;
  };

  // Refrescar recursos (verificar si necesitamos rellenar corazones)
  const refreshResources = async () => {
    await loadResources();
  };

  useEffect(() => {
    loadResources();
  }, []);

  // Timer para rellenar corazones automáticamente
  useEffect(() => {
    if (!isLoading && resources.hearts < resources.maxHearts) {
      const timeUntilNext = getTimeUntilNextHeart();
      
      if (timeUntilNext) {
        const timer = setTimeout(() => {
          refreshResources();
        }, timeUntilNext - Date.now());

        return () => clearTimeout(timer);
      }
    }
  }, [resources.hearts, resources.maxHearts, isLoading]);

  return {
    resources,
    isLoading,
    useHeart,
    addHearts,
    addStars,
    useStars,
    canUseHeart,
    canUseStars,
    getTimeUntilNextHeart,
    refreshResources,
  };
}
