import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { startLocationTracking, stopLocationTracking } from '../../src/services/location';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LiveMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const {
    myRole,
    status,
    startedAt,
    durationMin,
    currentZone,
    nextRevealTimestamp,
    nextShrinkTimestamp,
    myLocation,
    myHeading,
    compassHeading,
    teammateLocations,
    runnerSnapshots,
    players,
    exposedAlert,
    dismissExposedAlert,
    zoneViolation,
    matchEnd,
    pendingTagAttempt,
    eliminatedData,
  } = useLiveGameStore();

  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [sosProgress, setSosProgress] = useState(0);
  const sosTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Animations
  const pingPulseAnim = useRef(new Animated.Value(0)).current;
  const threatPulseAnim = useRef(new Animated.Value(1)).current;
  const sheetTranslateY = useRef(new Animated.Value(140)).current;

  // Local simulated clocks for HUD if timestamps are present
  const [matchElapsedSec, setMatchElapsedSec] = useState(0);
  const [revealCountdownSec, setRevealCountdownSec] = useState(48);
  const [shrinkCountdownSec, setShrinkCountdownSec] = useState(500);

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

  // Ping ring & threat alert animations
  useEffect(() => {
    Animated.loop(
      Animated.timing(pingPulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(threatPulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(threatPulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // 1-second interval for clock updates
    const clockInterval = setInterval(() => {
      const now = Date.now();
      if (startedAt) {
        setMatchElapsedSec(Math.floor((now - startedAt) / 1000));
      }
      if (nextRevealTimestamp) {
        setRevealCountdownSec(Math.max(0, Math.floor((nextRevealTimestamp - now) / 1000)));
      } else {
        setRevealCountdownSec((prev) => (prev > 0 ? prev - 1 : 48));
      }
      if (nextShrinkTimestamp) {
        setShrinkCountdownSec(Math.max(0, Math.floor((nextShrinkTimestamp - now) / 1000)));
      }
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [startedAt, nextRevealTimestamp, nextShrinkTimestamp]);

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
    Alert.alert(
      'EMERGENCY SOS BROADCAST',
      'Live coordinates sent to host and emergency contact.',
      [{ text: 'DISMISS', style: 'cancel' }]
    );
  }

  function handleTagAction() {
    Vibration.vibrate([40, 60, 100]);
    router.push('/game/tag');
  }

  function toggleSheet() {
    const toValue = bottomSheetOpen ? 140 : 0;
    Animated.spring(sheetTranslateY, {
      toValue,
      useNativeDriver: true,
      friction: 8,
    }).start();
    setBottomSheetOpen(!bottomSheetOpen);
  }

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const activeRunners = players.filter((p) => p.role === 'RUNNER' && p.status === 'ACTIVE');
  const totalRunners = players.filter((p) => p.role === 'RUNNER');

  const pingScale = pingPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.2],
  });
  const pingOpacity = pingPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 0],
  });

  return (
    <View style={styles.container}>
      {/* ——— Full Screen Tactical Map Canvas ——— */}
      <View style={styles.mapCanvas}>
        {/* Street Grid Matrix Lines */}
        <View style={styles.gridOverlay}>
          <View style={[styles.gridLineH, { top: '25%' }]} />
          <View style={[styles.gridLineH, { top: '50%' }]} />
          <View style={[styles.gridLineH, { top: '75%' }]} />
          <View style={[styles.gridLineV, { left: '25%' }]} />
          <View style={[styles.gridLineV, { left: '50%' }]} />
          <View style={[styles.gridLineV, { left: '75%' }]} />
        </View>

        {/* Circular Safe Zone Boundary */}
        <View style={styles.safeZoneCircle}>
          <View style={styles.safeZoneRing} />
          <Text style={[styles.labelMonoSm, styles.safeZoneLabel]}>
            SAFE ZONE ACTIVE LIMIT ({(currentZone?.radius || 1500)}M)
          </Text>
        </View>

        {/* Center: Hero Player Pin (YOU) */}
        <View style={styles.selfPinContainer}>
          <View style={[styles.selfHeadingCone, { borderColor: roleColor }]} />
          <View style={[styles.selfPinCore, { backgroundColor: roleColor }]}>
            <View style={styles.innerDot} />
          </View>
          <View style={[styles.selfLabelPill, { backgroundColor: roleColor }]}>
            <Text style={[styles.labelMonoSm, { color: colors.textInverse, fontWeight: 'bold' }]}>
              YOU
            </Text>
          </View>
        </View>

        {/* Teammate Pins */}
        {teammateLocations.map((loc, idx) => (
          <View
            key={loc.userId}
            style={[
              styles.teammatePin,
              {
                top: 180 + idx * 70,
                left: 60 + idx * 120,
              },
            ]}
          >
            <View style={[styles.teammateDot, { backgroundColor: roleColor }]} />
            <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>
              @{loc.username.toUpperCase()}
            </Text>
          </View>
        ))}

        {/* Chaser View: Revealed Runner Pings */}
        {!isRunner && (
          <View style={styles.runnerPingContainer}>
            <Animated.View
              style={[
                styles.runnerPingWave,
                { transform: [{ scale: pingScale }], opacity: pingOpacity },
              ]}
            />
            <View style={styles.runnerPingCore} />
            <View style={styles.runnerPingTag}>
              <Text style={[styles.labelMonoSm, { color: colors.roleRunner, fontWeight: 'bold' }]}>
                LAST SEEN 0:42 AGO (240M NE)
              </Text>
            </View>
          </View>
        )}

        {/* Runner View: Chaser Radar Threat Echo */}
        {isRunner && (
          <View style={styles.threatEchoContainer}>
            <Animated.View
              style={[
                styles.threatEchoRing,
                { transform: [{ scale: pingScale }], opacity: pingOpacity },
              ]}
            />
            <View style={styles.threatEchoCore} />
            <View style={styles.threatEchoTag}>
              <Text style={[styles.labelMonoSm, { color: colors.signalDanger, fontWeight: 'bold' }]}>
                CHASER PING (180M S)
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Runner View: Danger Vignette Overlay */}
      {isRunner && <View pointerEvents="none" style={styles.dangerVignette} />}

      {/* ——— Floating Top HUD Bar ——— */}
      <View style={[styles.topHudContainer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.hudRow}>
          {/* Match Duration Clock */}
          <View style={styles.hudCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12 }}>⏱</Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                {isRunner ? 'ELAPSED' : 'MATCH CLOCK'}
              </Text>
            </View>
            <Text style={styles.hudClockText}>{formatClock(matchElapsedSec)}</Text>
          </View>

          {/* Reveal Countdown Clock */}
          <View style={[styles.hudCard, { flex: 1.1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.labelMonoSm, { color: colors.roleRunner }]}>
                {isRunner ? 'REVEAL IN' : 'NEXT REVEAL'}
              </Text>
              <Text style={[styles.hudClockText, { color: colors.roleRunner }]}>
                {formatClock(revealCountdownSec)}
              </Text>
            </View>
            <View style={styles.revealProgressBar}>
              <View
                style={[
                  styles.revealProgressFill,
                  { width: `${Math.min(100, Math.max(10, (revealCountdownSec / 60) * 100))}%` },
                ]}
              />
            </View>
          </View>

          {/* Shrink Timer */}
          <View style={styles.hudCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Animated.View style={[styles.miniDot, { backgroundColor: colors.accentPrimary }]} />
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>SHRINK</Text>
            </View>
            <Text style={[styles.hudClockText, { color: colors.accentPrimary }]}>
              {formatClock(shrinkCountdownSec)}
            </Text>
          </View>
        </View>

        {/* Chaser View: Compass Strip */}
        {!isRunner && (
          <View style={styles.compassStrip}>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>NW</Text>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>330°</Text>
            <View style={styles.compassActiveTick}>
              <View style={[styles.miniDot, { backgroundColor: colors.accentPrimary }]} />
              <Text style={[styles.labelMonoSm, { color: colors.textPrimary, fontWeight: 'bold' }]}>
                N {String(compassHeading).padStart(3, '0')}°
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>030°</Text>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>NE</Text>
          </View>
        )}

        {/* Runner View: Exposed Alert Banner */}
        {isRunner && exposedAlert && (
          <Animated.View style={[styles.exposedBanner, { opacity: threatPulseAnim }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={[styles.headlineSm, { color: colors.textPrimary, fontSize: 14 }]}>
                YOU ARE EXPOSED
              </Text>
              <View style={styles.criticalPill}>
                <Text style={[styles.labelMonoSm, { color: colors.signalDanger, fontWeight: 'bold' }]}>
                  CRITICAL
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={dismissExposedAlert} style={styles.closeAlertBtn}>
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* ——— Lower Action Zone ——— */}
      <View style={[styles.bottomActionZone, { paddingBottom: insets.bottom + 8 }]}>
        {/* Recenter & Utilities */}
        <View style={styles.actionRow}>
          {/* SOS 3-Second Hold Button */}
          <TouchableOpacity
            style={[styles.sosButton, sosProgress > 0 && styles.sosActive]}
            activeOpacity={0.8}
            onPressIn={handleSosPressIn}
            onPressOut={handleSosPressOut}
          >
            <Text style={[styles.headlineSm, { color: colors.textPrimary, fontSize: 16 }]}>
              {sosProgress > 0 ? `${sosProgress}%` : 'SOS'}
            </Text>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary, fontSize: 9 }]}>
              HOLD 3S
            </Text>
          </TouchableOpacity>

          {/* Center Space: Zone Edge Chip (Runner) or Recenter */}
          {isRunner ? (
            <View style={styles.zoneEdgeChip}>
              <Text style={{ fontSize: 14 }}>🛡</Text>
              <View>
                <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>ZONE EDGE</Text>
                <Text style={[styles.labelMonoSm, { color: colors.accentPrimary, fontWeight: 'bold' }]}>
                  320M INSIDE
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.recenterBtn} onPress={() => {}}>
              <Text style={{ fontSize: 18, color: colors.textPrimary }}>🎯</Text>
            </TouchableOpacity>
          )}

          {/* Chaser GIANT TAG BUTTON */}
          {!isRunner ? (
            <TouchableOpacity
              style={styles.giantTagBtn}
              activeOpacity={0.85}
              onPress={handleTagAction}
            >
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <Text style={[styles.headlineSm, { color: colors.textPrimary, letterSpacing: 1.5 }]}>
                TAG
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.recenterBtn} onPress={() => {}}>
              <Text style={{ fontSize: 18, color: colors.textPrimary }}>📍</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Drawer Handle (Tap to inspect squad roster / intel) */}
        <TouchableOpacity style={styles.drawerHandleBar} onPress={toggleSheet}>
          <View style={styles.drawerHandleGrip} />
          <View style={styles.drawerSummaryRow}>
            <Text style={[styles.labelMonoSm, { color: colors.textPrimary, fontWeight: 'bold' }]}>
              {isRunner ? 'RUNNERS SURVIVING' : 'RUNNERS REMAINING'}
            </Text>
            <View style={styles.aliveBadge}>
              <Text style={[styles.labelMonoSm, { color: roleColor, fontWeight: 'bold' }]}>
                {activeRunners.length} / {totalRunners.length || 1} ALIVE
              </Text>
            </View>
          </View>
        </TouchableOpacity>
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
});
