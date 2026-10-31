/**
 * COUNTDOWN SCREEN — Stub for Batch 4
 * Players land here when the host fires game:start.
 * Full implementation in Batch 4 (Role Reveal + Countdown + Live Map).
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, typography, spacing } from '../../src/theme/theme';

export default function CountdownScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accentPrimary} />
      <Text style={styles.title}>MATCH LAUNCHING</Text>
      <Text style={styles.subtitle}>Deploying tactical grid...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.headlineLg,
    color: colors.accentPrimary,
  },
  subtitle: {
    ...typography.labelMonoMd,
    color: colors.textSecondary,
  },
});
