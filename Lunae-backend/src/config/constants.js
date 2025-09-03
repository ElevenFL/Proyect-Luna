export const AUTH_CONFIG = {
  JWT_EXPIRATION: '7d',
  PASSWORD_MIN_LENGTH: 6,
  USERNAME_MIN_LENGTH: 3,
  TOKEN_SECRET: process.env.JWT_SECRET || 'default_secret_key_change_in_production'
};

export const IMAGE_CONFIG = {
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  OPTIMIZATION: {
    MAX_WIDTH: 800,
    MAX_HEIGHT: 800,
    QUALITY: 0.8,
    DEFAULT_FORMAT: 'jpeg'
  },
  S3: {
    BUCKET_NAME: process.env.AWS_S3_BUCKET || 'eleven-lunea-storage',
    REGION: process.env.AWS_REGION || 'us-east-2',
    URL_EXPIRATION: {
      UPLOAD: 900, // 15 minutos
      DOWNLOAD: 3600 // 1 hora
    }
  }
};

export const API_CONFIG = {
  PORT: process.env.PORT || 3000,
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 100
  }
};

export const DB_CONFIG = {
  CONNECTION_TIMEOUT: 5000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};
