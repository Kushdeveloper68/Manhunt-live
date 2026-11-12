import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStatusStore } from '../../src/stores/statusStore';
import { useLobbyStore } from '../../src/stores/lobbyStore';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

const COPY = {
  CANCELLED: { icon: '🚫', title: 'SESSION CANCELLED', tag: 'HOST ENDED THE MATCH' },
  KICKED: { icon: '⛔', title: 'REMOVED FROM LOBBY', tag: 'HOST REMOVED YOU' },
} as const;

/** Full-screen system notice (match cancelled / removed from a lobby). */
export default function StatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notice = useStatusStore((s) => s.notice);

  if (!notice) return <Redirect href="/home" />;
  const copy = COPY[notice.type];

  const goHome = () => {
    useStatusStore.getState().clearNotice();
    useLobbyStore.getState().disconnectLobby(); // drops the socket and clears lobby state
    useLiveGameStore.getState().resetGame();
    router.replace('/home');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.center}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>{copy.icon}</Text>
        </View>
        <Text style={styles.tag}>{copy.tag}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.message}>{notice.message}</Text>
      </View>

      <TouchableOpacity style={styles.primary} onPress={goHome} activeOpacity={0.88}>
        <Text style={styles.primaryText}>RETURN HOME</Text>
      </TouchableOpacity>
      {notice.type === 'KICKED' && (
        <TouchableOpacity style={styles.secondary} onPress={() => router.push('/legal/terms')} activeOpacity={0.88}>
          <Text style={styles.secondaryText}>READ SAFETY POLICY</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  iconBox: {
    width: 96,
    height: 96,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.signalDanger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 44 },
  tag: { ...typography.labelMonoSm, color: colors.signalDanger, letterSpacing: 1.2 },
  title: { ...typography.headlineLg, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.bodyMd, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  primary: { backgroundColor: colors.accentPrimary, borderRadius: radii.button, height: 52, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...typography.labelMonoMd, color: colors.textInverse, fontWeight: '800' },
  secondary: { marginTop: spacing.sm, height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...typography.labelMonoSm, color: colors.textSecondary, textDecorationLine: 'underline' },
});
