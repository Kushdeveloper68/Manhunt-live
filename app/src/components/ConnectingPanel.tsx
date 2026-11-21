import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useConnectionStore } from '../stores/connectionStore';
import { useLobbyStore } from '../stores/lobbyStore';
import { getServerUrl, isEmulatorAddress } from '../services/socket';
import { colors, typography, spacing, radii } from '../theme/theme';

const SHOW_HELP_AFTER_S = 8;

/**
 * Replaces the endless "syncing" spinner. After a few seconds it says WHY it is stuck
 * (wrong server address, server unreachable, lobby closed) and offers Retry / Back.
 */
export function ConnectingPanel({ title, onRetry, onBack }: { title: string; onRetry: () => void; onBack: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const connected = useConnectionStore((s) => s.connected);
  const lastError = useConnectionStore((s) => s.lastError);
  const socketError = useLobbyStore((s) => s.socketError);

  useEffect(() => {
    const t = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const stuck = seconds >= SHOW_HELP_AFTER_S || !!socketError;
  const url = getServerUrl();

  let help: string | null = null;
  if (stuck) {
    if (socketError) help = socketError;
    else if (isEmulatorAddress())
      help =
        'The app is pointing at 10.0.2.2, which only works in the Android emulator. On a real phone set EXPO_PUBLIC_API_URL in app/.env to your PC\'s WiFi address (e.g. http://192.168.1.23:4000/api), then restart Metro with: npx expo start --dev-client --clear';
    else if (!connected)
      help = `Cannot reach the game server at ${url}. Check: server running, phone on the same WiFi as the PC, firewall allows port 4000.`;
    else help = 'Connected, but the server did not send this lobby. It may have been closed.';
  }

  return (
    <View style={styles.wrap}>
      {!stuck && <ActivityIndicator color={colors.accentPrimary} />}
      <Text style={styles.title}>{stuck ? 'STILL CONNECTING…' : title}</Text>
      {help && (
        <>
          <Text style={styles.help}>{help}</Text>
          <Text style={styles.detail}>Server: {url}</Text>
          {!!lastError && <Text style={styles.detail}>Last error: {lastError}</Text>}
        </>
      )}
      {stuck && (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
            <Text style={styles.btnText}>RETRY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onBack} activeOpacity={0.85}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>BACK</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  title: { ...typography.labelMonoMd, color: colors.textPrimary, fontWeight: '800', marginTop: spacing.sm },
  help: { ...typography.bodyMd, color: colors.textSecondary, textAlign: 'center', fontSize: 13, maxWidth: 320 },
  detail: { ...typography.labelMonoSm, color: colors.textSecondary, fontSize: 10, textAlign: 'center', opacity: 0.8 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: { borderWidth: 1, borderColor: colors.accentPrimary, borderRadius: radii.pill, paddingHorizontal: 22, paddingVertical: 10 },
  btnGhost: { borderColor: colors.borderSubtle },
  btnText: { ...typography.labelMonoSm, color: colors.accentPrimary, fontWeight: '800' },
});
