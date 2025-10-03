import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

interface CasaIconProps {
  size?: number;
  color?: string;
}

export default function CasaIcon({ 
  size = 28,
  color = '#FFFFFF'
}: CasaIconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('@/assets/Home.svg')}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        tintColor={color}
      />
    </View>
  );
}
