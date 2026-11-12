import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveGameStore } from '../stores/liveGameStore';
import { colors, typography, spacing, radii } from '../theme/theme';

/**
 * Host-only safety banner: shows every player whose SOS is currently active,
 * with a one-tap link to their live position in the maps app.
 */
export function SosBanner() {
  const insets = useSafeAreaInsets();
  const incomingSos = useLiveGameStore((s) => s.incomingSos);
  const entries = Object.values(incomingSos);
  if (entries.length === 0) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      {entries.map((sos) => (
        <View key={sos.userId} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>🚨 SOS FROM @{sos.username.toUpperCase()}</Text>
            <Text style={styles.sub}>
              {sos.coordinates ? 'Live position updating' : 'Location unavailable. Contact them directly.'}
            </Text>
          </View>
          {sos.coordinates && (
            <TouchableOpacity
              style={styles.btn}
              onPress={() =>
                Linking.openURL(
                  `https://maps.google.com/?q=${sos.coordinates!.latitude},${sos.coordinates!.longitude}`
                )
              }
            >
              <Text style={styles.btnText}>OPEN MAP</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 50, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#93000A',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FF1744',
  },
  title: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  sub: { color: '#FFDAD6', fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: '#FFFFFF', borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { color: '#93000A', fontWeight: '800', fontSize: 12 },
});
