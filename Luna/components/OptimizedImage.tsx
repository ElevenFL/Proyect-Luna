import React, { memo, useState, useEffect } from 'react';
import { Image, ImageProps, ImageStyle } from 'expo-image';
import { StyleProp, View, ActivityIndicator } from 'react-native';
import { ImageService } from '../services/imageService';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  uri: string;
  placeholder?: string;
  fallback?: string;
  style?: StyleProp<ImageStyle>;
  cachePolicy?: 'memory' | 'disk' | 'memory-disk' | 'none';
  priority?: 'low' | 'normal' | 'high';
  showLoadingIndicator?: boolean;
}

const OptimizedImageComponent: React.FC<OptimizedImageProps> = ({
  uri,
  placeholder,
  fallback,
  style,
  cachePolicy = 'memory-disk',
  priority = 'normal',
  showLoadingIndicator = false,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Solo usar la URI actual si no hay error, de lo contrario usar fallback
  const imageUri = hasError && fallback ? fallback : uri;

  const handleLoadStart = () => {
    // No cambiar isLoading aquí para evitar parpadeo
  };

  const handleLoadEnd = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  return (
    <View style={style}>
      <Image
        source={{
          uri: imageUri,
          headers: {
            'Cache-Control': 'max-age=31536000', // 1 año de cache
          },
        }}
        placeholder={placeholder}
        style={[{ width: '100%', height: '100%' }, style]}
        cachePolicy={cachePolicy}
        priority={priority}
        contentFit="cover"
        transition={0} // Eliminar transición completamente para evitar parpadeo
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        {...props}
      />
      
      {/* Indicador de carga opcional - solo mostrar si no se ha cargado y se solicita */}
      {showLoadingIndicator && !isLoaded && !hasError && (
        <View 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.1)',
          }}
        >
          <ActivityIndicator size="small" color="#F9C80E" />
        </View>
      )}
    </View>
  );
};

// Memoizar el componente para evitar re-renders innecesarios
export const OptimizedImage = memo(OptimizedImageComponent);

export default OptimizedImage;
