import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useStories } from '@/contexts/StoriesContext';

export const StoriesDebugger: React.FC = () => {
  const { stories, isLoading } = useStories();

  if (__DEV__) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔍 Stories Debugger</Text>
        <Text style={styles.subtitle}>Estado actual de las historias</Text>
        
        <View style={styles.statsContainer}>
          <Text style={styles.stat}>📊 Total stories: {stories.length}</Text>
          <Text style={styles.stat}>⏳ Cargando: {isLoading ? 'Sí' : 'No'}</Text>
        </View>

        <ScrollView style={styles.storiesList}>
          {stories.map((story, index) => (
            <View key={story.id} style={styles.storyItem}>
              <Text style={styles.storyTitle}>
                Story #{index + 1} - {story.userName}
              </Text>
              <Text style={styles.storyDetails}>
                ID: {story.id}
              </Text>
              <Text style={styles.storyDetails}>
                Tipo: {story.content.type}
              </Text>
              <Text style={styles.storyDetails}>
                Visto: {story.isViewed ? 'Sí' : 'No'}
              </Text>
              <Text style={styles.storyDetails}>
                Creado: {new Date(story.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.storyDetails}>
                Expira: {new Date(story.expiresAt).toLocaleString()}
              </Text>
              {story.content.type === 'image' && (
                <Text style={styles.storyDetails}>
                  URL: {story.content.data.substring(0, 50)}...
                </Text>
              )}
            </View>
          ))}
          
          {stories.length === 0 && (
            <Text style={styles.emptyText}>
              No hay historias cargadas
            </Text>
          )}
        </ScrollView>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    padding: 12,
    maxHeight: 400,
    zIndex: 1000,
  },
  title: {
    color: '#F9C80E',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#CCCCCC',
    fontSize: 12,
    marginBottom: 12,
  },
  statsContainer: {
    marginBottom: 12,
  },
  stat: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 4,
  },
  storiesList: {
    maxHeight: 300,
  },
  storyItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  storyTitle: {
    color: '#F9C80E',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  storyDetails: {
    color: '#CCCCCC',
    fontSize: 10,
    marginBottom: 2,
  },
  emptyText: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default StoriesDebugger;
