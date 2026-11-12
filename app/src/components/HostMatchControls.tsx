import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { useAuthStore } from '../stores/authStore';
import { useLiveGameStore } from '../stores/liveGameStore';
import { getSocket, isSocketConnected } from '../services/socket';
import { colors, typography, spacing, radii } from '../theme/theme';

/** Host-only: end the running match for everyone (storm, safety problem, etc.). */
export function HostMatchControls() {
  const insets = useSafeAreaInsets();
  const myId = useAuthStore((s) => s.user?.id);
  const gameId = useLiveGameStore((s) => s.gameId);
  const status = useLiveGameStore((s) => s.status);
  const isHost = useLiveGameStore((s) => s.players.some((p) => p.userId === myId && p.isHost));

  if (!isHost || !gameId || (status !== 'running' && status !== 'countdown')) return null;

  const confirmEnd = () =>
    Alert.alert('End match for everyone?', 'All players will be told the match was cancelled. No result or stats are saved.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'End match',
        style: 'destructive',
        onPress: () => {
          if (isSocketConnected()) getSocket().emit(SOCKET_EVENTS.GAME_CANCEL, { gameId });
        },
      },
    ]);

  return (
    <TouchableOpacity style={[styles.pill, { bottom: insets.bottom + 6 }]} onPress={confirmEnd} activeOpacity={0.85}>
      <Text style={styles.text}>⛔ END MATCH (HOST)</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 30,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.signalDanger,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  text: { ...typography.labelMonoSm, color: colors.signalDanger, fontWeight: '700' },
});
