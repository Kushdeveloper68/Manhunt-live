import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'chaser'
  | 'runner';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  labelStyle,
}) => {
  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.accentPrimary,
          borderWidth: 0,
        };
      case 'secondary':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        };
      case 'destructive':
        return {
          backgroundColor: colors.signalDanger,
          borderWidth: 0,
        };
      case 'chaser':
        return {
          backgroundColor: colors.roleChaser,
          borderWidth: 0,
        };
      case 'runner':
        return {
          backgroundColor: colors.roleRunner,
          borderWidth: 0,
        };
      default:
        return {};
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case 'primary':
      case 'chaser':
      case 'runner':
        return {
          color: colors.textInverse,
        };
      case 'secondary':
      case 'destructive':
        return {
          color: colors.textPrimary,
        };
      default:
        return {};
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        getContainerStyle(),
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textInverse : colors.textPrimary}
        />
      ) : (
        <Text style={[styles.label, getTextStyle(), labelStyle]}>
          {label.toUpperCase()}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
