/**
 * PLAYER LOBBY SCREEN
 * Stitch screen: "Player Lobby" (e3eb9bb06f494c65af0be3441b79cd41)
 *
 * Layout matches the Stitch design:
 * - Header: "Player Lobby" title + LOBBY STANDBY pulse + LIVE badge
 * - Mission Intel card: game name, host name, access code (copy)
 * - Role preference selector: [CHASER card] / [RUNNER card] (radio-style)
 * - Operational Status card: your assigned role, waiting message
 * - Squad Overview: Chasers roster, Runners roster (read-only for non-host)
 * - Sticky bottom: "I'M READY" / "STANDBY" toggle button + GPS note
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Clipboard,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GamePlayer } from '@manhunt/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { useLobbyStore } from '../../src/stores/lobbyStore';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

function initials(username: string): string {
  const parts = username.replace('@', '').split('_');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.replace('@', '').slice(0, 2).toUpperCase();
}

interface RosterRowProps {
  player: GamePlayer;
  isCurrentUser: boolean;
  teamColor: string;
}

function RosterRow({ player, isCurrentUser, teamColor }: RosterRowProps) {
  const readyColor = player.ready ? colors.accentPrimary : '#666';
  return (
    <View style={[styles.rosterRow, isCurrentUser && styles.rosterRowHighlight]}>
      <View style={styles.playerRowLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(player.username)}</Text>
          <View style={[styles.roleDot, { backgroundColor: teamColor }]} />
        </View>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.playerName, isCurrentUser && { fontFamily: 'Inter_700Bold' }]}>
              @{player.username.toUpperCase()}
            </Text>
            {player.isHost && (
              <View style={styles.hostPill}>
                <Text style={styles.labelMonoSm}>HOST</Text>
              </View>
            )}
            {isCurrentUser && (
              <View style={[styles.hostPill, { backgroundColor: colors.accentPrimary }]}>
                <Text style={[styles.labelMonoSm, { color: colors.textInverse }]}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={styles.labelMonoSm}>
            {player.role} {player.status === 'DISCONNECTED' ? '• OFFLINE' : ''}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={[styles.dot, { backgroundColor: readyColor }]} />
        <Text style={[styles.labelMonoSm, { color: readyColor, fontFamily: 'JetBrainsMono_700Bold' }]}>
          {player.ready ? 'READY' : 'STANDBY'}
        </Text>
      </View>
    </View>
  );
}

export default function PlayerLobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string; code?: string }>();

  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { gameState, connected, socketError, gameStarted, joinLobby, leaveLobby, setReady, assignRole } =
    useLobbyStore();

  const [codeCopied, setCodeCopied] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (token) {
      joinLobby(token, params.gameId, params.code);
    }
  }, [token, params.gameId, params.code]);

  useEffect(() => {
    if (gameStarted) {
      router.replace('/game/countdown');
    }
  }, [gameStarted]);

  if (!gameState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accentPrimary} />
        <Text style={[styles.labelMonoSm, { marginTop: spacing.sm }]}>
          SYNCING OPERATIONS ROOM...
        </Text>
      </View>
    );
  }

  const { gameId, code, name, players } = gameState;

  const me = players.find((p) => p.userId === user?.id);
  const isReady = me?.ready ?? false;
  const myRole = me?.role ?? 'UNASSIGNED';

  const chasers = players.filter((p) => p.role === 'CHASER');
  const runners = players.filter((p) => p.role === 'RUNNER');

  // Find host display name
  const hostPlayer = players.find((p) => p.isHost);

  function handleCopyCode() {
    Clipboard.setString(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  }

  function handleRolePreference(role: 'CHASER' | 'RUNNER') {
    if (!me) return;
    assignRole(gameId, me.userId, role);
  }

  function handleToggleReady() {
    setReady(gameId, !isReady);
  }

  const roleColor = myRole === 'CHASER' ? colors.roleChaser : myRole === 'RUNNER' ? colors.roleRunner : colors.textSecondary;
  const roleLabel = myRole === 'CHASER' ? 'CHASER SQUAD' : myRole === 'RUNNER' ? 'RUNNER SQUAD' : 'AWAITING ASSIGNMENT';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ——— Header ——— */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            leaveLobby(gameId); // tell the server so you disappear from the host's lobby
            router.replace('/home');
          }}
          style={styles.backBtn}
        >
          <Text style={[styles.bodyMd, { color: colors.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Player Lobby</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
            <Text style={styles.labelMonoSm}>LOBBY STANDBY</Text>
          </View>
        </View>
        <View style={styles.livePill}>
          <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>LIVE</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* ——— Error Banner ——— */}
        {socketError && (
          <View style={styles.errorBanner}>
            <Text style={[styles.labelMonoSm, { color: '#FF3B30' }]}>{socketError}</Text>
          </View>
        )}

        {/* ——— Mission Intel Card ——— */}
        <View style={[styles.card, { marginTop: spacing.sm }]}>
          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>📡</Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>LIVE OPERATIONS ROOM</Text>
            </View>
            <View style={styles.syncedPill}>
              <Animated.View style={[styles.pulseDotSm, { opacity: pulseAnim }]} />
              <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>SYNCED</Text>
            </View>
          </View>

          <Text style={[styles.headlineLg, { color: colors.textPrimary }]}>{name}</Text>

          {hostPlayer && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.labelMonoSm}>HOST:</Text>
              <Text style={[styles.labelMonoMd, { color: colors.textPrimary }]}>
                @{hostPlayer.username.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Access code copy strip */}
          <View style={styles.codeStrip}>
            <View>
              <Text style={styles.labelMonoSm}>TACTICAL ACCESS CODE</Text>
              <Text style={styles.codeText}>{code}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
              <Text style={[styles.labelMonoSm, { color: codeCopied ? '#3DDC84' : colors.accentPrimary }]}>
                {codeCopied ? '✓ COPIED!' : 'COPY'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ——— Role Preference Selector ——— */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.labelMonoSm}>SELECT PREFERENCE</Text>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>ALGORITHMIC BALANCING</Text>
          </View>

          <View style={styles.grid2}>
            {/* CHASER card */}
            <TouchableOpacity
              style={[
                styles.roleCard,
                myRole === 'CHASER' && { backgroundColor: 'rgba(255,59,92,0.15)', borderColor: colors.roleChaser },
              ]}
              onPress={() => handleRolePreference('CHASER')}
              activeOpacity={0.8}
            >
              <View style={styles.row}>
                <Text style={[styles.headlineSm, { color: colors.roleChaser }]}>CHASER</Text>
                <View
                  style={[
                    styles.radio,
                    myRole === 'CHASER' && { backgroundColor: colors.roleChaser, borderColor: colors.roleChaser },
                  ]}
                >
                  {myRole === 'CHASER' && <View style={styles.radioDot} />}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Text style={{ fontSize: 12 }}>🎯</Text>
                <Text style={[styles.labelMonoSm, { color: colors.roleChaser }]}>HUNTER</Text>
              </View>
              <Text style={[styles.labelMonoSm, { marginTop: spacing.sm }]}>
                {chasers.length} SLOTS FILLED
              </Text>
            </TouchableOpacity>

            {/* RUNNER card */}
            <TouchableOpacity
              style={[
                styles.roleCard,
                myRole === 'RUNNER' && { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: colors.roleRunner },
              ]}
              onPress={() => handleRolePreference('RUNNER')}
              activeOpacity={0.8}
            >
              <View style={styles.row}>
                <Text style={[styles.headlineSm, { color: colors.roleRunner }]}>RUNNER</Text>
                <View
                  style={[
                    styles.radio,
                    myRole === 'RUNNER' && { backgroundColor: colors.roleRunner, borderColor: colors.roleRunner },
                  ]}
                >
                  {myRole === 'RUNNER' && <View style={styles.radioDot} />}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Text style={{ fontSize: 12 }}>🏃</Text>
                <Text style={[styles.labelMonoSm, { color: colors.roleRunner }]}>PREY</Text>
              </View>
              <Text style={[styles.labelMonoSm, { marginTop: spacing.sm }]}>
                {runners.length} SLOTS FILLED
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ——— Operational Status Card ——— */}
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
          <View style={[styles.roleIcon, { borderColor: roleColor }]}>
            <Text style={{ fontSize: 22 }}>{myRole === 'CHASER' ? '🎯' : myRole === 'RUNNER' ? '🏃' : '⌛'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.labelMonoSm}>CURRENT ROSTER:</Text>
              <View style={[styles.roleBadge, { borderColor: roleColor }]}>
                <Text style={[styles.labelMonoSm, { color: roleColor, fontFamily: 'JetBrainsMono_700Bold' }]}>
                  {roleLabel}
                </Text>
              </View>
            </View>
            <Text style={[styles.bodySm, { marginTop: 2 }]}>
              {myRole === 'UNASSIGNED'
                ? 'Request a role or wait for host to assign you'
                : 'Waiting for Host to initiate countdown'}
            </Text>
          </View>
        </View>

        {/* ——— Squad Overview: Chasers ——— */}
        <View style={styles.rosterSection}>
          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.dot, { backgroundColor: colors.roleChaser }]} />
              <Text style={[styles.headlineSm, { color: colors.roleChaser }]}>CHASERS</Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.roleChaser, fontFamily: 'JetBrainsMono_700Bold' }]}>
              {chasers.length} DEPLOYED
            </Text>
          </View>
          {chasers.length === 0 ? (
            <View style={styles.emptyRoster}>
              <Text style={styles.labelMonoSm}>NO CHASERS YET</Text>
            </View>
          ) : (
            chasers.map((p) => (
              <RosterRow
                key={p.userId}
                player={p}
                isCurrentUser={p.userId === user?.id}
                teamColor={colors.roleChaser}
              />
            ))
          )}
        </View>

        {/* ——— Squad Overview: Runners ——— */}
        <View style={[styles.rosterSection, { marginBottom: spacing.md }]}>
          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.dot, { backgroundColor: colors.roleRunner }]} />
              <Text style={[styles.headlineSm, { color: colors.roleRunner }]}>RUNNERS</Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.roleRunner, fontFamily: 'JetBrainsMono_700Bold' }]}>
              {runners.length} DEPLOYED
            </Text>
          </View>
          {runners.length === 0 ? (
            <View style={styles.emptyRoster}>
              <Text style={styles.labelMonoSm}>NO RUNNERS YET</Text>
            </View>
          ) : (
            runners.map((p) => (
              <RosterRow
                key={p.userId}
                player={p}
                isCurrentUser={p.userId === user?.id}
                teamColor={colors.roleRunner}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ——— Sticky Ready Button ——— */}
      <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={[styles.readyBtn, isReady && { backgroundColor: colors.surfaceElevated }]}
          onPress={handleToggleReady}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 20 }}>{isReady ? '⏸' : '✓'}</Text>
          <Text
            style={[
              styles.bodyLg,
              {
                color: isReady ? colors.textSecondary : colors.textInverse,
                fontFamily: 'Inter_700Bold',
              },
            ]}
          >
            {isReady ? 'STANDBY (TAP TO UNREADY)' : "I'M READY (CONFIRM)"}
          </Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12 }}>📍</Text>
          <Text style={[styles.labelMonoSm, { textAlign: 'center' }]}>
            GPS telemetry will activate immediately upon host launch.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 64,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.headlineSm, color: colors.textPrimary },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPrimary,
  },
  pulseDotSm: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPrimary,
  },
  livePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
  },
  scrollArea: { flex: 1, paddingHorizontal: spacing.lg },
  errorBanner: {
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
  },
  headlineLg: { ...typography.headlineLg, color: colors.textPrimary },
  headlineSm: { ...typography.headlineSm, color: colors.textPrimary },
  codeStrip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: {
    ...typography.labelMonoLg,
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  copyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#2a2a2a',
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  grid2: { flexDirection: 'row', gap: spacing.sm },
  roleCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: colors.surfaceElevated,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    backgroundColor: colors.surfaceElevated,
  },
  rosterSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  rosterRowHighlight: { backgroundColor: colors.surfaceElevated },
  emptyRoster: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  playerRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.labelMonoSm, color: colors.textSecondary, fontSize: 10 },
  roleDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  playerName: { ...typography.bodyMd, color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
  hostPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: '#1C1C1C',
    borderRadius: radii.sm,
  },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.97)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: spacing.sm,
  },
  readyBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bodyLg: { ...typography.bodyLg, color: colors.textPrimary },
  bodyMd: { ...typography.bodyMd, color: colors.textPrimary },
  bodySm: { ...typography.bodySm, color: colors.textSecondary },
  labelMonoSm: { ...typography.labelMonoSm, color: colors.textSecondary },
  labelMonoMd: { ...typography.labelMonoMd, color: colors.textSecondary },
});
