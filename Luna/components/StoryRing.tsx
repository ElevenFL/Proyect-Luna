import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface StoryRingProps {
  size?: number;
  hasStory?: boolean;
  isViewed?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  borderRadius?: number;
  gapColor?: string; // color del espacio entre anillo e imagen
}

export default function StoryRing({ 
  size = 60, 
  hasStory = false, 
  isViewed = false, 
  children, 
  style,
  borderRadius = 16,
  gapColor = '#1a1a1a' // negro por defecto como en tu imagen
}: StoryRingProps) {
  
  if (!hasStory) {
    return (
      <View style={[
        styles.container, 
        { width: size, height: size, borderRadius }, 
        style
      ]}>
        {children}
      </View>
    );
  }

  const ringWidth = 3;       // grosor del anillo
  const gap = 3;             // separación real entre anillo e imagen

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Anillo de gradiente - posicionado para no afectar el layout */}
      <LinearGradient
        colors={
          isViewed 
            ? ['#D2D5F9','#2f2f2f'] // gris para vistos
            : ['#D2D5F9', '#F9C80E']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: 'absolute',
          width: size + (ringWidth * 2) + (gap * 2),
          height: size + (ringWidth * 2) + (gap * 2),
          borderRadius: borderRadius + ringWidth + gap,
          top: -ringWidth - gap,
          left: -ringWidth - gap,
          zIndex: -1,
        }}
      />

      {/* Capa intermedia = espacio de separación */}
      <View
        style={{
          position: 'absolute',
          top: -gap,
          left: -gap,
          width: size + (gap * 2),
          height: size + (gap * 2),
          borderRadius: borderRadius + gap,
          backgroundColor: gapColor, // aquí se ve el "gap"
          zIndex: -1,
        }}
      />

      {/* Imagen interna - mantiene su posición original */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
        }}
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
});


