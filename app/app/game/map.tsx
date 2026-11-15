import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Vibration,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLiveGameStore, serverNow } from '../../src/stores/liveGameStore';
import { useTrackingStore } from '../../src/stores/trackingStore';
import { compassPoint, formatAge, formatDistance, metersInsideZone, nearestOf } from '@manhunt/shared';
import { GameMap, GameMapHandle } from '../../src/components/map/GameMap';
import { ZoneBreachAlert, ZoneBreachVignette, ShrinkWarningBanner, HeadStartBanner } from '../../src/components/map/MapAlerts';
import { startLocationTracking, stopLocationTracking } from '../../src/services/location';
import { colors, typography, spacing, radii } from '../../src/theme/theme';
import { SosBanner } from '../../src/components/SosBanner';
import { HostMatchControls } from '../../src/components/HostMatchControls';
import { useGeofenceHaptics } from '../../src/services/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export default function LiveMapScreen() {
  useGeofenceHaptics();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<GameMapHandle>(null);

  const {
    myRole,
    status,
    startedAt,
    currentZone,
    nextRevealTimestamp,
    nextShrinkTimestamp,
    revealIntervalMin,
    myLocation,
    myHeading,
    mySpeed,
    myAccuracy,
    runnerSnapshots,
    chaserSnapshots,
    players,
    exposedAlert,
    dismissExposedAlert,
    matchEnd,
    pendingTagAttempt,
    eliminatedData,
  } = useLiveGameStore();
  const trackingMode = useTrackingStore((s) => s.mode);

  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const sosTimerRef = useRef<NodeJS.Timeout | null>(null);
  const threatPulseAnim = useRef(new Animated.Value(1)).current;

  // One clock for every countdown, based on the SERVER's time (phone clocks are often wrong)
  const [nowMs, setNowMs] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setNowMs(serverNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const isRunner = myRole === 'RUNNER' || myRole === 'UNASSIGNED';
  const roleColor = isRunner ? colors.roleRunner : colors.roleChaser;

  // Route to tag confirmation flow if pending attempt received
  useEffect(() => {
    if (pendingTagAttempt && isRunner) {
      Vibration.vibrate([100, 200, 100, 200]);
      router.push('/game/tag');
    }
  }, [pendingTagAttempt, isRunner]);

  // Route to spectator mode if eliminated
  useEffect(() => {
    if (eliminatedData) {
      router.replace('/game/spectator');
    }
  }, [eliminatedData]);

  // Start GPS tracking on mount
  useEffect(() => {
    startLocationTracking();
    return () => {
      stopLocationTracking();
    };
  }, []);

  // "You are exposed" banner pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(threatPulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(threatPulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Navigate when game ends
  useEffect(() => {
    if (status === 'ended' && matchEnd) {
      Alert.alert(
        `MATCH OVER: ${matchEnd.winnerRole}S WIN`,
        matchEnd.reason,
        [{ text: 'VIEW SUMMARY', onPress: () => router.replace('/game/gameover') }]
      );
    }
  }, [status, matchEnd]);

  // SOS 3-second hold handler
  function handleSosPressIn() {
    let current = 0;
    sosTimerRef.current = setInterval(() => {
      current += 10;
      setSosProgress(current);
      if (current >= 100) {
        clearInterval(sosTimerRef.current!);
        triggerSosEmergency();
      }
    }, 300);
  }
  function handleSosPressOut() {
    if (sosTimerRef.current) {
      clearInterval(sosTimerRef.current);
      sosTimerRef.current = null;
    }
    setSosProgress(0);
  }
  function triggerSosEmergency() {
    Vibration.vibrate([100, 200, 100, 200]);
    // The SOS screen does the real work: alerts the host, shows honest status, call/SMS actions
    router.push('/game/sos');
  }
  function handleTagAction() {
    Vibration.vibrate([40, 60, 100]);
    router.push('/game/tag');
  }

  // ----- Real numbers for the HUD -----
  const matchElapsedSec = startedAt ? Math.max(0, Math.floor((nowMs - startedAt) / 1000)) : 0;
  const revealRemainingSec = nextRevealTimestamp ? Math.max(0, Math.floor((nextRevealTimestamp - nowMs) / 1000)) : null;
  const revealTotalSec = Math.max(1, revealIntervalMin) * 60;
  const revealFill = revealRemainingSec === null ? 0 : 1 - Math.min(1, revealRemainingSec / revealTotalSec);
  const shrinkRemainingSec = nextShrinkTimestamp ? Math.max(0, Math.floor((nextShrinkTimestamp - nowMs) / 1000)) : null;

  const activeRunners = players.filter((p) => p.role === 'RUNNER' && p.status === 'ACTIVE');
  const totalRunners = players.filter((p) => p.role === 'RUNNER');
  const chasers = players.filter((p) => p.role === 'CHASER');

  const insideM = myLocation && currentZone ? metersInsideZone(myLocation, currentZone) : null;

  // Nearest revealed enemy position (chasers: runner pings, runners: chaser pings in BOTH_WAYS mode)
  const pings = isRunner ? chaserSnapshots : runnerSnapshots;
  const target = myLocation ? nearestOf(myLocation, pings) : null;
  // Arrow points the way: relative to where you are facing while moving, north-up when standing still
  const arrowRot = target ? (target.bearing - (mySpeed > 0.8 ? myHeading : 0) + 360) % 360 : 0;

  const playerStatus = (p: (typeof players)[number]) =>
    p.status === 'ACTIVE' ? (p.role === 'RUNNER' ? 'FREE' : 'ACTIVE') : p.taggedBy === 'ZONE BREACH' || p.taggedBy === 'LEFT GAME' ? 'OUT' : 'TAGGED';

  return (
    <View style={styles.container}>
      <GameMap ref={mapRef} bottomInset={insets.bottom + 150} />
      <ZoneBreachVignette />
      <SosBanner />
      <HostMatchControls />

      {/* Runner: red edge flash right after being revealed */}
      {isRunner && exposedAlert && <View pointerEvents="none" style={styles.dangerVignette} />}

      {/* ——— Floating Top HUD ——— */}
      <View style={[styles.topHudContainer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.hudRow}>
          <View style={styles.hudCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12 }}>⏱</Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>{isRunner ? 'ELAPSED' : 'MATCH CLOCK'}</Text>
            </View>
            <Text style={styles.hudClockText}>{mmss(matchElapsedSec)}</Text>
          </View>

          <View style={[styles.hudCard, { flex: 1.1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.labelMonoSm, { color: colors.roleRunner }]}>{isRunner ? 'REVEAL IN' : 'NEXT REVEAL'}</Text>
              <Text style={[styles.hudClockText, { color: colors.roleRunner }]}>
                {revealRemainingSec === null ? '--:--' : mmss(revealRemainingSec)}
              </Text>
            </View>
            <View style={styles.revealProgressBar}>
              <View style={[styles.revealProgressFill, { width: `${Math.round(revealFill * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.hudCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.miniDot, { backgroundColor: colors.accentPrimary }]} />
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>SHRINK</Text>
            </View>
            <Text style={[styles.hudClockText, { color: colors.accentPrimary }]}>
              {shrinkRemainingSec === null ? 'FINAL' : mmss(shrinkRemainingSec)}
            </Text>
          </View>
        </View>

        <View style={styles.alertStack}>
          <HeadStartBanner role={myRole} />
          <ZoneBreachAlert />
          <ShrinkWarningBanner />

          {/* Nearest revealed position */}
          {target ? (
            <View style={styles.nearestCard}>
              <View style={[styles.nearestArrowBox, { transform: [{ rotate: `${arrowRot}deg` }] }]}>
                <Text style={styles.nearestArrow}>▲</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nearestTitle}>{isRunner ? 'NEAREST CHASER PING' : 'NEAREST RUNNER PING'}</Text>
                <Text style={styles.nearestBody}>
                  {formatDistance(target.meters)} {compassPoint(target.bearing)} · @{target.item.username} ·{' '}
                  {formatAge(nowMs - target.item.timestamp)}
                </Text>
              </View>
            </View>
          ) : !isRunner && status === 'running' ? (
            <View style={styles.nearestCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nearestTitle}>NO PINGS YET</Text>
                <Text style={styles.nearestBody}>
                  Runners stay hidden until the next reveal{revealRemainingSec !== null ? ` in ${mmss(revealRemainingSec)}` : ''}.
                </Text>
              </View>
            </View>
          ) : null}

          {isRunner && exposedAlert && (
            <Animated.View style={[styles.exposedBanner, { opacity: threatPulseAnim }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text style={[styles.headlineSm, { color: colors.textPrimary, fontSize: 14 }]}>YOU WERE REVEALED</Text>
                <View style={styles.criticalPill}>
                  <Text style={[styles.labelMonoSm, { color: colors.signalDanger, fontWeight: 'bold' }]}>MOVE</Text>
                </View>
              </View>
              <TouchableOpacity onPress={dismissExposedAlert} style={styles.closeAlertBtn}>
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Fit-the-whole-zone button */}
      <TouchableOpacity
        style={[styles.recenterBtn, { position: 'absolute', right: 16, bottom: insets.bottom + 150 }]}
        onPress={() => mapRef.current?.fitZone()}
      >
        <Text style={{ fontSize: 16, color: colors.textPrimary }}>🗺</Text>
      </TouchableOpacity>

      {/* ——— Lower Action Zone ——— */}
      <View style={[styles.bottomActionZone, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.sosButton, sosProgress > 0 && styles.sosActive]}
            activeOpacity={0.8}
            onPressIn={handleSosPressIn}
            onPressOut={handleSosPressOut}
          >
            <Text style={[styles.headlineSm, { color: colors.textPrimary, fontSize: 16 }]}>
              {sosProgress > 0 ? `${sosProgress}%` : 'SOS'}
            </Text>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary, fontSize: 9 }]}>HOLD 3S</Text>
          </TouchableOpacity>

          {/* Distance to the zone edge, always real */}
          <View style={styles.zoneEdgeChip}>
            <Text style={{ fontSize: 14 }}>🛡</Text>
            <View>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>ZONE EDGE</Text>
              <Text
                style={[
                  styles.labelMonoSm,
                  { color: insideM !== null && insideM < 0 ? colors.signalDanger : colors.accentPrimary, fontWeight: 'bold' },
                ]}
              >
                {insideM === null ? 'LOCATING…' : insideM >= 0 ? `${formatDistance(insideM)} INSIDE` : `${formatDistance(-insideM)} OUTSIDE`}
              </Text>
            </View>
          </View>

          {!isRunner ? (
            <TouchableOpacity style={styles.giantTagBtn} activeOpacity={0.85} onPress={handleTagAction}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <Text style={[styles.headlineSm, { color: colors.textPrimary, letterSpacing: 1.5 }]}>TAG</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.recenterBtn} onPress={() => mapRef.current?.recenter()}>
              <Text style={{ fontSize: 18, color: colors.textPrimary }}>📍</Text>
            </TouchableOpacity>
          )}
        </View>

        {!isRunner && (
          <TouchableOpacity style={[styles.recenterBtn, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={() => mapRef.current?.recenter()}>
            <Text style={{ fontSize: 18, color: colors.textPrimary }}>🎯</Text>
          </TouchableOpacity>
        )}

        {/* Squad / intel drawer */}
        <TouchableOpacity style={styles.drawerHandleBar} onPress={() => setBottomSheetOpen((v) => !v)}>
          <View style={styles.drawerHandleGrip} />
          <View style={styles.drawerSummaryRow}>
            <Text style={[styles.labelMonoSm, { color: colors.textPrimary, fontWeight: 'bold' }]}>
              {isRunner ? 'RUNNERS SURVIVING' : 'RUNNERS REMAINING'}
            </Text>
            <View style={styles.aliveBadge}>
              <Text style={[styles.labelMonoSm, { color: roleColor, fontWeight: 'bold' }]}>
                {activeRunners.length} / {totalRunners.length} ALIVE
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {bottomSheetOpen && (
          <View style={styles.rosterPanel}>
            <Text style={styles.rosterHeading}>RUNNERS</Text>
            {totalRunners.map((p) => (
              <View key={p.userId} style={styles.rosterRow}>
                <Text style={styles.rosterName}>@{p.username}</Text>
                <Text style={[styles.rosterState, p.status !== 'ACTIVE' && { color: colors.signalDanger }]}>{playerStatus(p)}</Text>
              </View>
            ))}
            <Text style={[styles.rosterHeading, { marginTop: 8 }]}>CHASERS</Text>
            {chasers.map((p) => (
              <View key={p.userId} style={styles.rosterRow}>
                <Text style={styles.rosterName}>@{p.username}</Text>
                <Text style={[styles.rosterState, p.status !== 'ACTIVE' && { color: colors.signalDanger }]}>{playerStatus(p)}</Text>
              </View>
            ))}
            <Text style={styles.rosterMeta}>
              GPS {myAccuracy !== null ? `±${Math.round(myAccuracy)} m` : 'waiting'} ·{' '}
              {trackingMode === 'background' ? 'tracks with screen locked' : trackingMode === 'foreground' ? 'app must stay open' : 'tracking off'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  mapCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E0E0E',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  safeZoneCircle: {
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(190, 245, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeZoneRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    opacity: 0.3,
  },
  safeZoneLabel: {
    position: 'absolute',
    top: 14,
    color: colors.accentPrimary,
    fontSize: 9,
    letterSpacing: 1,
  },
  selfPinContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfHeadingCone: {
    position: 'absolute',
    top: -24,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255,59,92,0.4)',
  },
  selfPinCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.canvas,
  },
  selfLabelPill: {
    position: 'absolute',
    bottom: -20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  teammatePin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  teammateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  runnerPingContainer: {
    position: 'absolute',
    top: '32%',
    right: '18%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runnerPingWave: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.roleRunner,
  },
  runnerPingCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.roleRunner,
  },
  runnerPingTag: {
    position: 'absolute',
    top: 22,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.roleRunner,
  },
  threatEchoContainer: {
    position: 'absolute',
    bottom: '36%',
    left: '20%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threatEchoRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.signalDanger,
  },
  threatEchoCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.signalDanger,
  },
  threatEchoTag: {
    position: 'absolute',
    top: 20,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.signalDanger,
  },
  dangerVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 8,
    borderColor: 'rgba(255, 59, 48, 0.25)',
  },
  topHudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  hudRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  hudCard: {
    flex: 1,
    backgroundColor: 'rgba(28,28,28,0.92)',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 2,
  },
  hudClockText: {
    ...typography.labelMonoLg,
    color: colors.textPrimary,
  },
  revealProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  revealProgressFill: {
    height: '100%',
    backgroundColor: colors.roleRunner,
  },
  compassStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(28,28,28,0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  compassActiveTick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exposedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.signalDanger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  criticalPill: {
    backgroundColor: colors.canvas,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  closeAlertBtn: {
    padding: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  bottomActionZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sosButton: {
    width: 58,
    height: 58,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.signalDanger,
  },
  sosActive: {
    backgroundColor: colors.signalDanger,
  },
  recenterBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  giantTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 58,
    paddingHorizontal: 26,
    borderRadius: radii.card,
    backgroundColor: colors.roleChaser,
    justifyContent: 'center',
    shadowColor: colors.roleChaser,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  zoneEdgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(28,28,28,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  drawerHandleBar: {
    backgroundColor: 'rgba(20,20,20,0.96)',
    borderRadius: radii.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  drawerHandleGrip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSubtle,
  },
  drawerSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  aliveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
  },
  labelMonoSm: {
    ...typography.labelMonoSm,
  },
  labelMonoMd: {
    ...typography.labelMonoMd,
  },
  headlineSm: {
    ...typography.headlineSm,
  },

  alertStack: { marginTop: 8, gap: 8 },
  nearestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: 12,
  },
  nearestArrowBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentPrimary, alignItems: 'center', justifyContent: 'center' },
  nearestArrow: { color: colors.textInverse, fontSize: 18, fontWeight: '900' },
  nearestTitle: { ...typography.labelMonoSm, color: colors.textSecondary, fontWeight: '700' },
  nearestBody: { ...typography.bodyMd, color: colors.textPrimary, fontSize: 13, marginTop: 2 },
  rosterPanel: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 12, marginTop: 8 },
  rosterHeading: { ...typography.labelMonoSm, color: colors.accentPrimary, fontWeight: '800', marginBottom: 4 },
  rosterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rosterName: { ...typography.bodyMd, color: colors.textPrimary, fontSize: 13 },
  rosterState: { ...typography.labelMonoSm, color: colors.textSecondary, fontWeight: '700' },
  rosterMeta: { ...typography.labelMonoSm, color: colors.textSecondary, fontSize: 10, marginTop: 10 },
});
