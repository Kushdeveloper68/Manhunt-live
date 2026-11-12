import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { colors } from '../src/theme/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useStatusStore } from '../src/stores/statusStore';
import { SystemStatusOverlay } from '../src/components/SystemStatusOverlay';

// Screens that can be opened without being logged in
const PUBLIC_SEGMENTS = [undefined, 'splash', 'onboarding', 'auth', 'legal', 'dev'];

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const notice = useStatusStore((s) => s.notice);

  // Restore the saved login and settings once on startup
  useEffect(() => {
    void useAuthStore.getState().hydrate();
    void useSettingsStore.getState().hydrate();
  }, []);

  // Match cancelled / removed from lobby: show the full-screen notice wherever the player is
  useEffect(() => {
    if (notice) router.replace('/game/status');
  }, [notice, router]);

  // Logged-out users (or an expired token) are always sent back to login
  useEffect(() => {
    if (!hydrated) return;
    const first = segments[0] as string | undefined;
    if (!isAuthenticated && !PUBLIC_SEGMENTS.includes(first)) {
      router.replace('/auth/login');
    }
  }, [hydrated, isAuthenticated, segments, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.canvas} />
      <SystemStatusOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});
