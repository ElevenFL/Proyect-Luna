export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.11:3000/api',
  TIMEOUT: 30000, // 30 segundos
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // 1 segundo
    BACKOFF_FACTOR: 2 // Multiplicador para el retraso entre intentos
  },
  IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    OPTIMIZATION: {
      MAX_WIDTH: 800,
      MAX_HEIGHT: 800,
      QUALITY: 0.8,
      DEFAULT_FORMAT: 'jpeg' as const
    },
    FOLDERS: {
      PROFILE: 'profile-images',
      POSTS: 'post-images',
      MESSAGES: 'message-images'
    }
  }
};
