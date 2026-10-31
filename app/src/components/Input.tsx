import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  onFocus,
  onBlur,
  style,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label.toUpperCase()}</Text>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.focused,
          Boolean(error) && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
  },
  focused: {
    borderColor: colors.accentPrimary,
  },
  inputError: {
    borderColor: colors.signalDanger,
  },
  errorText: {
    color: colors.signalDanger,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
