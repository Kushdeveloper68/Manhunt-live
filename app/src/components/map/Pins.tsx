import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme/theme';

/** You: a role-coloured dot with a heading pointer. */
export function SelfPin({ color, heading }: { color: string; heading: number }) {
  return (
    <View style={styles.selfWrap}>
      <View style={[styles.headingWrap, { transform: [{ rotate: `${heading}deg` }] }]}>
        <View style={[styles.headingTip, { borderBottomColor: color }]} />
      </View>
      <View style={[styles.selfDot, { backgroundColor: color }]} />
    </View>
  );
}

/** A live player (teammate, or a runner exposed by a zone penalty). */
export function PlayerPin({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.pinBox}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.labelWrap}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** A revealed position: a ring that fades the older the information is. */
export function PingPin({ color, label, opacity }: { color: string; label: string; opacity: number }) {
  return (
    <View style={[styles.pinBox, { opacity }]}>
      <View style={[styles.ring, { borderColor: color }]}>
        <View style={[styles.ringCore, { backgroundColor: color }]} />
      </View>
      <View style={[styles.labelWrap, { borderColor: color }]}>
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Spectators: where you were eliminated. */
export function FellPin() {
  return (
    <View style={styles.pinBox}>
      <View style={[styles.sosDot, { backgroundColor: '#1C1C1C', borderColor: '#FF3B30' }]}>
        <Text style={{ fontSize: 16 }}>💀</Text>
      </View>
      <View style={[styles.labelWrap, { borderColor: '#FF3B30' }]}>
        <Text style={[styles.label, { color: '#FF3B30' }]}>YOU FELL HERE</Text>
      </View>
    </View>
  );
}

export function SosPin({ label }: { label: string }) {
  return (
    <View style={styles.pinBox}>
      <View style={styles.sosDot}>
        <Text style={styles.sosText}>SOS</Text>
      </View>
      <View style={[styles.labelWrap, { borderColor: '#FF1744' }]}>
        <Text style={[styles.label, { color: '#FF1744' }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Containers are fixed-size so the map can anchor the dot at the exact centre.
  selfWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  headingWrap: { position: 'absolute', width: 56, height: 56, alignItems: 'center' },
  headingTip: {
    width: 0,
    height: 0,
    marginTop: 2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  selfDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#FFFFFF' },

  pinBox: { width: 150, height: 72, alignItems: 'center' },
  dot: { position: 'absolute', top: 28, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF' },
  ring: {
    position: 'absolute',
    top: 22,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCore: { width: 8, height: 8, borderRadius: 4 },
  sosDot: {
    position: 'absolute',
    top: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF1744',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sosText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  labelWrap: {
    position: 'absolute',
    top: 52,
    maxWidth: 150,
    backgroundColor: 'rgba(10,10,10,0.8)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: { ...typography.labelMonoSm, color: colors.textPrimary, fontSize: 10, fontWeight: '700' },
});
