import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLobbyStore } from '../../src/stores/lobbyStore';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

export default function RoleRevealCountdownScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const lobbyState = useLobbyStore((s) => s.gameState);
  const {
    myRole,
    status,
    countdownRemainingMs,
    initGame,
  } = useLiveGameStore();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const radarSpin = useRef(new Animated.Value(0)).current;

  // Local simulated countdown fallback if server ticks haven't arrived yet
  const [localSeconds, setLocalSeconds] = useState(
    lobbyState?.settings?.headStartMin ? lobbyState.settings.headStartMin * 60 : 180
  );

  // Pulse jitter for heart rate telemetry (±4 BPM)
  const [pulseRate, setPulseRate] = useState(142);

  useEffect(() => {
    if (lobbyState && user) {
      initGame(lobbyState, user.id);
    }
  }, [lobbyState, user]);

  // Pulse & Radar animations
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(radarSpin, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();

    const bpmTimer = setInterval(() => {
      setPulseRate(140 + Math.floor(Math.random() * 8));
    }, 2800);

    return () => clearInterval(bpmTimer);
  }, []);

  // Timer countdown management
  useEffect(() => {
    if (countdownRemainingMs > 0) {
      setLocalSeconds(Math.ceil(countdownRemainingMs / 1000));
    } else {
      const interval = setInterval(() => {
        setLocalSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [countdownRemainingMs]);

  // Navigate automatically when match starts running
  useEffect(() => {
    if (status === 'running') {
      router.replace('/game/map');
    }
  }, [status]);

  const isRunner = myRole === 'RUNNER' || myRole === 'UNASSIGNED';
  const roleColor = isRunner ? colors.roleRunner : colors.roleChaser;
  const roleTitle = isRunner ? 'YOU ARE A RUNNER' : 'YOU ARE A CHASER';
  const roleDirective = isRunner
    ? `RUN. CHASERS RELEASE IN ${formatTime(localSeconds)}`
    : `STANDBY. RUNNER HEADSTART ACTIVE (${formatTime(localSeconds)})`;

  function formatTime(totalSec: number) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function handleEnterMap() {
    router.replace('/game/map');
  }

  const spin = radarSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ——— Top Protocol Bar ——— */}
      <View style={styles.topBar}>
        <View style={styles.protocolBadge}>
          <Animated.View style={[styles.dot, { backgroundColor: roleColor, opacity: pulseAnim }]} />
          <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>PROTOCOL 01</Text>
        </View>
        <View style={styles.syncRow}>
          <Text style={{ fontSize: 13, color: colors.accentPrimary }}>📡</Text>
          <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>LIVE SYNC</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ——— Role Identity Hero ——— */}
        <View style={styles.heroSection}>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
            ASSIGNMENT CONFIRMED
          </Text>
          <Text style={[styles.displayHero, { color: roleColor }]}>{roleTitle}</Text>
        </View>

        {/* ——— Headstart Timer & Radar Card ——— */}
        <View style={styles.radarCard}>
          {/* Radar Graphics */}
          <View style={styles.radarContainer}>
            <View style={[styles.outerRadarRing, { borderColor: roleColor }]} />
            <View style={[styles.innerRadarRing, { borderColor: roleColor }]} />
            <Animated.View
              style={[
                styles.radarSweep,
                { borderRightColor: roleColor, transform: [{ rotate: spin }] },
              ]}
            />
          </View>

          {/* Large Countdown Clock */}
          <View style={styles.clockCenter}>
            <Text style={styles.clockText}>{formatTime(localSeconds)}</Text>
            <View style={styles.penStatus}>
              <Animated.View style={[styles.miniDot, { backgroundColor: roleColor }]} />
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                {isRunner ? 'CHASERS LOCKED IN PEN' : 'HUNTER ENCLOSURE ENGAGED'}
              </Text>
            </View>
          </View>
        </View>

        {/* ——— Directive Banner ——— */}
        <View style={[styles.directiveBanner, { borderColor: roleColor }]}>
          <Text style={[styles.labelMonoMd, { color: roleColor, fontFamily: 'JetBrainsMono_700Bold' }]}>
            {roleDirective}
          </Text>
        </View>

        {/* ——— Tactical Parameters Card ——— */}
        <View style={styles.paramCard}>
          <View style={styles.paramRow}>
            <View style={styles.paramLeft}>
              <Text style={{ fontSize: 16 }}>⏱</Text>
              <Text style={[styles.bodySm, { color: colors.textPrimary }]}>
                SURVIVAL REQUIREMENT: 60 MINUTES ON FOOT
              </Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>T-60</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.paramRow}>
            <View style={styles.paramLeft}>
              <Text style={{ fontSize: 16 }}>📡</Text>
              <Text style={[styles.bodySm, { color: colors.textPrimary }]}>
                FIRST GPS PING TO HUNTERS: 02:00 BUFFER
              </Text>
            </View>
            <View style={[styles.pillBadge, { borderColor: roleColor }]}>
              <Text style={[styles.labelMonoSm, { color: roleColor }]}>STEALTH</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.paramRow}>
            <View style={styles.paramLeft}>
              <Text style={{ fontSize: 16 }}>🌐</Text>
              <Text style={[styles.bodySm, { color: colors.textPrimary }]}>
                OPERATIONAL SECTOR: 1.5 KM PERIMETER LIMIT
              </Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>GRID A</Text>
            </View>
          </View>
        </View>

        {/* ——— Live Telemetry Grid ——— */}
        <View style={styles.telemetryGrid}>
          <View style={styles.telemetryCell}>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>GPS ACC</Text>
            <Text style={[styles.labelMonoMd, { color: colors.accentPrimary }]}>±3.1M</Text>
          </View>
          <View style={[styles.telemetryCell, styles.cellBorder]}>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>SECTOR</Text>
            <Text style={[styles.labelMonoMd, { color: colors.textPrimary }]}>C-PARK</Text>
          </View>
          <View style={styles.telemetryCell}>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>PULSE</Text>
            <Text style={[styles.labelMonoMd, { color: colors.signalDanger }]}>{pulseRate} BPM</Text>
          </View>
        </View>
      </ScrollView>

      {/* ——— Sticky Bottom CTA ——— */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: roleColor }]}
          onPress={handleEnterMap}
          activeOpacity={0.88}
        >
          <Text style={[styles.bodyLg, { color: colors.textInverse, fontFamily: 'Inter_700Bold' }]}>
            ENTER TACTICAL MAP →
          </Text>
        </TouchableOpacity>
        <Text style={[styles.labelMonoSm, { color: colors.textSecondary, textAlign: 'center', marginTop: 6 }]}>
          DEVICE IDENT: #{isRunner ? 'RN' : 'CH'}-8820 • ENCRYPTED LIVE CHANNEL
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  displayHero: {
    ...typography.displayHero,
    textAlign: 'center',
  },
  radarCard: {
    backgroundColor: '#0E0E0E',
    borderRadius: radii.card,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  radarContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRadarRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.25,
    position: 'absolute',
  },
  innerRadarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.35,
    position: 'absolute',
  },
  radarSweep: {
    width: 100,
    height: 100,
    position: 'absolute',
    borderRightWidth: 2,
    opacity: 0.4,
  },
  clockCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clockText: {
    fontFamily: 'Anton_400Regular',
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  penStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
  },
  directiveBanner: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  paramCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paramLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: 2,
  },
  telemetryGrid: {
    flexDirection: 'row',
    backgroundColor: '#0E0E0E',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  telemetryCell: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  cellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderSubtle,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.96)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  ctaButton: {
    height: 52,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelMonoSm: {
    ...typography.labelMonoSm,
  },
  labelMonoMd: {
    ...typography.labelMonoMd,
  },
  bodySm: {
    ...typography.bodySm,
  },
  bodyLg: {
    ...typography.bodyLg,
  },
});
