export const ENV = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api',
  AWS: {
    REGION: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-2',
    USER_POOL_ID: process.env.EXPO_PUBLIC_USER_POOL_ID,
    USER_POOL_CLIENT_ID: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
    S3_BUCKET: process.env.EXPO_PUBLIC_S3_BUCKET,
    S3_REGION: process.env.EXPO_PUBLIC_S3_REGION || 'us-east-2',
  }
};

export function validateEnv() {
  const requiredVars = [
    ['USER_POOL_ID', ENV.AWS.USER_POOL_ID],
    ['USER_POOL_CLIENT_ID', ENV.AWS.USER_POOL_CLIENT_ID],
    ['S3_BUCKET', ENV.AWS.S3_BUCKET],
  ];

  const missingVars = requiredVars
    .filter(([_, value]) => !value)
    .map(([name]) => name);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. ` +
      'Please check your .env file and make sure all required variables are set.'
    );
  }
}
