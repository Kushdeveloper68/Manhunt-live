import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

export type ToastType = 'info' | 'success' | 'warning' | 'danger';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, onHide, opacity]);

  if (!visible) return null;

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return colors.signalSuccess;
      case 'warning':
        return colors.signalWarning;
      case 'danger':
        return colors.signalDanger;
      case 'info':
      default:
        return colors.accentPrimary;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { borderColor: getBorderColor(), opacity },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderRadius: radii.button,
    paddingVertical: spacing.sm * 1.5,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  message: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
