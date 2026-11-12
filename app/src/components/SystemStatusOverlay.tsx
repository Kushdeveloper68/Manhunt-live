import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectionStore, MAX_RECONNECT_ATTEMPTS } from '../stores/connectionStore';
import { useLiveGameStore } from '../stores/liveGameStore';
import { useLobbyStore } from '../stores/lobbyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTrackingStore } from '../stores/trackingStore';
import { retryConnection } from '../services/socket';
import { restartLocationTracking } from '../services/location';
import { colors, typography, spacing, radii } from '../theme/theme';

const WEAK_GPS_METERS = 35;
const LOW_BATTERY_PERCENT = 15;

/** Battery level in percent, or null where the module/device can't tell us. */
function useBatteryPercent(): number | null {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    let sub: { remove?: () => void } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Battery = require('expo-battery');
      Battery.getBatteryLevelAsync()
        .then((l: number) => setPct(l >= 0 ? Math.round(l * 100) : null))
        .catch(() => {});
      sub = Battery.addBatteryLevelListener(({ batteryLevel }: { batteryLevel: number }) =>
        setPct(batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null)
      );
    } catch {
      /* battery module not in this build */
    }
    return () => sub?.remove?.();
  }, []);
  return pct;
}

interface Banner {
  key: string;
  icon: string;
  title: string;
  text: string;
  tone: 'danger' | 'warning';
  action?: { label: string; onPress: () => void };
}

/**
 * Real system-state banners: SIGNAL LOST, WEAK GPS, LOW BATTERY.
 * They only appear while the player is actually in a lobby or match.
 */
export function SystemStatusOverlay() {
  const insets = useSafeAreaInsets();
  const { connected, attempt, failed } = useConnectionStore();
  const inMatch = useLiveGameStore((s) => !!s.gameId && (s.status === 'running' || s.status === 'countdown'));
  const inLobby = useLobbyStore((s) => !!s.gameState);
  const accuracy = useLiveGameStore((s) => s.myAccuracy);
  const lowBatteryMode = useSettingsStore((s) => s.lowBatteryMode);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const battery = useBatteryPercent();
  const trackingMode = useTrackingStore((s) => s.mode);

  const banners: Banner[] = [];

  if (!connected && (inMatch || inLobby)) {
    banners.push({
      key: 'signal',
      icon: '📡',
      title: 'SIGNAL LOST',
      text: failed ? 'Could not reconnect automatically.' : `Reconnecting (attempt ${Math.max(attempt, 1)}/${MAX_RECONNECT_ATTEMPTS})…`,
      tone: 'danger',
      action: { label: 'RETRY NOW', onPress: retryConnection },
    });
  }

  if (inMatch && trackingMode === 'foreground') {
    banners.push({
      key: 'bg',
      icon: '🔒',
      title: 'TRACKING PAUSES WHEN SCREEN LOCKS',
      text: 'Set location to "Allow all the time" so your position keeps updating.',
      tone: 'warning',
      action: { label: 'FIX PERMISSION', onPress: () => Linking.openSettings() },
    });
  }

  if (inMatch && accuracy !== null && accuracy > WEAK_GPS_METERS) {
    banners.push({
      key: 'gps',
      icon: '🛰',
      title: 'WEAK GPS',
      text: `Accuracy ±${Math.round(accuracy)} m. Move to open sky for a better fix.`,
      tone: 'warning',
      action: {
        label: 'LOCATION SETTINGS',
        onPress: () => {
          if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
          } else {
            Linking.openSettings();
          }
        },
      },
    });
  }

  if (inMatch && battery !== null && battery <= LOW_BATTERY_PERCENT && !lowBatteryMode) {
    banners.push({
      key: 'battery',
      icon: '🔋',
      title: `BATTERY ${battery}%`,
      text: 'Turn on low-battery mode so tracking lasts longer.',
      tone: 'warning',
      action: {
        label: 'ENABLE SAVER',
        onPress: () => {
          setSetting('lowBatteryMode', true);
          void restartLocationTracking();
        },
      },
    });
  }

  if (banners.length === 0) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 100 }]} pointerEvents="box-none">
      {banners.map((b) => (
        <View key={b.key} style={[styles.card, b.tone === 'danger' ? styles.danger : styles.warning]}>
          <Text style={styles.icon}>{b.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{b.title}</Text>
            <Text style={styles.text}>{b.text}</Text>
          </View>
          {b.action && (
            <TouchableOpacity style={styles.btn} onPress={b.action.onPress} activeOpacity={0.85}>
              <Text style={styles.btnText}>{b.action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 40, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
  },
  danger: { borderColor: colors.signalDanger },
  warning: { borderColor: colors.signalWarning },
  icon: { fontSize: 22 },
  title: { ...typography.labelMonoMd, color: colors.textPrimary, fontWeight: '700' },
  text: { ...typography.bodyMd, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: colors.accentPrimary, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8 },
  btnText: { ...typography.labelMonoSm, color: colors.textInverse, fontWeight: '800' },
});
