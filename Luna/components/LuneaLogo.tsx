import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

interface LuneaLogoProps {
  width?: number;
  height?: number;
}

export default function LuneaLogo({ 
  width = 120, 
  height = 40
}: LuneaLogoProps) {
  return (
    <View style={{ width, height }}>
      <Image
        source={require('@/assets/lunea-logo.svg')}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
      />
    </View>
  );
}
