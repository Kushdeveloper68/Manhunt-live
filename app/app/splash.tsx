import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../src/theme/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function SplashScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [progress, setProgress] = useState(14);
  const [satStatus, setSatStatus] = useState('SAT: 14/16');
  const [readyText, setReadyText] = useState('0%');
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start continuous rotation for the crosshair telemetry ring
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      })
    ).start();

    // Telemetry progress simulation
    let current = 14;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 18) + 8;
      if (current >= 100) {
        current = 100;
        setProgress(100);
        setReadyText('READY');
        setSatStatus('SAT: LOCKED');
        clearInterval(interval);

        setTimeout(() => {
          const go = () => {
            const auth = useAuthStore.getState();
            if (!auth.hydrated) {
              setTimeout(go, 100); // saved login still loading
              return;
            }
            router.replace(auth.isAuthenticated ? '/home' : '/onboarding');
          };
          go();
        }, 600);
      } else {
        setProgress(current);
        setReadyText(`${current}%`);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isAuthenticated, router, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Telemetry Header */}
        <View style={styles.topBar}>
          <View style={styles.statusIndicator}>
            <View style={styles.pulseDot} />
            <Text style={styles.topStatusText}>NET.SYS // ACTIVE</Text>
          </View>
          <Text style={styles.versionText}>v2.4.0</Text>
        </View>

        {/* Center Brand & Crosshair */}
        <View style={styles.centerBlock}>
          <View style={styles.crosshairContainer}>
            <Animated.View style={[styles.outerRadarRing, { transform: [{ rotate: spin }] }]}>
              <View style={styles.dashQuarter} />
            </Animated.View>
            <View style={styles.crosshairCenter}>
              <View style={styles.crosshairCrossH} />
              <View style={styles.crosshairCrossV} />
              <View style={styles.crosshairDot} />
            </View>
          </View>

          <Text style={styles.title}>MANHUNT LIVE</Text>
          <Text style={styles.tagline}>THE CITY IS THE ARENA.</Text>

          <View style={styles.tagsRow}>
            <View style={styles.tagPill}>
              <Text style={styles.tagPillText}>GPS LOCKING</Text>
            </View>
            <View style={styles.tagPillSecondary}>
              <Text style={styles.tagPillSecondaryText}>{satStatus}</Text>
            </View>
          </View>
        </View>

        {/* Bottom Loading Progress Bar */}
        <View style={styles.bottomBlock}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.acquiringLabel}>ACQUIRING</Text>
            <Text
              style={[
                styles.percentLabel,
                readyText === 'READY' && styles.readyHighlight,
              ]}
            >
              {readyText}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  topStatusText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 1.5,
  },
  versionText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 1.5,
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  crosshairContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  outerRadarRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(198, 255, 0, 0.25)',
    borderStyle: 'dashed',
  },
  dashQuarter: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 6,
    height: 6,
    backgroundColor: colors.accentPrimary,
    borderRadius: 3,
    marginLeft: -3,
  },
  crosshairCenter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairCrossH: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: colors.accentPrimary,
  },
  crosshairCrossV: {
    position: 'absolute',
    height: 20,
    width: 2,
    backgroundColor: colors.accentPrimary,
  },
  crosshairDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.canvas,
  },
  title: {
    color: colors.textPrimary,
    ...typography.displayHero,
    textAlign: 'center',
  },
  tagline: {
    color: colors.textSecondary,
    ...typography.bodyMd,
    letterSpacing: 2.5,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  tagPill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  tagPillText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    letterSpacing: 0.8,
  },
  tagPillSecondary: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  tagPillSecondaryText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 0.8,
  },
  bottomBlock: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  progressBarTrack: {
    width: 144,
    height: 3,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.pill,
  },
  progressLabels: {
    width: 144,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  acquiringLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  percentLabel: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  readyHighlight: {
    color: colors.accentPrimary,
    fontWeight: '900',
  },
});
