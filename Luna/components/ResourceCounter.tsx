import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ResourceCounterProps {
  hearts?: number;
  maxHearts?: number;
  stars?: number;
  onHeartPress?: () => void;
  onStarPress?: () => void;
}

export default function ResourceCounter({ 
  hearts = 5, 
  maxHearts = 5, 
  stars = 0,
  onHeartPress,
  onStarPress 
}: ResourceCounterProps) {
  const [nextHeartTime, setNextHeartTime] = useState<number | null>(null);

  useEffect(() => {
    // Simular tiempo hasta el próximo corazón (en desarrollo)
    // En producción, esto vendría del backend
    if (hearts < maxHearts) {
      const nextHeart = Date.now() + (5 * 60 * 60 * 1000); // 5 horas
      setNextHeartTime(nextHeart);
    } else {
      setNextHeartTime(null);
    }
  }, [hearts, maxHearts]);

  const formatTimeRemaining = (timestamp: number) => {
    const now = Date.now();
    const remaining = timestamp - now;
    
    if (remaining <= 0) return '0h 0m';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <View style={styles.container}>
      {/* Hearts Counter */}
      <TouchableOpacity 
        style={styles.resourceContainer} 
        onPress={onHeartPress}
        activeOpacity={0.7}
      >
        <View style={styles.heartContainer}>
          <Ionicons 
            name="heart-outline" 
            size={36} 
            color="#FFFFFF" 
            style={styles.heartIcon}
          />
          <View style={styles.heartTextOverlay}>
            <Text style={styles.heartNumber}>
              {hearts}
            </Text>
            {hearts < maxHearts && nextHeartTime && (
              <Text style={styles.heartTimeText}>
                {formatTimeRemaining(nextHeartTime)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>

       {/* Stars Counter - Hidden */}
       {/* <TouchableOpacity 
         style={styles.resourceContainer} 
         onPress={onStarPress}
         activeOpacity={0.7}
       >
         <LinearGradient
           colors={['#2a2a2a', '#1a1a1a']}
           style={styles.resourceBackground}
           start={{ x: 0, y: 0 }}
           end={{ x: 1, y: 1 }}
         >
           <View style={styles.iconContainer}>
             <Ionicons 
               name="star" 
               size={14} 
               color="#FFD700" 
               style={styles.starIcon}
             />
           </View>
           <View style={styles.textContainer}>
             <Text style={styles.resourceText}>
               {stars.toLocaleString()}
             </Text>
           </View>
         </LinearGradient>
       </TouchableOpacity> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  resourceContainer: {
    width: 50,
    height: 50,
    position: 'relative',
  },
  heartContainer: {
    width: 50,
    height: 50,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartIcon: {
    position: 'absolute',
  },
  heartTextOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  heartNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heartTimeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: -2,
  },
  starIcon: {
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  plusIcon: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: '#00FF88',
    borderRadius: 4,
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timeText: {
    color: '#CCCCCC',
    fontSize: 8,
    marginTop: 1,
  },
});
