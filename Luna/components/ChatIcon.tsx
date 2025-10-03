import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

interface ChatIconProps {
  size?: number;
  color?: string;
}

export default function ChatIcon({ 
  size = 28,
  color = '#FFFFFF'
}: ChatIconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('@/assets/Chat.svg')}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        tintColor={color}
      />
    </View>
  );
}
