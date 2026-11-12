import React, { useEffect, useState, useRef } from 'react';
import {
  Platform,
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
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { getSocket, isSocketConnected } from '../../src/services/socket';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

// India's all-in-one emergency number. Override per region with EXPO_PUBLIC_EMERGENCY_NUMBER.
const EMERGENCY_NUMBER = process.env.EXPO_PUBLIC_EMERGENCY_NUMBER || '112';

interface SosAck {
  hostNotified: boolean;
  hostPushSent: boolean;
  senderIsHost: boolean;
  hasLocation: boolean;
}

export default function SosEmergencyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const { gameId, myLocation } = useLiveGameStore();

  const [elapsedSec, setElapsedSec] = useState(0);
  const [ack, setAck] = useState<SosAck | null>(null);
  const [fix, setFix] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deescalated, setDeescalated] = useState(false);

  // Pulse animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;

    // The server confirms what it actually did (host reached or not)
    const socket = isSocketConnected() ? getSocket() : null;
    const onAck = (data: SosAck) => setAck(data);
    socket?.on(SOCKET_EVENTS.SOS_ACK, onAck);

    (async () => {
      // Real coordinates only: last game fix, otherwise ask the GPS. Never a made-up position.
      let coords = myLocation ? { latitude: myLocation.latitude, longitude: myLocation.longitude } : null;
      if (!coords) {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } catch {
          /* no fix yet: the server will use its own last known location */
        }
      }
      if (cancelled) return;
      if (coords) setFix(coords);
      if (gameId && isSocketConnected()) {
        getSocket().emit(SOCKET_EVENTS.SOS_TRIGGER, {
          gameId,
          ...(coords ? { coordinates: coords } : {}),
          reason: 'SOS pressed in game',
        });
      }
    })();

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

    return () => {
      cancelled = true;
      socket?.off(SOCKET_EVENTS.SOS_ACK, onAck);
      clearInterval(interval);
    };
  }, []);

  const emergencyContactName = user?.emergencyContact?.name?.trim() || '';
  const emergencyContactPhone = user?.emergencyContact?.phone?.trim() || '';
  const hasContact = emergencyContactPhone.length > 0;
  const position = fix ?? (myLocation ? { latitude: myLocation.latitude, longitude: myLocation.longitude } : null);

  function handleCallEmergency() {
    Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {
      Alert.alert('Call Failed', `Unable to dial ${EMERGENCY_NUMBER}. Please dial it manually.`);
    });
  }

  function handleCallContact() {
    Linking.openURL(`tel:${emergencyContactPhone}`).catch(() => {
      Alert.alert('Call Failed', `Unable to dial ${emergencyContactPhone}`);
    });
  }

  // Free, works offline of our servers: the phone's own SMS app with a pre-filled maps link
  function handleSmsContact() {
    const where = position
      ? `https://maps.google.com/?q=${position.latitude},${position.longitude}`
      : 'my location is not available yet';
    const body = `SOS from ${user?.username ?? 'me'} (Manhunt Live game). I need help. ${where}`;
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${emergencyContactPhone}${sep}body=${encodeURIComponent(body)}`).catch(() => {
      Alert.alert('SMS Failed', 'Unable to open the messaging app.');
    });
  }

  // Honest status text, driven by what the server really confirmed
  const hostTitle = !gameId ? 'Not in a game' : ack ? (ack.senderIsHost ? 'You are the host' : 'Host alerted') : 'Contacting host…';
  const hostSub = !gameId
    ? 'No game host to alert. Call emergency services.'
    : !ack
      ? 'Sending your SOS to the game host'
      : ack.senderIsHost
        ? 'No one else was notified'
        : ack.hostNotified
          ? 'Your host received the SOS and can see your location'
          : 'Host is not connected right now; a push notification was sent';
  const hostRight = ack ? (ack.hostNotified || ack.senderIsHost ? 'RECEIVED' : 'PUSH SENT') : '…';
  const contactSub = hasContact
    ? `Not sent automatically. Tap "TEXT ${emergencyContactName.toUpperCase() || 'CONTACT'}" below.`
    : 'No emergency contact saved. Add one in your profile.';
  const streamRight = ack?.hostNotified ? 'ONLINE' : 'PENDING';

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

  const coordsString = position
    ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
    : 'LOCATING…';

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
            Your game host is being alerted with your live location. If you are in danger, call emergency services now.
          </Text>
        </View>

        {/* ——— Live Location Visual & GPS Telemetry Bento ——— */}
        <View style={styles.telemetryCard}>
          <View style={styles.mapPreview}>
            <View style={styles.beaconPingRing} />
            <View style={styles.beaconCore} />
            <View style={styles.satLockBadge}>
              <Text style={[styles.labelMonoSm, { color: colors.signalDanger, fontWeight: 'bold' }]}>
                {position ? 'GPS LOCATION KNOWN' : 'ACQUIRING GPS…'}
              </Text>
            </View>
          </View>

          <View style={styles.gpsDataBlock}>
            <View style={styles.row}>
              <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>COORDINATES</Text>
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary, fontWeight: 'bold' }]}>
                LAST KNOWN FIX
              </Text>
            </View>
            <Text style={styles.coordsText}>{coordsString}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 14 }}>📍</Text>
              <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
                Your host sees this position on their map
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
                <Text style={{ color: colors.accentPrimary, fontSize: 14 }}>{ack ? '✓' : '…'}</Text>
              </View>
              <View>
                <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: '600' }]}>
                  {hostTitle}
                </Text>
                <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
                  {hostSub}
                </Text>
              </View>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>{hostRight}</Text>
          </View>

          {/* Status Row 2 */}
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={styles.verifiedIcon}>
                <Text style={{ color: colors.accentPrimary, fontSize: 14 }}>✉</Text>
              </View>
              <View>
                <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: '600' }]}>
                  Emergency Contact
                </Text>
                <Text style={[styles.bodySm, { color: colors.textSecondary }]}>
                  {contactSub}
                </Text>
              </View>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>MANUAL</Text>
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
                  Host sees your position while SOS is active
                </Text>
              </View>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>{streamRight}</Text>
          </View>
        </View>

        {/* ——— Primary Thumb-Zone Actions ——— */}
        <View style={styles.actionSection}>
          {/* Call 911 */}
          <TouchableOpacity
            style={styles.call911Button}
            onPress={handleCallEmergency}
            activeOpacity={0.88}
          >
            <Text style={{ fontSize: 20 }}>📞</Text>
            <Text style={styles.call911Text}>CALL EMERGENCY SERVICES ({EMERGENCY_NUMBER})</Text>
          </TouchableOpacity>

          {/* Emergency contact: SMS with location (free, via the phone's own SMS app) + call */}
          {hasContact ? (
            <>
              <TouchableOpacity style={styles.callContactButton} onPress={handleSmsContact} activeOpacity={0.88}>
                <Text style={{ fontSize: 18 }}>✉️</Text>
                <Text style={styles.callContactText}>
                  TEXT {(emergencyContactName || 'CONTACT').toUpperCase()} MY LOCATION
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.callContactButton} onPress={handleCallContact} activeOpacity={0.88}>
                <Text style={{ fontSize: 18 }}>📱</Text>
                <Text style={styles.callContactText}>CALL {(emergencyContactName || 'CONTACT').toUpperCase()}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.callContactButton}
              onPress={() => router.push('/auth/profile')}
              activeOpacity={0.88}
            >
              <Text style={{ fontSize: 18 }}>➕</Text>
              <Text style={styles.callContactText}>ADD AN EMERGENCY CONTACT</Text>
            </TouchableOpacity>
          )}

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
