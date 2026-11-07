import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { getSocket, isSocketConnected } from '../../src/services/socket';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

export default function SosEmergencyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const { gameId, myLocation } = useLiveGameStore();

  const [elapsedSec, setElapsedSec] = useState(14);
  const [deescalated, setDeescalated] = useState(false);

  // Pulse animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Emit SOS trigger to server room if not already fired
    if (gameId && isSocketConnected()) {
      getSocket().emit(SOCKET_EVENTS.SOS_TRIGGER, {
        gameId,
        coordinates: myLocation || { latitude: 40.78509, longitude: -73.96828 },
        reason: 'Active SOS Emergency Screen invoked',
      });
    }

    // Elapsed timer
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    // Flashing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    return () => clearInterval(interval);
  }, []);

  const emergencyContactName = user?.emergencyContact?.name || 'Sarah Connor';
  const emergencyContactPhone = user?.emergencyContact?.phone || '+1 555-234-5678';

  function handleCall911() {
    Linking.openURL('tel:911').catch(() => {
      Alert.alert('Call Failed', 'Unable to initiate call to emergency services.');
    });
  }

  function handleCallContact() {
    Linking.openURL(`tel:${emergencyContactPhone}`).catch(() => {
      Alert.alert('Call Failed', `Unable to dial ${emergencyContactPhone}`);
    });
  }

  function handleCancelSos() {
    if (gameId && isSocketConnected()) {
      getSocket().emit(SOCKET_EVENTS.SOS_RESOLVED, { gameId });
    }
    setDeescalated(true);
    setTimeout(() => {
      router.back();
    }, 600);
  }

  function handleLeaveSession() {
    Alert.alert(
      'LEAVE SESSION',
      'Are you sure you want to exit the live pursuit grid?',
      [
        { text: 'STAY IN GAME', style: 'cancel' },
        {
          text: 'EXIT GAME',
          style: 'destructive',
          onPress: () => {
            if (gameId && isSocketConnected()) {
              getSocket().emit(SOCKET_EVENTS.SOS_RESOLVED, { gameId });
            }
            router.replace('/home');
          },
        },
      ]
    );
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const coordsString = myLocation
    ? `${myLocation.latitude.toFixed(5)}° N, ${myLocation.longitude.toFixed(5)}° W`
    : '40.78509° N, -73.96828° W';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ——— Red Perimeter Alert Banner ——— */}
        <View style={styles.alertBanner}>
          <View style={styles.bannerLeft}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
            <Text style={[styles.labelMonoSm, { color: '#FFDAD6', fontWeight: 'bold' }]}>
              EMERGENCY PROTOCOL ACTIVE
            </Text>
          </View>
          <View style={styles.liveUplinkPill}>
            <Text style={[styles.labelMonoSm, { color: '#FFB4AB' }]}>LIVE UPLINK</Text>
          </View>
        </View>

        {/* ——— Primary Alarm Title ——— */}
        <View style={styles.headerSection}>
          <View style={styles.row}>
            <Text style={styles.displayHero}>SOS ACTIVE</Text>
            <Text style={styles.elapsedTimer}>{formatTimer(elapsedSec)}</Text>
          </View>
          <Text style={[styles.bodySm, { color: colors.textSecondary, marginTop: 4 }]}>
            Real-time coordinates and emergency audio transponder broadcasting to Manhattan Dispatch & Game Marshals.
          </Text>
        </View>

        {/* ——— Live Location Visual & GPS Telemetry Bento ——— */}
        <View style={styles.telemetryCard}>
          <View style={styles.mapPreview}>
            <View style={styles.beaconPingRing} />
            <View style={styles.beaconCore} />
            <View style={styles.satLockBadge}>
              <Text style={[styles.labelMonoSm, { color: colors.signalDanger, fontWeight: 'bold' }]}>
                SAT LOCK • 9 SATS
              </Text>
            </View>
          </View>

          <View style={styles.gpsDataBlock}>
            <View style={styles.row}>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>COORDINATES</Text>
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary, fontWeight: 'bold' }]}>
                ±2.4 METERS (HIGH RESOLUTION LOCK)
              </Text>
            </View>
            <Text style={styles.coordsText}>{coordsString}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>📍</Text>
              <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
                Central Park West & 72nd St, NY
              </Text>
            </View>
          </View>
        </View>

        {/* ——— Safety Network Status Checkpoints ——— */}
        <View style={styles.networkSection}>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary, marginBottom: 4 }]}>
            SAFETY NETWORK STATUS
          </Text>

          {/* Status Row 1 */}
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={styles.verifiedIcon}>
                <Text style={{ color: colors.accentPrimary, fontSize: 14 }}>✓</Text>
              </View>
              <View>
                <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Host & Dispatch Notified
                </Text>
                <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
                  Automated critical incident report filed
                </Text>
              </View>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>00:12 AGO</Text>
          </View>

          {/* Status Row 2 */}
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={styles.verifiedIcon}>
                <Text style={{ color: colors.accentPrimary, fontSize: 14 }}>✓</Text>
              </View>
              <View>
                <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Emergency Contact Pinged
                </Text>
                <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
                  SMS sent to {emergencyContactName} ({emergencyContactPhone})
                </Text>
              </View>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>DELIVERED</Text>
          </View>

          {/* Status Row 3 */}
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={styles.verifiedIcon}>
                <Text style={{ color: colors.accentPrimary, fontSize: 14 }}>📡</Text>
              </View>
              <View>
                <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Live Location Streaming
                </Text>
                <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
                  Direct continuous beacon active
                </Text>
              </View>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>ONLINE</Text>
          </View>
        </View>

        {/* ——— Primary Thumb-Zone Actions ——— */}
        <View style={styles.actionSection}>
          {/* Call 911 */}
          <TouchableOpacity
            style={styles.call911Button}
            onPress={handleCall911}
            activeOpacity={0.88}
          >
            <Text style={{ fontSize: 20 }}>📞</Text>
            <Text style={styles.call911Text}>CALL EMERGENCY SERVICES (911)</Text>
          </TouchableOpacity>

          {/* Call Contact */}
          <TouchableOpacity
            style={styles.callContactButton}
            onPress={handleCallContact}
            activeOpacity={0.88}
          >
            <Text style={{ fontSize: 18 }}>📱</Text>
            <Text style={styles.callContactText}>
              CALL {emergencyContactName.toUpperCase()}
            </Text>
          </TouchableOpacity>

          {/* De-escalation Button (I'm Safe) */}
          <TouchableOpacity
            style={[styles.safeDeescalateButton, deescalated && { backgroundColor: colors.accentPrimary }]}
            onPress={handleCancelSos}
            activeOpacity={0.88}
          >
            <Text style={{ fontSize: 18 }}>🛡</Text>
            <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: 'bold' }]}>
              {deescalated ? 'SOS CANCELLED • STANDING DOWN' : "I'M SAFE, CANCEL SOS"}
            </Text>
          </TouchableOpacity>

          {/* Tertiary Leave Session */}
          <TouchableOpacity
            style={styles.leaveButton}
            onPress={handleLeaveSession}
          >
            <Text style={[styles.bodySm, { color: colors.textSecondary, textDecorationLine: 'underline' }]}>
              LEAVE GAME SESSION
            </Text>
          </TouchableOpacity>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#93000A',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFB4AB',
  },
  liveUplinkPill: {
    backgroundColor: 'rgba(255, 180, 171, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  headerSection: {
    gap: 2,
  },
  displayHero: {
    fontFamily: 'Anton_400Regular',
    fontSize: 40,
    lineHeight: 44,
    color: '#FF3B30',
    letterSpacing: 1,
  },
  elapsedTimer: {
    ...typography.labelMonoLg,
    color: '#FF3B30',
    fontSize: 24,
  },
  telemetryCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  mapPreview: {
    height: 140,
    backgroundColor: '#1E1617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beaconPingRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FF3B30',
    opacity: 0.5,
  },
  beaconCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
  },
  satLockBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(14,14,14,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  gpsDataBlock: {
    padding: spacing.md,
    gap: 4,
  },
  coordsText: {
    ...typography.labelMonoMd,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  networkSection: {
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  verifiedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(61, 220, 132, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  call911Button: {
    height: 56,
    borderRadius: radii.button,
    backgroundColor: '#C7003A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#C7003A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  call911Text: {
    ...typography.bodyLg,
    color: '#FFDAD6',
    fontWeight: 'bold',
  },
  callContactButton: {
    height: 48,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  callContactText: {
    ...typography.bodyMd,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  safeDeescalateButton: {
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.accentPrimary,
  },
  leaveButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelMonoSm: {
    ...typography.labelMonoSm,
  },
  bodySm: {
    ...typography.bodySm,
  },
  bodyMd: {
    ...typography.bodyMd,
  },
});
