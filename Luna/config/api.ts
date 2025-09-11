export const API_CONFIG = {
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
  TIMEOUT: 15000, // Reducido a 15 segundos para fallar más rápido
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000, // Delay inicial de 1 segundo
    MAX_DELAY: 5000, // Máximo delay de 5 segundos
    BACKOFF_FACTOR: 1.5, // Factor de backoff más suave
    JITTER: 500 // Jitter máximo en ms para evitar thundering herd
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
