import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { PanGestureHandler, State, Directions } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import StoryPost from '@/components/StoryPost';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useCommunity, CommunitySection } from '@/hooks/useCommunity';
import { Story } from '@/services/storiesService';

export default function CommunityScreen() {
  const [activeSection, setActiveSection] = useState<CommunitySection>('recent');
  const { 
    recent, 
    trending, 
    friends, 
    isLoading, 
    error, 
    getStoriesBySection, 
    refreshSection 
  } = useCommunity();

  const sections = [
    { key: 'recent' as CommunitySection, title: 'Recientes', icon: 'time-outline' },
    { key: 'trending' as CommunitySection, title: 'Tendencia', icon: 'trending-up-outline' },
    { key: 'friends' as CommunitySection, title: 'Amigos', icon: 'people-outline' },
  ];

  const currentStories = getStoriesBySection(activeSection);

  const handleSwipeGesture = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      const threshold = 50; // Mínimo de píxeles para considerar el swipe
      
      if (Math.abs(translationX) > threshold) {
        const currentIndex = sections.findIndex(s => s.key === activeSection);
        
        if (translationX > 0 && currentIndex > 0) {
          // Swipe hacia la derecha - ir al tab anterior
          setActiveSection(sections[currentIndex - 1].key);
        } else if (translationX < 0 && currentIndex < sections.length - 1) {
          // Swipe hacia la izquierda - ir al tab siguiente
          setActiveSection(sections[currentIndex + 1].key);
        }
      }
    }
  }, [activeSection, sections]);

  const handleRefresh = useCallback(async () => {
    await refreshSection(activeSection);
  }, [activeSection, refreshSection]);

  const handleLike = useCallback((storyId: string) => {
    console.log('Like dado al story:', storyId);
  }, []);

  const handleShare = useCallback((storyId: string) => {
    Alert.alert('Compartir', 'Función de compartir próximamente');
  }, []);

  const renderStory = useCallback(({ item }: { item: Story }) => (
    <StoryPost
      story={item}
      onLike={handleLike}
      onShare={handleShare}
    />
  ), [handleLike, handleShare]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={sections.find(s => s.key === activeSection)?.icon as any || 'time-outline'} 
        size={64} 
        color="#666666" 
      />
      <Text style={styles.emptyTitle}>
        {activeSection === 'recent' && 'No hay historias recientes'}
        {activeSection === 'trending' && 'No hay historias en tendencia'}
        {activeSection === 'friends' && 'No hay historias de amigos'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeSection === 'friends' 
          ? 'Agrega amigos para ver sus historias aquí'
          : 'Las historias aparecerán aquí cuando estén disponibles'
        }
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.tabsContainer}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.key}
            style={[
              styles.tab,
              activeSection === section.key && styles.activeTab
            ]}
            onPress={() => setActiveSection(section.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={section.icon as any}
              size={20}
              color={activeSection === section.key ? '#000000' : '#FFFFFF'}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabText,
                activeSection === section.key && styles.activeTabText
              ]}
            >
              {section.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        {renderHeader()}
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      {renderHeader()}
      
      <PanGestureHandler 
        onGestureEvent={handleSwipeGesture} 
        onHandlerStateChange={handleSwipeGesture}
        activeOffsetX={[-15, 15]}
        activeOffsetY={[-1000, 1000]}
      >
        <View style={styles.gestureContainer}>
          <FlatList
            data={currentStories}
            renderItem={renderStory}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={handleRefresh}
                tintColor="#FFD700"
                colors={['#FFD700']}
              />
            }
            ListEmptyComponent={!isLoading ? renderEmptyState : null}
            ListFooterComponent={
              isLoading && currentStories.length > 0 ? (
                <LoadingSpinner 
                  message="Cargando más historias..." 
                  size="small" 
                />
              ) : null
            }
          />
        </View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  gestureContainer: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 20,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  activeTab: {
    backgroundColor: '#FFD700',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 70, // Espacio adicional para el navbar de abajo
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B6B',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
