import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { router } from 'expo-router';
import LuneaLogo from '@/components/LuneaLogo';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const handleNext = () => {
    router.push('/onboarding/name');
  };

  return (
    <View style={styles.container}>
      {/* Content */}
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <LuneaLogo width={200} height={80} />
          <Text style={styles.welcomeText}>Welcome to the community.</Text>
        </View>
      </View>

      {/* Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FFD700',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  button: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
