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

  const ringWidth = 2.5;
  const borderRadius = 16;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Anillo de gradiente como fondo */}
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
            borderRadius: borderRadius,
          }
        ]}
      />
      
      {/* Contenido interno posicionado absolutamente */}
      <View
        style={[
          styles.innerContainer,
          {
            width: size - (ringWidth * 2),
            height: size - (ringWidth * 2),
            borderRadius: borderRadius - ringWidth,
            position: 'absolute',
            top: ringWidth,
            left: ringWidth,
          }
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gradientRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  innerContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});

