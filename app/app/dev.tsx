import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../src/theme/theme';
import {
  Button,
  Card,
  Chip,
  Input,
  CodeInput,
  BottomSheet,
  Toast,
} from '../src/components';
import { useAuthStore } from '../src/stores/authStore';

export default function BlankThemedScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [code, setCode] = useState('MH7842');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [inputText, setInputText] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header telemetry & Title */}
        <View style={styles.header}>
          <Text style={styles.telemetryTag}>SYSTEM_ONLINE // PROTOCOL_0</Text>
          <Text style={styles.title}>MANHUNT LIVE</Text>
          <Text style={styles.subtitle}>REAL-WORLD GPS PURSUIT PLATFORM</Text>
          {isAuthenticated && user && (
            <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Chip label={`CALLSIGN: @${user.username}`} variant="active" />
              <Button label="LOGOUT" variant="secondary" onPress={logout} style={{ height: 28, paddingHorizontal: 10 }} />
            </View>
          )}
        </View>

        {/* Batch 2 Screens Navigation */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>BATCH 2 // HOME, JOIN & CREATE GAME</Text>
          <View style={{ gap: spacing.sm }}>
            <Button
              label="★ Launch Home Screen"
              variant="primary"
              onPress={() => router.push('/home')}
            />
            <Button
              label="Join Game by Code (6 Chars)"
              variant="secondary"
              onPress={() => router.push('/game/join')}
            />
            <Button
              label="Create Game 4-Step Wizard"
              variant="secondary"
              onPress={() => router.push('/game/create/step1')}
            />
          </View>
        </View>

        {/* Batch 1 Screens Navigation */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>BATCH 1 // AUTH & PROFILE SCREENS</Text>
          <View style={{ gap: spacing.sm }}>
            <Button
              label="1. Launch Splash Protocol"
              variant="primary"
              onPress={() => router.push('/splash')}
            />
            <Button
              label="2. View Onboarding Briefing (3 Cards)"
              variant="secondary"
              onPress={() => router.push('/onboarding')}
            />
            <Button
              label="3. Authentication Gateway (Login/Signup)"
              variant="secondary"
              onPress={() => router.push('/auth/login')}
            />
            <Button
              label="4. Create Profile (Callsign & Avatar)"
              variant="secondary"
              onPress={() => router.push('/auth/profile')}
            />
            <Button
              label="5. Tactical Permissions (Always Location)"
              variant="secondary"
              onPress={() => router.push('/auth/permissions')}
            />
          </View>
        </View>

        {/* Roles showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TACTICAL ROLES</Text>
          <View style={styles.row}>
            <Chip label="CHASER FORCE" variant="chaser" />
            <Chip label="RUNNER TARGET" variant="runner" />
            <Chip label="READY" variant="active" />
          </View>
        </View>

        {/* Themed Card Showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SYSTEM STATUS</Text>
          <Card variant="active">
            <Text style={styles.cardTitle}>DEPLOYMENT MATRIX</Text>
            <Text style={styles.cardBody}>
              OLED Pitch Black ground layer active (#0A0A0A). Structural 1px boundaries
              enforced.
            </Text>
          </Card>
        </View>

        {/* Inputs & Code Input Showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AUTHENTICATION & CODES</Text>
          <Input
            label="Callsign / Handle"
            placeholder="ENTER CALLSIGN"
            value={inputText}
            onChangeText={setInputText}
          />
          <Text style={styles.labelSub}>SESSION ACCESS KEY (6 CHARS)</Text>
          <CodeInput length={6} value={code} onChange={setCode} />
        </View>

        {/* Actions Showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIMARY ACTIONS</Text>
          <Button
            label="Initialize Mission"
            variant="primary"
            onPress={() => setToastVisible(true)}
            style={styles.btnSpacing}
          />
          <Button
            label="Tactical Drawer"
            variant="secondary"
            onPress={() => setSheetVisible(true)}
            style={styles.btnSpacing}
          />
          <Button
            label="Abort Sequence (SOS)"
            variant="destructive"
            onPress={() => setToastVisible(true)}
          />
        </View>

        {/* Floating Toast */}
        <Toast
          visible={toastVisible}
          message="TELEMETRY PROTOCOL ACTIVE // 5S TICK"
          type="info"
          onHide={() => setToastVisible(false)}
        />

        {/* Bottom Sheet Drawer */}
        <BottomSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
        >
          <Text style={styles.sheetTitle}>ZONE PARAMETERS</Text>
          <Text style={styles.sheetBody}>
            Zone Radius: 1,500m | Reveal Interval: 2 min | Mode: Classic Manhunt
          </Text>
          <Button
            label="Confirm & Close"
            variant="primary"
            onPress={() => setSheetVisible(false)}
            style={{ marginTop: spacing.lg }}
          />
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  telemetryTag: {
    color: colors.accentPrimary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cardTitle: {
    color: colors.accentPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  labelSub: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  btnSpacing: {
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sheetBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
