import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

export type ChipVariant = 'neutral' | 'active' | 'chaser' | 'runner' | 'danger';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'neutral',
  style,
  textStyle,
}) => {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'active':
        return {
          container: {
            backgroundColor: colors.canvas,
            borderColor: colors.accentPrimary,
          },
          text: {
            color: colors.accentPrimary,
          },
        };
      case 'chaser':
        return {
          container: {
            backgroundColor: colors.canvas,
            borderColor: colors.roleChaser,
          },
          text: {
            color: colors.roleChaser,
          },
        };
      case 'runner':
        return {
          container: {
            backgroundColor: colors.canvas,
            borderColor: colors.roleRunner,
          },
          text: {
            color: colors.roleRunner,
          },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: colors.canvas,
            borderColor: colors.signalDanger,
          },
          text: {
            color: colors.signalDanger,
          },
        };
      case 'neutral':
      default:
        return {
          container: {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderSubtle,
          },
          text: {
            color: colors.textSecondary,
          },
        };
    }
  };

  const { container, text } = getVariantStyles();

  return (
    <View style={[styles.base, container, style]}>
      <Text style={[styles.text, text, textStyle]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
