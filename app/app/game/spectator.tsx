import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { serverNow } from '../../src/stores/liveGameStore';
import { useConnectionStore } from '../../src/stores/connectionStore';
import { formatAge } from '@manhunt/shared';
import { GameMap } from '../../src/components/map/GameMap';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SpectatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const {
    startedAt,
    players,
    teammateLocations,
    runnerSnapshots,
    chaserSnapshots,
    eliminatedData,
    matchEnd,
    resetGame,
  } = useLiveGameStore();
  const connected = useConnectionStore((st) => st.connected);

  // When the match ends while spectating, show the result screen
  useEffect(() => {
    if (matchEnd) {
      router.replace('/game/gameover');
    }
  }, [matchEnd]);

  const [isBannerCollapsed, setIsBannerCollapsed] = useState(false);
  const [selectedOperativeIndex, setSelectedOperativeIndex] = useState(0);
  const [matchElapsedSec, setMatchElapsedSec] = useState(0);
  const [cameraMode, setCameraMode] = useState<'lock' | 'free'>('lock');

  // Compute live match elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (startedAt) {
        setMatchElapsedSec(Math.max(0, Math.floor((serverNow() - startedAt) / 1000)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const activeRunners = useMemo(
    () => players.filter((p) => p.role === 'RUNNER' && p.status === 'ACTIVE'),
    [players]
  );
  const totalRunners = useMemo(
    () => players.filter((p) => p.role === 'RUNNER'),
    [players]
  );
  const activeChasers = useMemo(
    () => players.filter((p) => p.role === 'CHASER' && p.status === 'ACTIVE'),
    [players]
  );

  // Players still in the match, with their real last known position
  const operativeList = useMemo(() => {
    return players
      .filter((p) => p.status === 'ACTIVE')
      .map((p) => {
        const live = teammateLocations.find((l) => l.userId === p.userId);
        const snap = [...runnerSnapshots, ...chaserSnapshots].find((x) => x.userId === p.userId);
        const coords = live?.coordinates ?? snap?.coordinates ?? null;
        const sub = live
          ? `${p.role} • LIVE`
          : snap
            ? `${p.role} • LAST SEEN ${formatAge(serverNow() - snap.timestamp).toUpperCase()}`
            : `${p.role} • NO SIGNAL YET`;
        return { name: `@${p.username.toUpperCase()}`, role: p.role, sub, coords };
      });
  }, [players, teammateLocations, runnerSnapshots, chaserSnapshots, matchElapsedSec]);

  const currentOperative = operativeList.length
    ? operativeList[selectedOperativeIndex % operativeList.length]
    : { name: 'NO PLAYERS', role: 'RUNNER', sub: 'Waiting for players', coords: null as { latitude: number; longitude: number } | null };

  function handlePrevOperative() {
    setSelectedOperativeIndex((prev) =>
      prev === 0 ? Math.max(0, operativeList.length - 1) : prev - 1
    );
  }

  function handleNextOperative() {
    setSelectedOperativeIndex((prev) => (prev + 1) % Math.max(1, operativeList.length));
  }

  function handleExitSession() {
    Alert.alert(
      'LEAVE SPECTATOR MODE',
      'Disconnect satellite stream and exit to lobby? Match telemetry will sync automatically.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DISCONNECT',
          style: 'destructive',
          onPress: () => {
            resetGame();
            router.replace('/home');
          },
        },
      ]
    );
  }

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const outCause = eliminatedData?.taggedBy;
  const outTime = eliminatedData?.taggedAt
    ? new Date(eliminatedData.taggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const outReason =
    outCause === 'ZONE BREACH'
      ? 'REMOVED FOR LEAVING THE ZONE'
      : outCause === 'LEFT GAME'
        ? 'YOU LEFT THE MATCH'
        : outCause === 'FAIR PLAY'
          ? 'REMOVED FOR FAIR-PLAY VIOLATIONS'
          : outCause === 'HOST'
            ? 'REMOVED BY THE HOST'
            : outCause
          ? `TAGGED${outTime ? ` AT ${outTime}` : ''} BY @${outCause.toUpperCase()}`
          : 'YOU ARE OUT OF THE MATCH';

  return (
    <View style={styles.container}>
      {/* Top Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.spectatorBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.spectatorBadgeText}>SPECTATOR MODE</Text>
        </View>

        <TouchableOpacity
          style={styles.exitIconBtn}
          onPress={handleExitSession}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20, color: colors.textSecondary }}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* "YOU'RE OUT" Collapsible Banner */}
        <View style={styles.eliminatedBanner}>
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerLeft}>
              <View style={styles.skullBox}>
                <Text style={{ fontSize: 22 }}>✕</Text>
              </View>
              <View>
                <Text style={styles.bannerHeadline}>YOU'RE OUT</Text>
                <Text style={styles.bannerSub}>
                  {outReason}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.collapseBtn}
              onPress={() => setIsBannerCollapsed(!isBannerCollapsed)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: '#FFD7D7' }}>
                {isBannerCollapsed ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>
          </View>

          {!isBannerCollapsed && (
            <View style={styles.bannerDetailsRow}>
              <View style={styles.satFeedRow}>
                <View style={styles.greenPingDot} />
                <Text style={styles.satFeedText}>NOW IN SPECTATOR FEED</Text>
              </View>
              <Text style={styles.godViewText}>GLOBAL GOD-VIEW GRANTED</Text>
            </View>
          )}
        </View>

        {/* Real-time Match Telemetry Bar */}
        <View style={styles.telemetryCard}>
          <View style={styles.telemetryTopRow}>
            <View style={styles.timerBlock}>
              <Text style={{ fontSize: 16 }}>⏱</Text>
              <Text style={styles.timerText}>{formatTimer(matchElapsedSec)}</Text>
            </View>

            <View style={styles.aliveCounters}>
              <View style={styles.counterItem}>
                <View style={[styles.statusDot, { backgroundColor: colors.roleRunner }]} />
                <Text style={styles.counterText}>
                  {activeRunners.length} / {totalRunners.length} ALIVE
                </Text>
              </View>

              <View style={styles.counterItem}>
                <View style={[styles.statusDot, { backgroundColor: '#C7003A' }]} />
                <Text style={styles.counterText}>
                  {activeChasers.length} HUNTING
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.satLinkBanner}>
            <Text style={styles.satLinkTitle}>LIVE VIEW OF ALL PLAYERS</Text>
            <Text style={styles.satLinkStatus}>{connected ? 'CONNECTED' : 'RECONNECTING'}</Text>
          </View>
        </View>

        {/* Global God-View Tactical Map Viewport */}
        <View style={styles.mapViewport}>
          <GameMap spectator bottomInset={12} focus={cameraMode === 'lock' ? currentOperative.coords : null} />
        </View>

        {/* Tactical Camera Lock Switcher */}
        <View style={styles.cameraLockCard}>
          <TouchableOpacity
            style={styles.navChevronBtn}
            onPress={handlePrevOperative}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>‹</Text>
          </TouchableOpacity>

          <View style={styles.cameraLockInfo}>
            <Text style={styles.lockHeaderLabel}>TACTICAL CAMERA LOCK</Text>
            <Text
              style={[
                styles.lockOperativeName,
                currentOperative.role === 'CHASER'
                  ? { color: '#FF3B5C' }
                  : { color: colors.roleRunner },
              ]}
            >
              {currentOperative.name}
            </Text>
            <Text style={styles.lockOperativeSub}>{currentOperative.sub}</Text>
          </View>

          <TouchableOpacity
            style={styles.navChevronBtn}
            onPress={handleNextOperative}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Tactical Controls */}
        <View style={styles.subControlsRow}>
          <TouchableOpacity
            style={[
              styles.subControlBtn,
              cameraMode === 'free' && styles.subControlBtnActive,
            ]}
            onPress={() => setCameraMode(cameraMode === 'free' ? 'lock' : 'free')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>📐</Text>
            <Text style={styles.subControlText}>
              {cameraMode === 'free' ? 'LOCKED DRONE' : 'FREE DRONE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subControlBtn}
            onPress={() => Alert.alert('KILL FEED', 'All 8 past eliminations logged')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>👥</Text>
            <Text style={styles.subControlText}>KILL FEED</Text>
          </TouchableOpacity>
        </View>

        {/* Giant Leave Session CTA */}
        <TouchableOpacity
          style={styles.leaveSessionBtn}
          activeOpacity={0.88}
          onPress={handleExitSession}
        >
          <Text style={{ fontSize: 20 }}>🚪</Text>
          <Text style={styles.leaveSessionText}>LEAVE GAME SESSION</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const fontMono = typography.labelMonoSm.fontFamily;
const fontHeadline = typography.headlineMd.fontFamily;
const fontBody = typography.bodyMd.fontFamily;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#0E0E0ECC',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    zIndex: 10,
  },
  spectatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C7003A',
  },
  spectatorBadgeText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  exitIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  eliminatedBanner: {
    backgroundColor: '#C7003A',
    borderRadius: radii.card,
    padding: spacing.md,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  skullBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerHeadline: {
    fontFamily: fontHeadline,
    fontSize: 22,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  bannerSub: {
    fontFamily: fontMono,
    fontSize: 11,
    color: '#FFDADA',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  collapseBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  satFeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  greenPingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  satFeedText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  godViewText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: '#FFDADA',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  telemetryCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  telemetryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerText: {
    fontFamily: fontMono,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  aliveCounters: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  counterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  counterText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  satLinkBanner: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  satLinkTitle: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  satLinkStatus: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.accentPrimary,
    fontWeight: 'bold',
  },
  mapViewport: {
    width: '100%',
    height: 380,
    backgroundColor: '#0A0A0A',
    borderRadius: radii.card,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  safeZoneCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(198, 255, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeZoneDashed: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeZonePill: {
    backgroundColor: 'rgba(14, 14, 14, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  safeZoneText: {
    fontFamily: fontMono,
    fontSize: 9,
    color: colors.accentPrimary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  restrictedSectorChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#93000A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restrictedSectorText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: '#FFDAD6',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  fellHereMarker: {
    position: 'absolute',
    top: '42%',
    left: '46%',
    alignItems: 'center',
  },
  fellHereIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#93000A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fellHerePill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 3,
  },
  fellHereText: {
    fontFamily: fontMono,
    fontSize: 9,
    color: '#FF3B30',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  operativeMarker: {
    position: 'absolute',
    alignItems: 'center',
  },
  runnerPingHalo: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(47, 217, 244, 0.3)',
    top: -4,
  },
  runnerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.roleRunner,
  },
  runnerTag: {
    marginTop: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
    fontFamily: fontMono,
    fontSize: 9,
    color: colors.roleRunner,
    fontWeight: 'bold',
  },
  chaserChevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#C7003A',
  },
  chaserTag: {
    marginTop: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
    fontFamily: fontMono,
    fontSize: 9,
    color: '#FF3B5C',
    fontWeight: 'bold',
  },
  radarWatermark: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(32, 31, 31, 0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  radarText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  cameraLockCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  navChevronBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLockInfo: {
    alignItems: 'center',
    gap: 2,
  },
  lockHeaderLabel: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  lockOperativeName: {
    fontFamily: fontHeadline,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  lockOperativeSub: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
  },
  subControlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  subControlBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  subControlBtnActive: {
    borderColor: colors.accentPrimary,
  },
  subControlText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  leaveSessionBtn: {
    height: 52,
    backgroundColor: '#93000A',
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  leaveSessionText: {
    fontFamily: fontBody,
    fontSize: 15,
    color: '#FFDAD6',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
