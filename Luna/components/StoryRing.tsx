import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface StoryRingProps {
  size?: number;
  hasStory?: boolean;
  isViewed?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function StoryRing({ 
  size = 56, 
  hasStory = false, 
  isViewed = false, 
  children, 
  style 
}: StoryRingProps) {
  // Debug logs (reducidos)
  if (hasStory) {
    console.log(`✅ StoryRing: Renderizando anillo para story (isViewed: ${isViewed})`);
  }
  
  if (!hasStory) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        {children}
      </View>
    );
  }

  const ringWidth = 3;
  const innerSize = size - (ringWidth * 2);

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Anillo de gradiente */}
      <LinearGradient
        colors={
          isViewed 
            ? ['#666666', '#888888', '#666666'] // Gradiente gris para stories vistos
            : ['#F9C80E', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F9C80E'] // Gradiente colorido para stories nuevos
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradientRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          }
        ]}
      >
        {/* Contenido interno */}
        <View
          style={[
            styles.innerContainer,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
            }
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientRing: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3, // Grosor del anillo
  },
  innerContainer: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

