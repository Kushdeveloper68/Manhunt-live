import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { api } from '../src/services/api';
import { restartLocationTracking } from '../src/services/location';
import { registerForPushNotifications, unregisterPushNotifications } from '../src/services/push';
import { colors, typography, spacing, radii } from '../src/theme/theme';

const EMERGENCY_NUMBER = process.env.EXPO_PUBLIC_EMERGENCY_NUMBER || '112';

function Section({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {index}. {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  title,
  sub,
  right,
  last,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function PillButton({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.pill, danger && styles.pillDanger]}>
      <Text style={[styles.pillText, danger && { color: colors.signalDanger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, logout } = useAuthStore();
  const { highPrecisionGps, lowBatteryMode, geofenceHaptics, setSetting } = useSettingsStore();

  const [locationState, setLocationState] = useState<'checking' | 'always' | 'partial' | 'denied'>('checking');
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [editingContact, setEditingContact] = useState(false);
  const [contactName, setContactName] = useState(user?.emergencyContact?.name ?? '');
  const [contactPhone, setContactPhone] = useState(user?.emergencyContact?.phone ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshPermissions = useCallback(async () => {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      setLocationState(fg.status !== 'granted' ? 'denied' : bg.status === 'granted' ? 'always' : 'partial');
    } catch {
      setLocationState('denied');
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications');
      setNotifGranted((await Notifications.getPermissionsAsync()).status === 'granted');
    } catch {
      setNotifGranted(null);
    }
  }, []);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  const changeGps = (key: 'highPrecisionGps' | 'lowBatteryMode', value: boolean) => {
    setSetting(key, value);
    void restartLocationTracking(); // apply to a running tracker straight away
  };

  const saveContact = async () => {
    const phone = contactPhone.trim();
    if (phone.length > 0 && !/^[+0-9\s-]{7,20}$/.test(phone)) {
      Alert.alert('Invalid number', 'Enter a valid phone number, e.g. +91 98765 43210');
      return;
    }
    try {
      setBusy(true);
      await updateProfile({ emergencyContact: { name: contactName.trim(), phone } });
      setEditingContact(false);
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const signOut = () =>
    Alert.alert('Sign out', 'You will need to log in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await unregisterPushNotifications();
          logout();
          router.replace('/auth/login');
        },
      },
    ]);

  const deleteAccount = async () => {
    try {
      setBusy(true);
      await api.deleteAccount(deleteConfirm.trim());
      logout();
      router.replace('/auth/login');
    } catch (err) {
      Alert.alert('Could not delete account', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const locationLabel = {
    checking: '…',
    always: 'ALWAYS ALLOWED',
    partial: 'ONLY WHILE IN USE',
    denied: 'DENIED',
  }[locationState];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}>
        <Section index={1} title="GPS & LOCATION">
          <Row
            title="High-precision GPS"
            sub="Faster, sharper position updates. Uses more battery."
            right={<Switch value={highPrecisionGps && !lowBatteryMode} disabled={lowBatteryMode} onValueChange={(v) => changeGps('highPrecisionGps', v)} trackColor={{ true: colors.accentPrimary, false: colors.borderSubtle }} />}
          />
          <Row
            title="Low-battery mode"
            sub="Updates your position every 10 seconds to save battery."
            right={<Switch value={lowBatteryMode} onValueChange={(v) => changeGps('lowBatteryMode', v)} trackColor={{ true: colors.accentPrimary, false: colors.borderSubtle }} />}
          />
          <Row
            title="Zone-edge haptics"
            sub="Vibrate when you are within 50 m of the zone boundary."
            right={<Switch value={geofenceHaptics} onValueChange={(v) => setSetting('geofenceHaptics', v)} trackColor={{ true: colors.accentPrimary, false: colors.borderSubtle }} />}
          />
          <Row
            title="Location permission"
            sub={locationState === 'always' ? 'Tracking keeps working with the screen locked.' : 'Choose "Allow all the time" so tracking continues when the screen locks.'}
            right={<PillButton label={locationLabel === 'ALWAYS ALLOWED' ? 'MANAGE' : 'FIX'} onPress={() => Linking.openSettings()} />}
            last
          />
        </Section>

        <Section index={2} title="NOTIFICATIONS">
          <Row
            title="Push notifications"
            sub="Squad invites, friend requests, zone-shrink and reveal warnings."
            right={
              notifGranted ? (
                <PillButton label="MANAGE" onPress={() => Linking.openSettings()} />
              ) : (
                <PillButton
                  label="ENABLE"
                  onPress={async () => {
                    await registerForPushNotifications();
                    void refreshPermissions();
                  }}
                />
              )
            }
            last
          />
        </Section>

        <Section index={3} title="SAFETY">
          <Row
            title="Emergency contact"
            sub={user?.emergencyContact?.phone ? `${user.emergencyContact.name || 'Contact'} (${user.emergencyContact.phone})` : 'Not set. Add one so SOS can text your location.'}
            right={<PillButton label={editingContact ? 'CLOSE' : 'EDIT'} onPress={() => setEditingContact((v) => !v)} />}
            last={!editingContact}
          />
          {editingContact && (
            <View style={styles.editBox}>
              <TextInput style={styles.input} placeholder="Contact name" placeholderTextColor={colors.textSecondary} value={contactName} onChangeText={setContactName} />
              <TextInput style={styles.input} placeholder="Phone, e.g. +91 98765 43210" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
              <TouchableOpacity style={[styles.primary, busy && { opacity: 0.6 }]} disabled={busy} onPress={saveContact}>
                <Text style={styles.primaryText}>SAVE CONTACT</Text>
              </TouchableOpacity>
            </View>
          )}
          <Row title="SOS button" sub="In a match, press and hold the SOS button for 3 seconds. Your host is alerted and you can text your contact." />
          <Row title="Emergency number" sub={`Dial ${EMERGENCY_NUMBER} for emergency services in India.`} last />
        </Section>

        <Section index={4} title="ACCOUNT & LEGAL">
          <Row title="Terms & Safety Policy" sub="Players are solely responsible for their own safety." right={<PillButton label="READ" onPress={() => router.push('/legal/terms')} />} />
          <Row title="App version" sub={`v${Constants.expoConfig?.version ?? '1.0.0'}`} />
          <Row title="Sign out" right={<PillButton label="SIGN OUT" onPress={signOut} />} />
          <Row
            title="Delete account"
            sub="Permanently removes your account, friends and invites."
            right={<PillButton label={deleteOpen ? 'CANCEL' : 'DELETE'} danger onPress={() => setDeleteOpen((v) => !v)} />}
            last={!deleteOpen}
          />
          {deleteOpen && (
            <View style={styles.editBox}>
              <Text style={styles.rowSub}>
                Type your callsign <Text style={{ color: colors.textPrimary }}>@{user?.username}</Text> to confirm. This cannot be undone.
              </Text>
              <TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} placeholder="Your callsign" placeholderTextColor={colors.textSecondary} value={deleteConfirm} onChangeText={setDeleteConfirm} />
              <TouchableOpacity
                style={[styles.dangerBtn, (busy || deleteConfirm.trim().toLowerCase() !== user?.username) && { opacity: 0.4 }]}
                disabled={busy || deleteConfirm.trim().toLowerCase() !== user?.username}
                onPress={deleteAccount}
              >
                <Text style={styles.dangerText}>DELETE MY ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, height: 56 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.textPrimary, fontSize: 22 },
  headerTitle: { ...typography.headlineSm, color: colors.textPrimary },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.labelMonoSm, color: colors.accentPrimary, letterSpacing: 1, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.borderSubtle, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  rowTitle: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
  rowSub: { ...typography.bodyMd, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  pill: { borderWidth: 1, borderColor: colors.accentPrimary, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillDanger: { borderColor: colors.signalDanger },
  pillText: { ...typography.labelMonoSm, color: colors.accentPrimary, fontWeight: '700' },
  editBox: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  input: { backgroundColor: colors.surfaceElevated, borderRadius: radii.input, color: colors.textPrimary, paddingHorizontal: spacing.md, height: 48, borderWidth: 1, borderColor: colors.borderSubtle },
  primary: { backgroundColor: colors.accentPrimary, borderRadius: radii.button, height: 48, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...typography.labelMonoMd, color: colors.textInverse, fontWeight: '800' },
  dangerBtn: { backgroundColor: colors.signalDanger, borderRadius: radii.button, height: 48, alignItems: 'center', justifyContent: 'center' },
  dangerText: { ...typography.labelMonoMd, color: colors.textPrimary, fontWeight: '800' },
});
