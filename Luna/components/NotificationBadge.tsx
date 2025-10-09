import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NotificationBadgeProps {
  count: number;
  size?: 'small' | 'medium' | 'large';
}

export default function NotificationBadge({ count, size = 'small' }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const getBadgeSize = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          text: styles.smallText,
          minWidth: 16,
          height: 16,
        };
      case 'medium':
        return {
          container: styles.mediumContainer,
          text: styles.mediumText,
          minWidth: 20,
          height: 20,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          text: styles.largeText,
          minWidth: 24,
          height: 24,
        };
      default:
        return {
          container: styles.smallContainer,
          text: styles.smallText,
          minWidth: 16,
          height: 16,
        };
    }
  };

  const badgeConfig = getBadgeSize();
  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <View style={[
      styles.badge,
      badgeConfig.container,
      {
        minWidth: badgeConfig.minWidth,
        height: badgeConfig.height,
      }
    ]}>
      <Text style={[styles.badgeText, badgeConfig.text]}>
        {displayCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
    zIndex: 1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  smallContainer: {
    borderRadius: 8,
  },
  smallText: {
    fontSize: 10,
  },
  mediumContainer: {
    borderRadius: 10,
  },
  mediumText: {
    fontSize: 12,
  },
  largeContainer: {
    borderRadius: 12,
  },
  largeText: {
    fontSize: 14,
  },
});

















