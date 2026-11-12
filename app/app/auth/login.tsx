import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../src/theme/theme';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { BottomSheet } from '../../src/components/BottomSheet';
import { useAuthStore } from '../../src/stores/authStore';
import { getGoogleIdToken, DEV_GOOGLE_MOCK_ENABLED } from '../../src/services/googleSignIn';

// Returning users go straight home; brand-new accounts finish profile setup first
const nextAfterAuth = () => (useAuthStore.getState().user?.dob ? '/home' : '/auth/profile');

export default function LoginScreen() {
  const router = useRouter();
  const { login, register, loginGoogle, isLoading } = useAuthStore();

  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      if (DEV_GOOGLE_MOCK_ENABLED) {
        // DEV ONLY (needs ALLOW_DEV_GOOGLE_MOCK=true on the server): fake identity, no real Google
        const mockGoogleId = `google_user_${Math.floor(100000 + Math.random() * 900000)}`;
        await loginGoogle({ googleId: mockGoogleId, email: `operator_${mockGoogleId.slice(-4)}@gmail.com` });
      } else {
        // Real flow: Google returns an ID token, the server verifies it
        const idToken = await getGoogleIdToken();
        await loginGoogle({ idToken });
      }
      router.replace(nextAfterAuth());
    } catch (err) {
      Alert.alert('Sign-In Error', err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const handleEmailSubmit = async () => {
    setFormError(null);
    if (!email.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    try {
      if (isRegistering) {
        if (username.length < 3) {
          setFormError('Callsign must be at least 3 characters');
          return;
        }
        await register(email, password, username);
        setEmailModalVisible(false);
        router.replace(nextAfterAuth());
      } else {
        await login(email, password);
        setEmailModalVisible(false);
        router.replace(nextAfterAuth());
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const handleSpectatorQuickDispatch = () => {
    Alert.alert('Spectator mode', 'Spectating needs a game code from the host. Coming soon.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Spatial Telemetry & Brand Section */}
        <View style={styles.topSection}>
          <View style={styles.statusChip}>
            <View style={styles.pulsingDot} />
            <Text style={styles.statusChipText}>GRID ONLINE • METRO NYC</Text>
          </View>

          {/* Crosshair Graphic */}
          <View style={styles.crosshairBadge}>
            <View style={styles.crosshairCrossH} />
            <View style={styles.crosshairCrossV} />
            <View style={styles.crosshairCenterDot} />
          </View>

          <Text style={styles.brandTitle}>MANHUNT LIVE</Text>
          <Text style={styles.brandSubtitle}>Enter the real-world chase network.</Text>

          {/* Radar Sweep Live Lobbies Display */}
          <View style={styles.radarCard}>
            <View style={styles.radarCardHeader}>
              <Text style={styles.radarCardHeaderText}>ACTIVE LOBBIES NEAR YOU</Text>
              <Text style={styles.radarCardHeaderHighlight}>14 OPS</Text>
            </View>
            <View style={styles.radarCardMetrics}>
              <View style={styles.metricItem}>
                <View style={[styles.metricDot, { backgroundColor: colors.roleChaser }]} />
                <Text style={styles.metricText}>CHASERS: 42</Text>
              </View>
              <Text style={styles.metricDivider}>•</Text>
              <View style={styles.metricItem}>
                <View style={[styles.metricDot, { backgroundColor: colors.roleRunner }]} />
                <Text style={styles.metricText}>RUNNERS: 18</Text>
              </View>
              <Text style={styles.metricDivider}>•</Text>
              <View style={styles.metricItem}>
                <Text style={styles.metricRadarText}>0.8 KM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Primary Interactive Pathway Zone */}
        <View style={styles.actionSection}>
          <Button
            label="Continue with Google"
            variant="primary"
            onPress={handleGoogleSignIn}
            loading={isLoading}
            style={styles.actionBtn}
          />

          <Button
            label="Continue with Email"
            variant="secondary"
            onPress={() => setEmailModalVisible(true)}
            style={styles.actionBtn}
          />

          <Pressable
            onPress={handleSpectatorQuickDispatch}
            style={styles.spectatorButton}
          >
            <Text style={styles.spectatorText}>SPECTATOR QUICK DISPATCH</Text>
          </Pressable>
        </View>

        {/* Bottom Legal & Safety Footer */}
        <View style={styles.footerSection}>
          <Text style={styles.legalText}>
            By continuing, you agree to the{' '}
            <Text style={styles.legalLink}>Terms of Service</Text> and{' '}
            <Text style={styles.legalLink}>Safety Policy</Text>.
          </Text>
          <View style={styles.encryptedTag}>
            <View style={styles.smallGreenDot} />
            <Text style={styles.encryptedText}>ENCRYPTED GPS DISPATCH v4.12</Text>
          </View>
        </View>

        {/* Email Sign-In / Register Modal */}
        <BottomSheet
          visible={emailModalVisible}
          onClose={() => setEmailModalVisible(false)}
        >
          <Text style={styles.modalTitle}>
            {isRegistering ? 'INITIALIZE OPERATOR' : 'TACTICAL LOGIN'}
          </Text>
          <Text style={styles.modalSub}>
            {isRegistering
              ? 'Create your credentials for the chase network'
              : 'Enter email and password to resume field ops'}
          </Text>

          {isRegistering && (
            <Input
              label="Callsign (Username)"
              placeholder="e.g. shadow_stalker"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          )}

          <Input
            label="Tactical Email"
            placeholder="operator@manhunt.live"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label="Security Passkey"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {formError && <Text style={styles.formErrorText}>{formError}</Text>}

          <Button
            label={isRegistering ? 'CREATE ACCOUNT' : 'LOGIN'}
            variant="primary"
            onPress={handleEmailSubmit}
            loading={isLoading}
            style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}
          />

          <Pressable
            onPress={() => {
              setIsRegistering((prev) => !prev);
              setFormError(null);
            }}
            style={styles.switchModeBtn}
          >
            <Text style={styles.switchModeText}>
              {isRegistering
                ? 'Already have an account? Log in'
                : 'Need an account? Register'}
            </Text>
          </Pressable>
        </BottomSheet>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  statusChipText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 1.2,
  },
  crosshairBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  crosshairCrossH: {
    position: 'absolute',
    width: 18,
    height: 2,
    backgroundColor: colors.accentPrimary,
  },
  crosshairCrossV: {
    position: 'absolute',
    height: 18,
    width: 2,
    backgroundColor: colors.accentPrimary,
  },
  crosshairCenterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.canvas,
  },
  brandTitle: {
    color: colors.textPrimary,
    ...typography.headlineLg,
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    color: colors.textSecondary,
    ...typography.bodyMd,
    marginTop: 4,
  },
  radarCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  radarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  radarCardHeaderText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
  },
  radarCardHeaderHighlight: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontWeight: '700',
  },
  radarCardMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricText: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  metricRadarText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  metricDivider: {
    color: colors.borderSubtle,
  },
  actionSection: {
    width: '100%',
    marginVertical: spacing.lg,
  },
  actionBtn: {
    marginBottom: spacing.sm,
  },
  spectatorButton: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  spectatorText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 1,
  },
  footerSection: {
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  legalText: {
    color: colors.textSecondary,
    ...typography.bodySm,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  encryptedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  smallGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accentPrimary,
  },
  encryptedText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
    letterSpacing: 1,
  },
  modalTitle: {
    color: colors.textPrimary,
    ...typography.headlineMd,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  modalSub: {
    color: colors.textSecondary,
    ...typography.bodyMd,
    marginBottom: spacing.lg,
  },
  formErrorText: {
    color: colors.signalDanger,
    ...typography.bodySm,
    marginBottom: spacing.sm,
  },
  switchModeBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  switchModeText: {
    color: colors.accentPrimary,
    ...typography.bodySm,
  },
});
