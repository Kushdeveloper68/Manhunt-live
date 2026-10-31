/**
 * HOST LOBBY SCREEN
 * Stitch screen: "Host Lobby" (76f55b9417bb4a5da6da8d391beb23fc)
 *
 * Layout faithfully matches the Stitch design:
 * - Header: "Host Lobby" title + LOBBY STANDBY pulse + LIVE badge
 * - Room Intel card: game name, zone info, join passcode (copy / share), QR stub
 * - Telemetry bar: player sync count + latency stub
 * - Standby Pool: unassigned players with [Chaser] / [Runner] assignment buttons + auto-assign
 * - Add Operative by callsign input
 * - Chasers roster card (red heading)
 * - Runners roster card (cyan heading)
 * - Sticky bottom: threshold status + START GAME button (disabled until thresholds met)
 * - Player action bottom sheet: make chaser / runner / kick
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Pressable,
  Share,
  Clipboard,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
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

interface PlayerRowProps {
  player: GamePlayer;
  isHost: boolean;
  isCurrentUser: boolean;
  onPress: () => void;
}

function PlayerRow({ player, isHost, isCurrentUser, onPress }: PlayerRowProps) {
  const displayName = `@${player.username.toUpperCase()}`;
  const roleColor =
    player.role === 'CHASER'
      ? colors.roleChaser
      : player.role === 'RUNNER'
        ? colors.roleRunner
        : colors.textSecondary;

  const readyColor = player.ready ? colors.accentPrimary : '#FFB020';
  const readyLabel = player.ready ? 'READY' : 'STANDBY';

  return (
    <TouchableOpacity
      style={styles.playerRow}
      onPress={onPress}
      disabled={isCurrentUser && isHost}
      activeOpacity={0.7}
    >
      <View style={styles.playerRowLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(player.username)}</Text>
          {player.isHost && (
            <View style={styles.crownBadge}>
              <Text style={{ fontSize: 8 }}>👑</Text>
            </View>
          )}
        </View>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.playerName}>{displayName}</Text>
            {player.isHost && (
              <View style={styles.hostPill}>
                <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>HOST</Text>
              </View>
            )}
            {isCurrentUser && !player.isHost && (
              <View style={styles.hostPill}>
                <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
            {player.role !== 'UNASSIGNED' ? player.role : 'Awaiting Assignment'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[styles.readyDot, { backgroundColor: readyColor }]} />
        <Text style={[styles.labelMonoSm, { color: readyColor, fontFamily: 'JetBrainsMono_700Bold' }]}>
          {readyLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface StandbyRowProps {
  player: GamePlayer;
  gameId: string;
  isCurrentUser: boolean;
}

function StandbyRow({ player, gameId, isCurrentUser }: StandbyRowProps) {
  const assignRole = useLobbyStore((s) => s.assignRole);
  const displayName = `@${player.username.toUpperCase()}`;

  return (
    <View style={styles.standbyRow}>
      <View style={styles.playerRowLeft}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={styles.avatarText}>{initials(player.username)}</Text>
        </View>
        <View>
          <Text style={styles.playerName}>{displayName}</Text>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
            GPS Locked • Unallocated
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <TouchableOpacity
          style={styles.assignBtn}
          onPress={() => assignRole(gameId, player.userId, 'CHASER')}
        >
          <Text style={[styles.labelMonoSm, { color: colors.roleChaser, fontFamily: 'JetBrainsMono_700Bold' }]}>
            CHASER
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.assignBtn, { borderColor: colors.roleRunner }]}
          onPress={() => assignRole(gameId, player.userId, 'RUNNER')}
        >
          <Text style={[styles.labelMonoSm, { color: colors.roleRunner, fontFamily: 'JetBrainsMono_700Bold' }]}>
            RUNNER
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HostLobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ gameId: string }>();

  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { gameState, connected, socketError, gameStarted, joinLobby, leaveLobby, kickPlayer, autoAssignRoles, startGame } =
    useLobbyStore();

  const [callsignInput, setCallsignInput] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<GamePlayer | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const addPlayer = useLobbyStore((s) => s.addPlayerByUsername);

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
    if (token && params.gameId) {
      joinLobby(token, params.gameId);
    }
    return () => {
      // Don't auto-leave on unmount — let navigation handle it
    };
  }, [token, params.gameId]);

  useEffect(() => {
    if (gameStarted) {
      router.replace('/game/countdown');
    }
  }, [gameStarted]);

  if (!gameState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accentPrimary} />
        <Text style={[styles.labelMonoSm, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          SYNCING TACTICAL SESSION...
        </Text>
      </View>
    );
  }

  const { gameId, code, name, settings, players } = gameState;

  const unassigned = players.filter((p) => p.role === 'UNASSIGNED');
  const chasers = players.filter((p) => p.role === 'CHASER');
  const runners = players.filter((p) => p.role === 'RUNNER');

  const thresholdsMet =
    chasers.length >= 1 &&
    runners.length >= 1 &&
    unassigned.length === 0 &&
    players.every((p) => p.ready);

  function handleCopyCode() {
    Clipboard.setString(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1800);
  }

  async function handleShare() {
    await Share.share({
      title: `MANHUNT LIVE — ${name}`,
      message: `Join the tactical pursuit grid. Code: ${code}`,
    });
  }

  function openPlayerSheet(player: GamePlayer) {
    if (player.isHost) return;
    setSelectedPlayer(player);
    setSheetVisible(true);
  }

  function handleKick() {
    if (!selectedPlayer) return;
    kickPlayer(gameId, selectedPlayer.userId);
    setSheetVisible(false);
  }

  function handleInvite() {
    const name = callsignInput.trim().replace('@', '');
    if (!name) return;
    addPlayer(gameId, name);
    setCallsignInput('');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ——— Header ——— */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.bodyMd, { color: colors.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Host Lobby</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>LOBBY STANDBY</Text>
          </View>
        </View>
        <View style={styles.livePill}>
          <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>LIVE</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* ——— Error Banner ——— */}
        {socketError && (
          <View style={styles.errorBanner}>
            <Text style={[styles.labelMonoSm, { color: '#FF3B30' }]}>{socketError}</Text>
          </View>
        )}

        {/* ——— Room Intel Card ——— */}
        <View style={[styles.card, { marginTop: spacing.sm }]}>
          <View style={styles.row}>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>TACTICAL SESSION</Text>
            <View style={styles.securedPill}>
              <Animated.View style={[styles.pulseDotSm, { opacity: pulseAnim }]} />
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>SECURED</Text>
            </View>
          </View>
          <Text style={styles.gameTitle}>{name}</Text>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
            Zone Radius {(settings.zone.radius / 1000).toFixed(1)}km²
          </Text>

          {/* Code strip */}
          <View style={styles.codeStrip}>
            <View>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>JOIN PASSCODE</Text>
              <Text style={styles.codeText}>{code}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleCopyCode}>
                <Text style={{ color: codeCopied ? colors.accentPrimary : colors.textPrimary, fontSize: 16 }}>
                  {codeCopied ? '✓' : '⎘'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>⎙</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.accentPrimary }]}>
                <Text style={{ color: colors.accentPrimary, fontSize: 12 }}>QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ——— Telemetry Bar ——— */}
        <View style={styles.telemetryBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.dot, { backgroundColor: colors.accentPrimary }]} />
            <Text style={[styles.labelMonoMd, { color: colors.textPrimary }]}>
              {players.length} OPERATIVES SYNCED
            </Text>
          </View>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </Text>
        </View>

        {/* ——— Standby Pool ——— */}
        {unassigned.length > 0 && (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.sectionHeading}>STANDBY POOL</Text>
                <View style={styles.countBadge}>
                  <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                    {unassigned.length} AWAITING
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.autoAssignBtn}
                onPress={() => autoAssignRoles(gameId)}
              >
                <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>⇌ AUTO-ASSIGN</Text>
              </TouchableOpacity>
            </View>

            {unassigned.map((player) => (
              <StandbyRow
                key={player.userId}
                player={player}
                gameId={gameId}
                isCurrentUser={player.userId === user?.id}
              />
            ))}

            {/* Invite by callsign */}
            <View style={styles.inviteRow}>
              <TextInput
                style={styles.inviteInput}
                placeholder="+ INVITE OPERATIVE BY CALLSIGN"
                placeholderTextColor={colors.textSecondary}
                value={callsignInput}
                onChangeText={setCallsignInput}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleInvite}
              />
              <TouchableOpacity style={styles.pullBtn} onPress={handleInvite}>
                <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>PULL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Also show invite even when standby pool is empty */}
        {unassigned.length === 0 && (
          <View style={[styles.card, { paddingVertical: spacing.sm }]}>
            <View style={styles.inviteRow}>
              <TextInput
                style={styles.inviteInput}
                placeholder="+ INVITE OPERATIVE BY CALLSIGN"
                placeholderTextColor={colors.textSecondary}
                value={callsignInput}
                onChangeText={setCallsignInput}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleInvite}
              />
              <TouchableOpacity style={styles.pullBtn} onPress={handleInvite}>
                <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>PULL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ——— CHASERS Roster ——— */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rosterHeadingPill}>
              <Text style={[styles.headlineSm, { color: colors.roleChaser }]}>
                CHASERS [{chasers.length}]
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>INTERCEPTORS</Text>
          </View>
          {chasers.length === 0 && (
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              No chasers assigned yet
            </Text>
          )}
          {chasers.map((p) => (
            <PlayerRow
              key={p.userId}
              player={p}
              isHost={p.isHost ?? false}
              isCurrentUser={p.userId === user?.id}
              onPress={() => openPlayerSheet(p)}
            />
          ))}
        </View>

        {/* ——— RUNNERS Roster ——— */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rosterHeadingPill, { backgroundColor: 'rgba(34,211,238,0.15)' }]}>
              <Text style={[styles.headlineSm, { color: colors.roleRunner }]}>
                RUNNERS [{runners.length}]
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>PREY GRID</Text>
          </View>
          {runners.length === 0 && (
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              No runners assigned yet
            </Text>
          )}
          {runners.map((p) => (
            <PlayerRow
              key={p.userId}
              player={p}
              isHost={p.isHost ?? false}
              isCurrentUser={p.userId === user?.id}
              onPress={() => openPlayerSheet(p)}
            />
          ))}
        </View>

        <View style={[styles.row, { paddingHorizontal: spacing.sm }]}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>ℹ  </Text>
          <Text style={[styles.bodySm, { color: colors.textSecondary, flex: 1 }]}>
            Tap any operative to reassign squad, swap role, or kick from grid.
          </Text>
        </View>
      </ScrollView>

      {/* ——— Sticky Bottom Bar ——— */}
      <View style={[styles.stickyBottom, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={[
                styles.dot,
                { backgroundColor: thresholdsMet ? colors.accentPrimary : '#FFB020' },
              ]}
            />
            <Text
              style={[
                styles.labelMonoSm,
                { color: thresholdsMet ? colors.accentPrimary : '#FFB020', fontFamily: 'JetBrainsMono_700Bold' },
              ]}
            >
              {thresholdsMet ? 'THRESHOLDS MET' : 'THRESHOLDS NOT MET'}
            </Text>
          </View>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
            {players.filter((p) => p.ready).length}/{players.length} READY
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.startBtn,
            !thresholdsMet && { backgroundColor: colors.surfaceElevated, opacity: 0.5 },
          ]}
          onPress={() => startGame(gameId)}
          disabled={!thresholdsMet}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.bodyLg,
              { color: thresholdsMet ? colors.textInverse : colors.textSecondary, fontFamily: 'Inter_700Bold' },
            ]}
          >
            🚩  START GAME ({players.filter((p) => p.ready).length} READY) →
          </Text>
        </TouchableOpacity>
      </View>

      {/* ——— Player Action Bottom Sheet ——— */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSheetVisible(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.row}>
              <View>
                <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>OPERATIVE DISPATCH</Text>
                <Text style={styles.headlineSm}>
                  @{selectedPlayer?.username.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSheetVisible(false)} style={styles.closeBtn}>
                <Text style={{ color: colors.textPrimary, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.grid2}>
              <TouchableOpacity
                style={styles.roleActionBtn}
                onPress={() => {
                  if (selectedPlayer) {
                    useLobbyStore.getState().assignRole(gameId, selectedPlayer.userId, 'CHASER');
                  }
                  setSheetVisible(false);
                }}
              >
                <Text style={{ fontSize: 22 }}>🎯</Text>
                <Text style={[styles.labelMonoSm, { color: colors.roleChaser, fontFamily: 'JetBrainsMono_700Bold' }]}>
                  MAKE CHASER
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleActionBtn, { backgroundColor: 'rgba(34,211,238,0.1)', borderColor: colors.roleRunner }]}
                onPress={() => {
                  if (selectedPlayer) {
                    useLobbyStore.getState().assignRole(gameId, selectedPlayer.userId, 'RUNNER');
                  }
                  setSheetVisible(false);
                }}
              >
                <Text style={{ fontSize: 22 }}>🏃</Text>
                <Text style={[styles.labelMonoSm, { color: colors.roleRunner, fontFamily: 'JetBrainsMono_700Bold' }]}>
                  MAKE RUNNER
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.kickBtn} onPress={handleKick}>
              <Text style={[styles.labelMonoSm, { color: '#FF3B30', fontFamily: 'JetBrainsMono_700Bold' }]}>
                ✕  KICK FROM TACTICAL GRID
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  livePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
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
  securedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
  },
  gameTitle: { ...typography.headlineMd, color: colors.textPrimary },
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
    color: colors.accentPrimary,
    letterSpacing: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#262626',
  },
  telemetryBar: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: { width: 10, height: 10, borderRadius: radii.pill },
  sectionHeading: { ...typography.headlineSm, color: colors.textPrimary },
  countBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
  },
  autoAssignBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#262626',
  },
  standbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
  },
  playerRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.labelMonoSm, color: colors.textSecondary },
  crownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.roleChaser,
    alignItems: 'center',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  inviteInput: {
    flex: 1,
    ...typography.labelMonoSm,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  pullBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: radii.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  playerName: { ...typography.bodyMd, color: colors.textPrimary, fontFamily: 'Inter_500Medium' },
  hostPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: '#1C1C1C',
    borderRadius: radii.sm,
  },
  readyDot: { width: 10, height: 10, borderRadius: radii.pill },
  rosterHeadingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,59,92,0.15)',
    borderRadius: radii.pill,
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.97)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: spacing.sm,
  },
  startBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid2: { flexDirection: 'row', gap: spacing.sm },
  roleActionBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,59,92,0.1)',
    borderWidth: 1,
    borderColor: colors.roleChaser,
    alignItems: 'center',
    gap: spacing.xs,
  },
  kickBtn: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,59,48,0.1)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  headlineSm: { ...typography.headlineSm, color: colors.textPrimary },
  labelMonoSm: { ...typography.labelMonoSm, color: colors.textSecondary },
  labelMonoMd: { ...typography.labelMonoMd, color: colors.textPrimary },
  bodyLg: { ...typography.bodyLg, color: colors.textPrimary },
  bodyMd: { ...typography.bodyMd, color: colors.textPrimary },
  bodySm: { ...typography.bodySm, color: colors.textSecondary },
});
