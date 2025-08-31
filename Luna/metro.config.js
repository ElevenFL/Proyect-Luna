const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for Firebase modules
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configure resolver to handle Firebase modules properly
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add support for .cjs files
config.resolver.sourceExts.push('cjs');

// Configure asset extensions
config.resolver.assetExts.push(
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  // Fonts
  'ttf', 'otf', 'woff', 'woff2',
  // Other assets
  'mp3', 'mp4', 'wav', 'aac', 'm4a'
);

module.exports = config;
