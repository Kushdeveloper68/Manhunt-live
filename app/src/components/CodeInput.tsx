import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  error?: boolean;
}

export const CodeInput: React.FC<CodeInputProps> = ({
  length = 6,
  value,
  onChange,
  style,
  error = false,
}) => {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const cleanValue = value.slice(0, length).toUpperCase();

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <Pressable onPress={handlePress} style={[styles.container, style]}>
      {/* Hidden input taking actual typing */}
      <TextInput
        ref={inputRef}
        value={cleanValue}
        onChangeText={(text) => onChange(text.toUpperCase().slice(0, length))}
        maxLength={length}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
        style={styles.hiddenInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      {/* Rendered boxed cells */}
      <View style={styles.cellsRow}>
        {Array.from({ length }).map((_, index) => {
          const char = cleanValue[index] || '';
          const isCurrentActive = isFocused && cleanValue.length === index;

          return (
            <View
              key={index}
              style={[
                styles.cell,
                isCurrentActive && styles.cellActive,
                error && styles.cellError,
                Boolean(char) && styles.cellFilled,
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  error && styles.cellTextError,
                  Boolean(char) && styles.cellTextFilled,
                ]}
              >
                {char}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  cellsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cell: {
    width: 48,
    height: 56,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    borderColor: colors.accentPrimary,
  },
  cellFilled: {
    borderColor: colors.textSecondary,
  },
  cellError: {
    borderColor: colors.signalDanger,
  },
  cellText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  cellTextFilled: {
    color: colors.accentPrimary,
  },
  cellTextError: {
    color: colors.signalDanger,
  },
});
