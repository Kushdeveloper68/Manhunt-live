import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { requestLocationPermissions } from '../../src/services/location';
import { registerForPushNotifications } from '../../src/services/push';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../src/theme/theme';
import { Button } from '../../src/components/Button';

export default function PermissionsScreen() {
  const router = useRouter();

  const [locationAllowed, setLocationAllowed] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [batteryAllowed, setBatteryAllowed] = useState(false);

  // Show what is REALLY granted right now
  useEffect(() => {
    (async () => {
      try {
        const fg = await Location.getForegroundPermissionsAsync();
        const bg = await Location.getBackgroundPermissionsAsync();
        setLocationAllowed(fg.status === 'granted' && bg.status === 'granted');
      } catch {
        /* leave as not allowed */
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Notifications = require('expo-notifications');
        setNotificationsAllowed((await Notifications.getPermissionsAsync()).status === 'granted');
      } catch {
        /* notifications module unavailable in this build */
      }
    })();
  }, []);

  const requestLocation = async () => {
    const ok = await requestLocationPermissions();
    setLocationAllowed(ok);
    if (!ok) {
      Alert.alert(
        'Location needed',
        'Manhunt Live needs your location, and "Allow all the time" so tracking keeps working when the screen locks. You can change this in Settings.',
        [{ text: 'Open Settings', onPress: () => Linking.openSettings() }, { text: 'Not now', style: 'cancel' }]
      );
    }
  };

  const requestNotifications = async () => {
    await registerForPushNotifications(); // asks permission, then registers the device
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications');
      setNotificationsAllowed((await Notifications.getPermissionsAsync()).status === 'granted');
    } catch {
      /* ignore */
    }
  };

  const openBatterySettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings();
    }
    setBatteryAllowed(true); // Android does not tell us the final choice
  };

  const handleContinue = () => {
    if (!locationAllowed) {
      Alert.alert('Location required', 'You need to allow location to play. Tap ALLOW on the location card.');
      return;
    }
    router.replace('/home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>PERMISSIONS</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Telemetry Status Bar */}
        <View style={styles.telemetryBar}>
          <View style={styles.telemetryStatus}>
            <View style={styles.pingDot} />
            <Text style={styles.telemetryText}>SYS_INIT // SEC_LAYER</Text>
          </View>
          <Text style={styles.counterText}>AUTH 01/03</Text>
        </View>

        {/* Section Heading */}
        <View style={styles.headingSection}>
          <Text style={styles.mainHeading}>TACTICAL PERMISSIONS</Text>
          <Text style={styles.subHeading}>
            Enable essential hardware sensors for live GPS telemetry and emergency alerts.
          </Text>
        </View>

        {/* Permissions Stack */}
        <View style={styles.cardsStack}>
          {/* 1. Location Always */}
          <View style={styles.permCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.permIcon}>📍</Text>
              <View style={styles.cardTextContent}>
                <Text style={styles.permTitle}>LOCATION ACCESS (ALWAYS)</Text>
                <Text style={styles.permDesc}>
                  Enables real-time radar pings and live distance calculation even with screen locked.
                </Text>
                <View style={styles.permFooterRow}>
                  <Text style={styles.permStatusLabel}>
                    STATUS: {locationAllowed ? 'SYNCED' : 'REQUIRED'}
                  </Text>
                  {locationAllowed ? (
                    <View style={styles.allowedPill}>
                      <Text style={styles.allowedPillText}>✓ ALLOWED</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.allowBtn}
                      onPress={requestLocation}
                    >
                      <Text style={styles.allowBtnText}>ALLOW ›</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* 2. Critical Notifications */}
          <View style={styles.permCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.permIcon}>🔔</Text>
              <View style={styles.cardTextContent}>
                <Text style={styles.permTitle}>CRITICAL NOTIFICATIONS</Text>
                <Text style={styles.permDesc}>
                  Instant haptic warnings when Chasers reveal location or safe zone shrinks.
                </Text>
                <View style={styles.permFooterRow}>
                  <Text style={styles.permStatusLabel}>
                    STATUS: {notificationsAllowed ? 'SYNCED' : 'REQUIRED'}
                  </Text>
                  {notificationsAllowed ? (
                    <View style={styles.allowedPill}>
                      <Text style={styles.allowedPillText}>✓ ALLOWED</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.allowBtn}
                      onPress={requestNotifications}
                    >
                      <Text style={styles.allowBtnText}>ALLOW ›</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* 3. Unrestricted Background */}
          <View style={styles.permCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.permIcon}>⚡</Text>
              <View style={styles.cardTextContent}>
                <Text style={styles.permTitle}>UNRESTRICTED BACKGROUND</Text>
                <Text style={styles.permDesc}>
                  Prevents OS from killing background GPS telemetry during intense sprints.
                </Text>
                <View style={styles.permFooterRow}>
                  <Text style={styles.permStatusLabel}>
                    STATUS: {batteryAllowed ? 'SYNCED' : 'REQUIRED'}
                  </Text>
                  {batteryAllowed ? (
                    <View style={styles.allowedPill}>
                      <Text style={styles.allowedPillText}>✓ ALLOWED</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.allowBtn}
                      onPress={openBatterySettings}
                    >
                      <Text style={styles.allowBtnText}>ALLOW ›</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom CTA */}
        <View style={styles.bottomBlock}>
          <Button
            label="CONTINUE TO HQ"
            variant="primary"
            onPress={handleContinue}
            style={styles.continueBtn}
          />
          <Text style={styles.footerNote}>
            Location permission verified. You can update sensor permissions anytime in Settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: 28,
  },
  headerTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
  },
  placeholder: {
    width: 40,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  telemetryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  telemetryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  telemetryText: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  counterText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  headingSection: {
    marginBottom: spacing.xl,
  },
  mainHeading: {
    color: colors.textPrimary,
    ...typography.headlineLg,
    letterSpacing: 1,
    marginBottom: 4,
  },
  subHeading: {
    color: colors.textSecondary,
    ...typography.bodyMd,
    lineHeight: 20,
  },
  cardsStack: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  permCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  permIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  cardTextContent: {
    flex: 1,
  },
  permTitle: {
    color: colors.textPrimary,
    ...typography.labelMonoMd,
    fontSize: 13,
    marginBottom: 4,
  },
  permDesc: {
    color: colors.textSecondary,
    ...typography.bodySm,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  permFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permStatusLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  allowedPill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  allowedPillText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  allowBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  allowBtnText: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  bottomBlock: {
    marginTop: 'auto',
  },
  continueBtn: {
    marginBottom: spacing.sm,
  },
  footerNote: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
