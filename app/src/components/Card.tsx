import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'threat' | 'elevated' | 'active';
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  style,
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'threat':
        return {
          backgroundColor: colors.surface,
          borderColor: colors.signalDanger,
        };
      case 'elevated':
        return {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.borderSubtle,
        };
      case 'active':
        return {
          backgroundColor: colors.surface,
          borderColor: colors.accentPrimary,
        };
      case 'default':
      default:
        return {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
        };
    }
  };

  return (
    <View style={[styles.card, getVariantStyle(), style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
  },
});
