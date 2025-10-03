import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

interface EstrellaIconProps {
  size?: number;
  color?: string;
}

export default function EstrellaIcon({ 
  size = 28,
  color = '#FFFFFF'
}: EstrellaIconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('@/assets/estrella.svg')}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        tintColor={color}
      />
    </View>
  );
}

