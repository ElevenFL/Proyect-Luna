import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import storiesService, { Story, CreateStoryData } from '@/services/storiesService';

interface StoriesContextType {
  stories: Story[];
  userStories: Story[];
  isLoading: boolean;
  addStory: (content: { type: 'image' | 'text'; data: string; description?: string }, location?: string) => Promise<void>;
  markStoryAsViewed: (storyId: string) => void;
  refreshStories: () => Promise<void>;
  getStoriesByUser: (userId: string) => Story[];
  hasUnviewedStories: boolean;
}

const StoriesContext = createContext<StoriesContextType | undefined>(undefined);

export const useStories = () => {
  const context = useContext(StoriesContext);
  if (!context) {
    throw new Error('useStories debe ser usado dentro de StoriesProvider');
  }
  return context;
};

interface StoriesProviderProps {
  children: ReactNode;
}

export const StoriesProvider: React.FC<StoriesProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Filtrar stories del usuario actual
  const userStories = stories.filter(story => story.userId === user?.id);

  // Verificar si hay stories sin ver
  const hasUnviewedStories = stories.some(story => 
    story.userId !== user?.id && !story.isViewed
  );

  // Cargar stories iniciales
  useEffect(() => {
    if (user?.id) {
      loadStories();
    }
  }, [user?.id]);

  // Listener para cambios en el estado de la app
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('📱 StoriesContext: Cambio de estado de app:', appState, '->', nextAppState);
      
      // Si la app vuelve al primer plano, refrescar stories
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 App vuelve al primer plano, refrescando stories...');
        if (user?.id) {
          loadStories();
        }
      }
      
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [appState, user?.id]);

  // Limpiar stories expirados cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setStories(prevStories => 
        prevStories.filter(story => new Date(story.expiresAt) > new Date())
      );
    }, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, []);

  const loadStories = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Cargando stories activos...');
      
      // Cargar stories activos desde el backend
      const storiesByUser = await storiesService.getAllActiveStories();
      
      console.log('📦 Stories cargados del backend:', storiesByUser.length, 'usuarios');
      
      // Convertir a array plano de stories preservando el orden
      const allStories: Story[] = [];
      
      storiesByUser.forEach(userStories => {
        console.log(`👤 Usuario ${userStories.userName} (ID: ${userStories.userId}) tiene ${userStories.stories.length} stories`);
        
        // Mapear cada story individual agregando userId y userName
        const storiesWithUserInfo = userStories.stories.map(story => ({
          ...story,
          userId: userStories.userId,
          userName: userStories.userName,
          userProfileImage: userStories.userProfileImage
        }));
        
        // Agregar stories en el orden que vienen del backend
        allStories.push(...storiesWithUserInfo);
      });

      // Ordenar por fecha de creación (más recientes primero) para asegurar consistencia
      allStories.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      console.log(`✅ Total de stories cargados: ${allStories.length}`);
      console.log(`📅 Primeros 3 stories (más recientes):`, allStories.slice(0, 3).map(s => ({ 
        id: s.id, 
        userId: s.userId, 
        userName: s.userName,
        createdAt: s.createdAt,
        timestamp: new Date(s.createdAt).getTime()
      })));
      
      setStories(allStories);
    } catch (error) {
      console.error('❌ Error cargando stories:', error);
      // En caso de error, mantener stories vacíos
      setStories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addStory = async (content: { type: 'image' | 'text'; data: string; description?: string }, location?: string) => {
    if (!user) throw new Error('Usuario no autenticado');

    try {
      // Validar contenido del story
      if (!storiesService.validateStoryContent(content)) {
        throw new Error('Contenido del story inválido');
      }

      console.log('Creando story con contenido:', {
        type: content.type,
        dataLength: content.data.length,
        isImageUrl: content.type === 'image' ? content.data.startsWith('http') : false
      });

      // Crear story en el backend
      const newStory = await storiesService.createStory({
        content,
        location
      });

      // Agregar al principio de la lista local (más reciente primero)
      setStories(prevStories => {
        const updatedStories = [newStory, ...prevStories];
        console.log(`✅ Story agregado al principio. Total: ${updatedStories.length}`);
        return updatedStories;
      });
      
      console.log('✅ Story creado exitosamente:', {
        id: newStory.id,
        userId: newStory.userId,
        type: newStory.content.type,
        createdAt: newStory.createdAt,
        hasImage: newStory.content.type === 'image'
      });
    } catch (error) {
      console.error('❌ Error agregando story:', error);
      throw error;
    }
  };

  const markStoryAsViewed = async (storyId: string) => {
    try {
      // Marcar como visto en el backend
      await storiesService.markStoryAsViewed(storyId);
      
      // Actualizar estado local
      setStories(prevStories =>
        prevStories.map(story =>
          story.id === storyId ? { ...story, isViewed: true } : story
        )
      );
    } catch (error) {
      console.error('Error marcando story como visto:', error);
    }
  };

  const refreshStories = async () => {
    await loadStories();
  };

  const getStoriesByUser = useCallback((userId: string) => {
    const userStories = stories.filter(story => story.userId === userId);
    if (userStories.length > 0) {
      console.log(`✅ getStoriesByUser: Encontrados ${userStories.length} stories para userId ${userId}`);
    }
    return userStories;
  }, [stories]);

  const value: StoriesContextType = {
    stories,
    userStories,
    isLoading,
    addStory,
    markStoryAsViewed,
    refreshStories,
    getStoriesByUser,
    hasUnviewedStories,
  };

  return (
    <StoriesContext.Provider value={value}>
      {children}
    </StoriesContext.Provider>
  );
};
