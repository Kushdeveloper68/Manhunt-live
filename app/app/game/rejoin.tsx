import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLobbyStore } from '../../src/stores/lobbyStore';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

const GIVE_UP_AFTER_MS = 10_000;

/**
 * Gets a player back into a match they are already part of (app was closed, network dropped):
 * reconnects, asks the server for the current state, then sends them to the right screen.
 */
export default function RejoinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const gameState = useLobbyStore((s) => s.gameState);
  const socketError = useLobbyStore((s) => s.socketError);
  const [failed, setFailed] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (!token || !gameId) return;
    useLobbyStore.getState().joinLobby(token, String(gameId));
    const t = setTimeout(() => {
      if (!handled.current) setFailed('Could not reach the match. It may have ended, or the server is offline.');
    }, GIVE_UP_AFTER_MS);
    return () => clearTimeout(t);
  }, [token, gameId]);

  useEffect(() => {
    if (!gameState || !user || handled.current || gameState.gameId !== String(gameId)) return;
    const me = gameState.players.find((p) => p.userId === user.id);

    if (gameState.status === 'lobby') {
      handled.current = true;
      router.replace({ pathname: me?.isHost ? '/lobby/host' : '/lobby/player', params: { gameId: String(gameId) } });
      return;
    }

    if (gameState.status === 'ended' && !gameState.matchResult) {
      handled.current = true;
      setFailed('This match is already over.');
      return;
    }

    handled.current = true;
    useLiveGameStore.getState().initGame(gameState, user.id);
    if (gameState.status === 'ended') router.replace('/game/gameover');
    else if (me?.status === 'ELIMINATED') router.replace('/game/spectator');
    else router.replace('/game/map');
  }, [gameState, user, gameId, router]);

  const message = failed ?? socketError;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.center}>
        {message ? (
          <>
            <Text style={styles.title}>CAN'T REJOIN</Text>
            <Text style={styles.body}>{message}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.accentPrimary} size="large" />
            <Text style={styles.title}>REJOINING MATCH…</Text>
            <Text style={styles.body}>Reconnecting and syncing the latest state.</Text>
          </>
        )}
      </View>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          useLobbyStore.getState().disconnectLobby();
          router.replace('/home');
        }}
      >
        <Text style={styles.btnText}>{message ? 'BACK TO HOME' : 'CANCEL'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  title: { ...typography.headlineLg, color: colors.textPrimary, textAlign: 'center' },
  body: { ...typography.bodyMd, color: colors.textSecondary, textAlign: 'center', maxWidth: 300 },
  btn: { height: 52, borderRadius: radii.button, borderWidth: 1, borderColor: colors.accentPrimary, alignItems: 'center', justifyContent: 'center' },
  btnText: { ...typography.labelMonoMd, color: colors.accentPrimary, fontWeight: '800' },
});
