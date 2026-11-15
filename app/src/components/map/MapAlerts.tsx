import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Vibration } from 'react-native';
import { bearingDegrees, compassPoint, distanceMeters, formatDistance } from '@manhunt/shared';
import { useLiveGameStore } from '../../stores/liveGameStore';
import { colors, typography, spacing, radii } from '../../theme/theme';

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/** Re-renders once a second (only while `active`). */
function useSecondTick(active: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

/**
 * Out-of-zone / no-go-zone alert: how far you are, which way to go, what the penalty is and
 * how long you have left. Shown only while the server says you are in breach.
 */
export function ZoneBreachAlert() {
  const violation = useLiveGameStore((s) => s.zoneViolation);
  const myLocation = useLiveGameStore((s) => s.myLocation);
  const zone = useLiveGameStore((s) => s.currentZone);
  const myHeading = useLiveGameStore((s) => s.myHeading);
  const mySpeed = useLiveGameStore((s) => s.mySpeed);
  useSecondTick(!!violation);

  const buzzed = useRef(false);
  useEffect(() => {
    if (violation && !buzzed.current) {
      buzzed.current = true;
      Vibration.vibrate([0, 300, 150, 300, 150, 300]);
    }
    if (!violation) buzzed.current = false;
  }, [violation]);

  if (!violation) return null;

  const noGo = violation.reason === 'NO_GO_ZONE';
  const secondsLeft =
    violation.countdownSec && violation.countdownSec > 0
      ? Math.max(0, violation.countdownSec - Math.floor((Date.now() - violation.receivedAt) / 1000))
      : null;

  // The way back is toward the zone centre
  const toCentre = myLocation && zone ? bearingDegrees(myLocation, zone.center) : null;
  const arrow = toCentre === null ? 0 : (toCentre - (mySpeed > 0.8 ? myHeading : 0) + 360) % 360;
  const distance = !noGo && myLocation && zone ? distanceMeters(myLocation, zone.center) - zone.radius : violation.distanceOutsideMeters;

  return (
    <>
      <View style={styles.breachCard}>
        <View style={[styles.arrowBox, { transform: [{ rotate: `${arrow}deg` }] }]}>
          <Text style={styles.arrow}>▲</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.breachTitle}>
            {noGo ? `NO-GO ZONE${violation.zoneName ? `: ${violation.zoneName.toUpperCase()}` : ''}` : 'GET BACK IN THE ZONE'}
          </Text>
          <Text style={styles.breachBody}>
            {noGo ? 'Leave this restricted area now.' : `${formatDistance(Math.max(0, distance))} outside${toCentre !== null ? `, head ${compassPoint(toCentre)}` : ''}`}
          </Text>
          {!!violation.message && <Text style={styles.breachPenalty}>{violation.message}</Text>}
        </View>
        {secondsLeft !== null && (
          <View style={styles.countBox}>
            <Text style={styles.countText}>{mmss(secondsLeft)}</Text>
          </View>
        )}
      </View>
    </>
  );
}

/** Red screen border while you are in breach (render at screen level, above the map). */
export function ZoneBreachVignette() {
  const violation = useLiveGameStore((s) => s.zoneViolation);
  if (!violation) return null;
  return <View pointerEvents="none" style={styles.vignette} />;
}

/** "Zone shrinks in 00:45 to 750 m": the dashed amber ring on the map is the new boundary. */
export function ShrinkWarningBanner() {
  const warning = useLiveGameStore((s) => s.shrinkWarning);
  const zone = useLiveGameStore((s) => s.currentZone);
  useSecondTick(!!warning);
  if (!warning) return null;

  const left = Math.max(0, Math.ceil((warning.shrinksAtLocal - Date.now()) / 1000));
  return (
    <View style={styles.shrinkCard}>
      <Text style={styles.shrinkIcon}>⭕</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.shrinkTitle}>ZONE SHRINKING IN {mmss(left)}</Text>
        <Text style={styles.shrinkBody}>
          New radius {formatDistance(warning.nextZone.radius)}
          {zone ? ` (now ${formatDistance(zone.radius)})` : ''}. Follow the dashed ring.
        </Text>
      </View>
    </View>
  );
}

/** Head-start phase: runners are running, chasers wait. */
export function HeadStartBanner({ role }: { role: string }) {
  const status = useLiveGameStore((s) => s.status);
  const ms = useLiveGameStore((s) => s.countdownRemainingMs);
  if (status !== 'countdown') return null;
  const sec = Math.ceil(ms / 1000);
  return (
    <View style={styles.headCard}>
      <Text style={styles.headTitle}>{role === 'CHASER' ? 'CHASERS RELEASED IN' : 'HEAD START: RUN!'}</Text>
      <Text style={styles.headClock}>{mmss(sec)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  vignette: { ...StyleSheet.absoluteFillObject, borderWidth: 6, borderColor: 'rgba(255,59,48,0.75)', zIndex: 20 },
  breachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#93000A',
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  arrowBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  arrow: { color: '#93000A', fontSize: 20, fontWeight: '900' },
  breachTitle: { ...typography.labelMonoMd, color: '#FFFFFF', fontWeight: '800' },
  breachBody: { ...typography.bodyMd, color: '#FFDAD6', fontSize: 12, marginTop: 2 },
  breachPenalty: { ...typography.bodyMd, color: '#FFFFFF', fontSize: 11, marginTop: 4, fontWeight: '700' },
  countBox: { backgroundColor: '#FFFFFF', borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 6 },
  countText: { ...typography.labelMonoMd, color: '#93000A', fontWeight: '900' },

  shrinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.signalWarning,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  shrinkIcon: { fontSize: 22 },
  shrinkTitle: { ...typography.labelMonoMd, color: colors.signalWarning, fontWeight: '800' },
  shrinkBody: { ...typography.bodyMd, color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  headCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accentPrimary,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headTitle: { ...typography.labelMonoMd, color: colors.accentPrimary, fontWeight: '800' },
  headClock: { ...typography.headlineSm, color: colors.textPrimary },
});
