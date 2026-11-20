import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radii } from '../../theme/theme';
import { mapLibreLoadError } from './maplibre';

const looksLikeMissingNative = (msg: string) => /MLRN|native|not found|UIManager|requireNativeComponent|MapLibre/i.test(msg);

/** Shown instead of the map when it can't render. The rest of the screen keeps working. */
export function MapFallback({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const text = message ?? mapLibreLoadError() ?? 'Unknown map error';
  const needsBuild = looksLikeMissingNative(text);
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🗺</Text>
      <Text style={styles.title}>MAP UNAVAILABLE</Text>
      <Text style={styles.body}>
        {needsBuild
          ? 'This app build does not include the map yet. Install the newest development build (see TESTING.md, step 3).'
          : 'The map could not be drawn. GPS, alerts and the game itself still work.'}
      </Text>
      <Text style={styles.detail} numberOfLines={3}>
        {text}
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
          <Text style={styles.btnText}>RETRY</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E0E0E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  icon: { fontSize: 34 },
  title: { ...typography.labelMonoMd, color: colors.signalWarning, fontWeight: '800', letterSpacing: 1 },
  body: { ...typography.bodyMd, color: colors.textSecondary, textAlign: 'center', maxWidth: 300, fontSize: 13 },
  detail: { ...typography.labelMonoSm, color: colors.textSecondary, textAlign: 'center', maxWidth: 300, fontSize: 10, opacity: 0.7 },
  btn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.accentPrimary, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 8 },
  btnText: { ...typography.labelMonoSm, color: colors.accentPrimary, fontWeight: '800' },
});
