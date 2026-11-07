import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Vibration,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { getSocket, isSocketConnected } from '../../src/services/socket';
import { SOCKET_EVENTS } from '@manhunt/shared';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

export default function TagVerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const {
    gameId,
    code,
    myRole,
    pendingTagAttempt,
    clearPendingTagAttempt,
  } = useLiveGameStore();

  // Role perspective switch ('runner' | 'chaser')
  const [viewMode, setViewMode] = useState<'runner' | 'chaser'>(
    myRole === 'CHASER' ? 'chaser' : 'runner'
  );

  // Chaser sub-method ('qr' | 'pin')
  const [chaserMethod, setChaserMethod] = useState<'qr' | 'pin'>('pin');

  // Chaser PIN entry: 4 digits
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const pinInputRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  // Runner 45s countdown timer
  const [countdown, setCountdown] = useState(45);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const scanlineAnim = useRef(new Animated.Value(0)).current;

  // Feedback toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);

  // Initialize countdown when in runner view
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (viewMode === 'runner') {
      const startTime = Date.now();
      const durationMs = 45000;

      Animated.timing(progressAnim, {
        toValue: 0,
        duration: durationMs,
        useNativeDriver: false,
      }).start();

      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const rem = Math.max(0, 45 - elapsed);
        setCountdown(rem);

        if (rem <= 0) {
          if (timer) clearInterval(timer);
          handleAutoConfirmTimeout();
        }
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [viewMode]);

  // Scanline animation for Chaser QR reticle
  useEffect(() => {
    if (viewMode === 'chaser' && chaserMethod === 'qr') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanlineAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scanlineAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [viewMode, chaserMethod]);

  function showToast(message: string, type: 'success' | 'danger' | 'info' = 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleAutoConfirmTimeout() {
    Vibration.vibrate([100, 100, 100]);
    showToast('Auto-confirmed: Tag validated via timeout', 'danger');
    setTimeout(() => {
      router.replace('/game/spectator');
    }, 1200);
  }

  function handleRunnerConfirm() {
    Vibration.vibrate([80, 120]);
    if (gameId && isSocketConnected()) {
      getSocket().emit(SOCKET_EVENTS.TAG_CONFIRM, {
        gameId,
        attemptId: pendingTagAttempt?.attemptId,
        chaserUserId: pendingTagAttempt?.chaserUserId,
      });
    }
    clearPendingTagAttempt();
    showToast('Elimination confirmed. Switching to spectator.', 'danger');
    setTimeout(() => {
      router.replace('/game/spectator');
    }, 1000);
  }

  function handleRunnerDispute() {
    Vibration.vibrate(50);
    if (gameId && isSocketConnected()) {
      getSocket().emit(SOCKET_EVENTS.TAG_DISPUTE, {
        gameId,
        attemptId: pendingTagAttempt?.attemptId,
        reason: 'Proximity disputed / false tag contact',
      });
    }
    clearPendingTagAttempt();
    showToast('Dispute opened. Session referee alerted.', 'info');
    setTimeout(() => {
      router.back();
    }, 1000);
  }

  function handlePinChange(index: number, val: string) {
    const clean = val.replace(/[^0-9]/g, '');
    const next = [...pinDigits];
    next[index] = clean.slice(-1);
    setPinDigits(next);

    if (clean && index < 3) {
      pinInputRefs[index + 1].current?.focus();
    }
  }

  function handlePinKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinInputRefs[index - 1].current?.focus();
    }
  }

  function handleChaserSubmitCode() {
    const fullCode = pinDigits.join('');
    if (fullCode.length !== 4) {
      showToast('Enter all 4 digits of Runner Code', 'danger');
      return;
    }

    Vibration.vibrate(40);
    if (gameId && isSocketConnected()) {
      getSocket().emit(SOCKET_EVENTS.TAG_ATTEMPT, {
        gameId,
        runnerCode: fullCode,
      });
      showToast(`Transmitting elimination code: ${fullCode}...`, 'success');
      setTimeout(() => {
        router.back();
      }, 1500);
    } else {
      showToast('Transmitting simulated tag attempt...', 'success');
    }
  }

  function handleTriggerOpticalPing() {
    Vibration.vibrate([40, 60]);
    if (gameId && isSocketConnected()) {
      getSocket().emit(SOCKET_EVENTS.TAG_ATTEMPT, {
        gameId,
      });
    }
    showToast('Optical sensor lock registered. Transmitting ping...', 'success');
    setTimeout(() => {
      router.back();
    }, 1500);
  }

  const chaserName = pendingTagAttempt?.chaserUsername || 'KRONOS_9';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Protocol Bar / Top Telemetry */}
        <View style={styles.protocolBar}>
          <View style={styles.protocolLeft}>
            <View style={styles.pingDot} />
            <Text style={styles.protocolText}>PROTOCOL 08-TAG</Text>
          </View>
          <View style={styles.lobbyChip}>
            <Text style={styles.lobbyLabel}>LOBBY:</Text>
            <Text style={styles.lobbyCode}>{code || 'MH84X9'}</Text>
          </View>
        </View>

        {/* Perspective Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeTab, viewMode === 'runner' && styles.modeTabActive]}
            onPress={() => setViewMode('runner')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>🛡</Text>
            <Text
              style={[
                styles.modeTabText,
                viewMode === 'runner' ? styles.modeTabTextActive : styles.modeTabTextInactive,
              ]}
            >
              RUNNER VIEW
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, viewMode === 'chaser' && styles.modeTabActive]}
            onPress={() => setViewMode('chaser')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14 }}>🎯</Text>
            <Text
              style={[
                styles.modeTabText,
                viewMode === 'chaser' ? styles.modeTabTextActive : styles.modeTabTextInactive,
              ]}
            >
              CHASER VIEW
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===================== RUNNER SIDE ===================== */}
        {viewMode === 'runner' && (
          <View style={styles.runnerSection}>
            <View style={styles.alertCard}>
              {/* Top Tactical Badge & Live Clock */}
              <View style={styles.alertHeaderRow}>
                <View style={styles.warningBadge}>
                  <Text style={{ fontSize: 12 }}>⚠️</Text>
                  <Text style={styles.warningBadgeText}>VERIFICATION REQUIRED</Text>
                </View>
                <View style={styles.clockRow}>
                  <Text style={{ fontSize: 12 }}>⏱</Text>
                  <Text style={styles.clockText}>{countdown}s</Text>
                </View>
              </View>

              {/* Hunter Profile Mini Snapshot */}
              <View style={styles.hunterSnapshot}>
                <View style={styles.avatarBox}>
                  <Text style={{ fontSize: 22 }}>🐺</Text>
                  <View style={styles.avatarStatusDot} />
                </View>
                <View style={styles.hunterInfo}>
                  <Text style={styles.labelMonoSm}>CHASER ID</Text>
                  <Text style={styles.hunterName}>@{chaserName}</Text>
                  <Text style={styles.hunterLoc}>📍 Sector 4B • 14s ago</Text>
                </View>
              </View>

              {/* Core Question */}
              <View style={styles.questionBlock}>
                <Text style={styles.headlineMd}>WERE YOU TAGGED BY @{chaserName}?</Text>
                <Text style={styles.bodyMd}>
                  Chaser registered proximity contact (
                  <Text style={{ color: colors.accentPrimary, fontWeight: 'bold' }}>0.8m</Text>
                  ) via optical beacon at 03:42:19. Confirm status immediately.
                </Text>
              </View>

              {/* Countdown Progress Bar */}
              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.actionBlock}>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  activeOpacity={0.88}
                  onPress={handleRunnerConfirm}
                >
                  <Text style={{ fontSize: 18 }}>✓</Text>
                  <Text style={styles.confirmBtnText}>CONFIRM TAG (ELIMINATED)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.disputeBtn}
                  activeOpacity={0.88}
                  onPress={handleRunnerDispute}
                >
                  <Text style={{ fontSize: 18 }}>⚖️</Text>
                  <Text style={styles.disputeBtnText}>DISPUTE / FALSE TAG</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Live Telemetry Pill */}
            <View style={styles.telemetryPill}>
              <Text style={{ fontSize: 16 }}>📡</Text>
              <Text style={styles.telemetryPillText}>
                Verified tags instantly update live lobby telemetry, shrink remaining extraction
                perimeter, and switch GPS beacon to spectator mode.
              </Text>
            </View>
          </View>
        )}

        {/* ===================== CHASER SIDE ===================== */}
        {viewMode === 'chaser' && (
          <View style={styles.chaserSection}>
            {/* Sub-tabs: Scan vs PIN */}
            <View style={styles.chaserMethodSelector}>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  chaserMethod === 'qr' && styles.methodBtnActive,
                ]}
                onPress={() => setChaserMethod('qr')}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 18 }}>📷</Text>
                <Text style={styles.methodTitle}>SCAN QR</Text>
                <Text style={styles.methodSub}>Optical Tag</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  chaserMethod === 'pin' && styles.methodBtnActive,
                ]}
                onPress={() => setChaserMethod('pin')}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 18 }}>🔢</Text>
                <Text style={styles.methodTitle}>ENTER PIN</Text>
                <Text style={styles.methodSub}>Manual 4-Digit</Text>
              </TouchableOpacity>
            </View>

            {/* Method A: QR Scanner Viewport */}
            {chaserMethod === 'qr' && (
              <View style={styles.qrBox}>
                <View style={styles.qrHeader}>
                  <Text style={styles.labelMonoSm}>OPTICAL RETICLE 01</Text>
                  <View style={styles.sensorActiveRow}>
                    <View style={styles.sensorDot} />
                    <Text style={styles.sensorActiveText}>SENSOR ACTIVE</Text>
                  </View>
                </View>

                {/* Viewfinder frame */}
                <View style={styles.viewfinderFrame}>
                  {/* Tactical corner brackets */}
                  <View style={[styles.cornerBracket, styles.bracketTL]} />
                  <View style={[styles.cornerBracket, styles.bracketTR]} />
                  <View style={[styles.cornerBracket, styles.bracketBL]} />
                  <View style={[styles.cornerBracket, styles.bracketBR]} />

                  {/* Scanline Sweep */}
                  <Animated.View
                    style={[
                      styles.scanline,
                      {
                        transform: [
                          {
                            translateY: scanlineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-90, 90],
                            }),
                          },
                        ],
                      },
                    ]}
                  />

                  {/* Reticle Target */}
                  <View style={styles.reticleCenter}>
                    <Text style={{ fontSize: 32 }}>🎯</Text>
                    <Text style={styles.targetLockText}>TARGET LOCK</Text>
                  </View>
                </View>

                <View style={styles.helperRow}>
                  <Text style={{ fontSize: 13 }}>💡</Text>
                  <Text style={styles.helperText}>
                    Align runner's illuminated chest badge within reticle
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.triggerPingBtn}
                  activeOpacity={0.88}
                  onPress={handleTriggerOpticalPing}
                >
                  <Text style={{ fontSize: 18 }}>⚡</Text>
                  <Text style={styles.triggerPingBtnText}>TRIGGER PROXIMITY PING</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Method B: 4-Digit Manual PIN */}
            {chaserMethod === 'pin' && (
              <View style={styles.pinBox}>
                <View style={styles.pinHeader}>
                  <Text style={styles.labelMonoSm}>MANUAL OVERRIDE</Text>
                  <Text style={styles.labelMonoSm}>CODE LENGTH: 4</Text>
                </View>

                <Text style={styles.pinExplainer}>
                  Request Runner's emergency session passcode if optical scanner fails in rain or
                  low light:
                </Text>

                {/* 4 PIN Entry Slots */}
                <View style={styles.pinSlotsRow}>
                  {[0, 1, 2, 3].map((idx) => (
                    <TextInput
                      key={idx}
                      ref={pinInputRefs[idx]}
                      style={styles.pinSlot}
                      value={pinDigits[idx]}
                      onChangeText={(val) => handlePinChange(idx, val)}
                      onKeyPress={({ nativeEvent }) => handlePinKeyPress(idx, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {/* Submit PIN CTA */}
                <TouchableOpacity
                  style={styles.submitPinBtn}
                  activeOpacity={0.88}
                  onPress={handleChaserSubmitCode}
                >
                  <Text style={{ fontSize: 18 }}>🚀</Text>
                  <Text style={styles.submitPinBtnText}>TRANSMIT ELIMINATION CODE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Feedback Toast */}
        {toast && (
          <View
            style={[
              styles.toastBox,
              toast.type === 'danger' && styles.toastDanger,
              toast.type === 'success' && styles.toastSuccess,
            ]}
          >
            <Text style={{ fontSize: 16 }}>
              {toast.type === 'danger' ? '⛔' : toast.type === 'success' ? '✓' : 'ℹ️'}
            </Text>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}
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
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  protocolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  protocolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  protocolText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  lobbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  lobbyLabel: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.textSecondary,
  },
  lobbyCode: {
    fontFamily: fontMono,
    fontSize: 13,
    color: colors.accentPrimary,
    fontWeight: 'bold',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#0E0E0E',
    borderRadius: radii.card,
    padding: 4,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  modeTabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  modeTabText: {
    fontFamily: fontMono,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modeTabTextActive: {
    color: colors.textPrimary,
  },
  modeTabTextInactive: {
    color: colors.textSecondary,
  },
  runnerSection: {
    gap: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#93000A',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#C7003A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  warningBadgeText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clockText: {
    fontFamily: fontMono,
    fontSize: 13,
    color: '#FFB3B6',
    fontWeight: 'bold',
  },
  hunterSnapshot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#353534',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C7003A',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  hunterInfo: {
    flex: 1,
  },
  labelMonoSm: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  hunterName: {
    fontFamily: fontHeadline,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  hunterLoc: {
    fontFamily: fontBody,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  questionBlock: {
    marginBottom: spacing.md,
  },
  headlineMd: {
    fontFamily: fontHeadline,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#353534',
    borderRadius: 3,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#C7003A',
    borderRadius: 3,
  },
  actionBlock: {
    gap: spacing.sm,
  },
  confirmBtn: {
    height: 52,
    backgroundColor: '#C7003A',
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  confirmBtnText: {
    fontFamily: fontBody,
    fontSize: 15,
    color: '#FFF',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  disputeBtn: {
    height: 52,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  disputeBtnText: {
    fontFamily: fontBody,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  telemetryPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  telemetryPillText: {
    flex: 1,
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  chaserSection: {
    gap: spacing.md,
  },
  chaserMethodSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: 4,
  },
  methodBtnActive: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accentPrimary,
  },
  methodTitle: {
    fontFamily: fontMono,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  methodSub: {
    fontFamily: fontBody,
    fontSize: 12,
    color: colors.textSecondary,
  },
  qrBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sensorActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sensorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  sensorActiveText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.accentPrimary,
    fontWeight: 'bold',
  },
  viewfinderFrame: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#0E0E0E',
    borderRadius: radii.card,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: colors.accentPrimary,
  },
  bracketTL: {
    top: 20,
    left: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  bracketTR: {
    top: 20,
    right: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bracketBL: {
    bottom: 20,
    left: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bracketBR: {
    bottom: 20,
    right: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanline: {
    position: 'absolute',
    width: '80%',
    height: 2,
    backgroundColor: colors.accentPrimary,
  },
  reticleCenter: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  targetLockText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.accentPrimary,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  helperText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  triggerPingBtn: {
    height: 52,
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  triggerPingBtnText: {
    fontFamily: fontBody,
    fontSize: 15,
    color: '#151F00',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  pinBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pinExplainer: {
    fontFamily: fontBody,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  pinSlotsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pinSlot: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#0E0E0E',
    borderRadius: radii.md,
    textAlign: 'center',
    fontFamily: fontHeadline,
    fontSize: 32,
    color: colors.accentPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  submitPinBtn: {
    height: 52,
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submitPinBtnText: {
    fontFamily: fontBody,
    fontSize: 15,
    color: '#151F00',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radii.card,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  toastDanger: {
    backgroundColor: '#2A0E12',
    borderColor: '#C7003A',
  },
  toastSuccess: {
    backgroundColor: '#16280B',
    borderColor: colors.accentPrimary,
  },
  toastText: {
    flex: 1,
    fontFamily: fontMono,
    fontSize: 12,
    color: colors.textPrimary,
  },
});
