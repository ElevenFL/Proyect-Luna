import React from 'react';
import { Image, ImageProps, StyleProp, ImageStyle } from 'expo-image';
import { ImageService } from '../services/imageService';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  uri: string;
  placeholder?: string;
  fallback?: string;
  style?: StyleProp<ImageStyle>;
  cachePolicy?: 'memory' | 'disk' | 'memory-disk' | 'none';
  priority?: 'low' | 'normal' | 'high';
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  placeholder,
  fallback,
  style,
  cachePolicy = 'memory-disk',
  priority = 'normal',
  ...props
}) => {
  // Generar un hash único para el cacheo
  const cacheKey = ImageService.generateImageHash(uri);

  return (
    <Image
      source={{
        uri,
        headers: {
          'Cache-Control': 'max-age=31536000', // 1 año de cache
        },
      }}
      placeholder={placeholder}
      fallback={fallback}
      style={style}
      cachePolicy={cachePolicy}
      priority={priority}
      contentFit="cover"
      transition={200}
      {...props}
    />
  );
};

export default OptimizedImage;
