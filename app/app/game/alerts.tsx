import React, { useState, useEffect } from 'react';
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
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

export default function InGameAlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentZone, zoneViolation } = useLiveGameStore();

  const [shrinkCountdown, setShrinkCountdown] = useState(10);
  const [breachCountdown, setBreachCountdown] = useState(28);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setShrinkCountdown((prev) => (prev > 0 ? prev - 1 : 10));
      setBreachCountdown((prev) => (prev > 0 ? prev - 1 : 28));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec: number) => `00:${String(sec).padStart(2, '0')}`;

  const distOut = zoneViolation ? Math.round(zoneViolation.distanceOutsideMeters) : 140;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ——— Header ——— */}
      <View style={styles.header}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.pulseDot} />
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>
              TACTICAL FEED ONLINE
            </Text>
          </View>
          <View style={styles.nodeBadge}>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>NODE: 70-KILOS</Text>
          </View>
        </View>
        <Text style={styles.headlineLg}>IN-GAME TACTICAL ALERTS</Text>
        <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
          Live field broadcast states & safety enforcement
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ——— ALERT 1: ZONE SHRINKING WARNING ——— */}
        <View style={styles.shrinkCard}>
          <View style={styles.row}>
            <View style={styles.shrinkPill}>
              <Text style={{ fontSize: 13, color: '#FFB020' }}>⚠️</Text>
              <Text style={[styles.labelMonoSm, { color: '#FFB020', fontWeight: 'bold' }]}>
                ZONE SHRINKING WARNING
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>PRIORITY 02</Text>
          </View>

          <View style={styles.row}>
            <View>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary, fontSize: 10 }]}>
                IMMINENT COLLAPSE
              </Text>
              <Text style={[styles.headlineMd, { color: '#FFB020' }]}>ZONE CLOSING IN</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.timerHero, { color: '#FFB020' }]}>
                {formatTimer(shrinkCountdown)}
              </Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                COLLAPSE T-MINUS
              </Text>
            </View>
          </View>

          {/* Schematic Diagram */}
          <View style={styles.shrinkSchematic}>
            <View style={styles.outerDashedRing} />
            <View style={styles.innerSolidRing} />
            <View style={styles.youCenterPin}>
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary, fontWeight: 'bold', fontSize: 10 }]}>
                YOU
              </Text>
            </View>
            <View style={styles.vectorBadge}>
              <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>
                1.5 KM → 1.1 KM
              </Text>
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>
                STAGE 2 VECTOR
              </Text>
            </View>
          </View>

          <View style={styles.shrinkAlertAction}>
            <Text style={{ fontSize: 16 }}>🧭</Text>
            <Text style={[styles.bodyMd, { color: '#FFF4D6', fontWeight: 'bold' }]}>
              GET INSIDE PERIMETER IMMEDIATELY.
            </Text>
          </View>
        </View>

        {/* ——— ALERT 2: OUT OF ZONE CRITICAL BREACH ——— */}
        <View style={styles.breachCard}>
          <View style={styles.row}>
            <View style={styles.breachPill}>
              <Text style={{ fontSize: 13, color: '#FF3B30' }}>🚨</Text>
              <Text style={[styles.labelMonoSm, { color: '#FF3B30', fontWeight: 'bold' }]}>
                CRITICAL BREACH DETECTED
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: '#FF3B30', fontWeight: 'bold' }]}>
              LEVEL 01 DANGER
            </Text>
          </View>

          <View>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary, fontSize: 10 }]}>
              PERIMETER VIOLATION
            </Text>
            <Text style={[styles.headlineMd, { color: '#FF3B30' }]}>OUT OF BOUNDS</Text>
          </View>

          {/* 2-Col Data Grid */}
          <View style={styles.grid2}>
            <View style={styles.gridCell}>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                DISTANCE PENALTY
              </Text>
              <Text style={[styles.headlineLg, { color: '#FF3B30', marginTop: 4 }]}>
                {distOut}M
              </Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>PAST BARRIER</Text>
            </View>

            <View style={styles.gridCell}>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                VECTOR TO SAFETY
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Text style={{ fontSize: 24, color: colors.accentPrimary }}>↙</Text>
                <View>
                  <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: 'bold' }]}>
                    SOUTH-WEST
                  </Text>
                  <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>
                    HEADING 220°
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Consequence Exposure Box */}
          <View style={styles.consequenceBox}>
            <View style={styles.row}>
              <Text style={[styles.labelMonoSm, { color: '#FFDAD6', fontWeight: 'bold' }]}>
                CONSEQUENCE EXPOSURE
              </Text>
              <Text style={[styles.labelMonoMd, { color: '#FF3B30', fontWeight: 'bold' }]}>
                {formatTimer(breachCountdown)}
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>
              PENALTY: GPS LOCATION BROADCASTING TO ALL CHASERS IN {formatTimer(breachCountdown)}
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(breachCountdown / 30) * 100}%` }]} />
            </View>
          </View>

          {/* Re-enter Button */}
          <TouchableOpacity
            style={styles.reenterButton}
            onPress={() => router.back()}
            activeOpacity={0.88}
          >
            <Text style={{ fontSize: 18 }}>🧭</Text>
            <Text style={[styles.bodyMd, { color: '#0A0A0A', fontWeight: 'bold' }]}>
              RE-ENTER PERIMETER
            </Text>
          </TouchableOpacity>
        </View>

        {/* ——— ALERT 3: FIELD SAFETY PROTOCOL CARD ——— */}
        <View style={styles.safetyCard}>
          <View style={styles.row}>
            <View style={styles.mandatoryPill}>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>🛡</Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                MANDATORY RULE
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>SAFETY V4.2</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.safetyIconBox}>
              <Text style={{ fontSize: 24 }}>🚶</Text>
            </View>
            <View>
              <Text style={styles.headlineSm}>FIELD SAFETY PROTOCOL</Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                CIVILIAN URBAN ENVIRONMENT
              </Text>
            </View>
          </View>

          <View style={styles.ruleTextBox}>
            <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: '600' }]}>
              CROSS AT DESIGNATED PEDESTRIAN CROSSINGS ONLY. DO NOT ENTER VEHICULAR TRAFFIC.
            </Text>
          </View>

          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>🏛</Text>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
                CITY BYLAW ACTIVE
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.ackButton, acknowledged && { opacity: 0.6 }]}
              onPress={() => setAcknowledged(true)}
              disabled={acknowledged}
            >
              <Text style={[styles.labelMonoSm, { color: colors.textPrimary, fontWeight: 'bold' }]}>
                {acknowledged ? 'CONFIRMED' : 'ACKNOWLEDGED'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ——— Telemetry Audit Footer ——— */}
        <View style={styles.footerAudit}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.miniDot, { backgroundColor: colors.accentPrimary }]} />
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
              DISPATCH CARRIER ENCRYPTED
            </Text>
          </View>
          <Text style={[styles.labelMonoSm, { color: '#666' }]}>
            MANHUNT OS / REALTIME RELAY LAYER
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  nodeBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  shrinkCard: {
    backgroundColor: '#1A1608',
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#382C0B',
    gap: spacing.sm,
  },
  shrinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#382C0B',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  timerHero: {
    fontFamily: 'Anton_400Regular',
    fontSize: 32,
    lineHeight: 36,
  },
  shrinkSchematic: {
    height: 140,
    backgroundColor: '#0E0E0E',
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  outerDashedRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    borderColor: '#FFB020',
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  innerSolidRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#FFB020',
    backgroundColor: 'rgba(255, 176, 32, 0.12)',
  },
  youCenterPin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vectorBadge: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(32,32,32,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  shrinkAlertAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#2B2207',
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  breachCard: {
    backgroundColor: '#29080E',
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#4A0F19',
    gap: spacing.sm,
  },
  breachPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4A0F19',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  grid2: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gridCell: {
    flex: 1,
    backgroundColor: 'rgba(14,14,14,0.8)',
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  consequenceBox: {
    backgroundColor: '#140508',
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
  },
  reenterButton: {
    height: 52,
    borderRadius: radii.button,
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  safetyCard: {
    backgroundColor: '#181714',
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  mandatoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  safetyIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#2B271D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleTextBox: {
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  ackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
  },
  footerAudit: {
    alignItems: 'center',
    gap: 4,
    opacity: 0.7,
    marginTop: spacing.md,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headlineLg: {
    ...typography.headlineLg,
  },
  headlineMd: {
    ...typography.headlineMd,
  },
  headlineSm: {
    ...typography.headlineSm,
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
  bodyMd: {
    ...typography.bodyMd,
  },
});
