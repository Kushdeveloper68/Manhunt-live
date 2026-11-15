import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../src/theme/theme';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/stores/authStore';
import { ageFromDob, isPlausiblePhone } from '@manhunt/shared';

const AVATARS = [
  { id: 'scout', label: 'SCOUT', icon: '🎯' },
  { id: 'stride', label: 'STRIDE', icon: '⚡' },
  { id: 'wolf', label: 'WOLF', icon: '🐺' },
  { id: 'hawk', label: 'HAWK', icon: '🦅' },
  { id: 'ghost', label: 'SPECTER', icon: '👻' },
  { id: 'volt', label: 'VOLT', icon: '🔋' },
  { id: 'shield', label: 'AEGIS', icon: '🛡️' },
  { id: 'skull', label: 'REAPER', icon: '💀' },
];

export default function CreateProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, checkUsername, isLoading } = useAuthStore();

  const [callsign, setCallsign] = useState(user?.username || '');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(true);
  const [isChecking, setIsChecking] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarId || 'wolf');
  const [dob, setDob] = useState(user?.dob ? String(user.dob).slice(0, 10) : '');
  const [contactName, setContactName] = useState(user?.emergencyContact?.name ?? '');
  const [contactPhone, setContactPhone] = useState(user?.emergencyContact?.phone ?? '');

  // Live username availability check with debounce
  useEffect(() => {
    if (!callsign || callsign.trim().length < 3) {
      setIsAvailable(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      const available = await checkUsername(callsign);
      setIsAvailable(available);
      setIsChecking(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [callsign, checkUsername]);

  const handleSubmit = async () => {
    if (!isAvailable) {
      Alert.alert('Invalid Callsign', 'Please choose an available callsign.');
      return;
    }

    const age = ageFromDob(dob);
    if (age === null) {
      Alert.alert('Date of birth', 'Enter your real date of birth as YYYY-MM-DD, e.g. 2004-08-14.');
      return;
    }
    if (age < 13) {
      Alert.alert('Too young', 'Manhunt Live is for players aged 13 and over.');
      return;
    }

    if (!contactName.trim() || !isPlausiblePhone(contactPhone)) {
      Alert.alert('Emergency Contact', 'Enter a real emergency contact name and a valid phone number. SOS uses it to text your location.');
      return;
    }

    // Under 18: a parent/guardian must be OK with this real-world game
    if (age < 18) {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert('Guardian permission', 'Players under 18 need a parent or guardian\'s permission. Do you have it?', [
          { text: 'No', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Yes, I do', onPress: () => resolve(true) },
        ])
      );
      if (!ok) return;
    }

    try {
      await updateProfile({
        username: callsign.toLowerCase(),
        avatarId: selectedAvatar,
        dob,
        emergencyContact: {
          name: contactName.trim(),
          phone: contactPhone.trim(),
        },
      });
      router.replace('/auth/permissions');
    } catch (err) {
      Alert.alert('Update Failed', err instanceof Error ? err.message : 'Could not save profile');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>CREATE PROFILE</Text>
        <View style={styles.profileIconPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Identity Subhead */}
        <View style={styles.subheadSection}>
          <View style={styles.phaseTag}>
            <View style={styles.pulseDot} />
            <Text style={styles.phaseTagText}>PHASE 01 // IDENTITY INITIALIZATION</Text>
          </View>
          <Text style={styles.mainTitle}>CREATE OPERATOR PROFILE</Text>
          <Text style={styles.subTitle}>Initialize field codename and fail-safe telemetry</Text>
        </View>

        {/* Callsign / Username Input with Live Check */}
        <View style={styles.fieldSection}>
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>CODENAME (CALLSIGN)</Text>
            <View style={styles.statusPill}>
              {isChecking ? (
                <Text style={styles.statusPillNeutral}>CHECKING...</Text>
              ) : isAvailable ? (
                <Text style={styles.statusPillSuccess}>✓ AVAILABLE</Text>
              ) : (
                <Text style={styles.statusPillDanger}>✗ TAKEN</Text>
              )}
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.atSymbol}>@</Text>
            <TextInput
              style={styles.textInput}
              value={callsign}
              onChangeText={(text) =>
                setCallsign(text.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
              }
              placeholder="ENTER_HANDLE"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Tactical Insignia Matrix (4x2 Grid) */}
        <View style={styles.fieldSection}>
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>TACTICAL INSIGNIA</Text>
            <Text style={styles.insigniaSub}>08 PROTOCOLS</Text>
          </View>

          <View style={styles.avatarGrid}>
            {AVATARS.map((item) => {
              const isSelected = selectedAvatar === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedAvatar(item.id)}
                  style={[
                    styles.avatarCell,
                    isSelected && styles.avatarCellSelected,
                  ]}
                >
                  {isSelected && <View style={styles.selectedPip} />}
                  <Text style={styles.avatarEmoji}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.avatarLabel,
                      isSelected && styles.avatarLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Operational Readiness (Date of Birth) */}
        <View style={styles.fieldSection}>
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>DATE OF BIRTH (BIOMETRIC AUDIT)</Text>
            <Text style={styles.insigniaSub}>AGE VERIFIED</Text>
          </View>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY - MM - DD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.under18NoteRow}>
            <Text style={styles.under18Icon}>ℹ</Text>
            <Text style={styles.under18NoteText}>
              Requires guardian authorization if under 18 years of age.
            </Text>
          </View>
        </View>

        {/* Emergency Beacon Protocol Card */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeaderRow}>
            <Text style={styles.emergencyTitle}>EMERGENCY CONTACT</Text>
            <View style={styles.sosTag}>
              <Text style={styles.sosTagText}>SOS FAILSAFE</Text>
            </View>
          </View>
          <Text style={styles.emergencySub}>
            Failsafe dispatch. Pinged immediately if SOS beacon is triggered.
          </Text>

          <View style={styles.emergencyInputBlock}>
            <Text style={styles.emergencyInputLabel}>PRIMARY CONTACT FULL NAME</Text>
            <View style={styles.emergencyInputWrapper}>
              <TextInput
                style={styles.textInput}
                value={contactName}
                onChangeText={setContactName}
                placeholder="CONTACT_NAME"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.emergencyInputBlock}>
            <Text style={styles.emergencyInputLabel}>TACTICAL COMM LINE (PHONE)</Text>
            <View style={styles.emergencyInputWrapper}>
              <TextInput
                style={styles.textInput}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+1 (000) 000-0000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            label="CONFIRM OPERATOR"
            variant="primary"
            onPress={handleSubmit}
            loading={isLoading}
          />
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
  profileIconPlaceholder: {
    width: 40,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  subheadSection: {
    marginBottom: spacing.xl,
  },
  phaseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  phaseTagText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 1.2,
  },
  mainTitle: {
    color: colors.textPrimary,
    ...typography.headlineLg,
    letterSpacing: 1,
  },
  subTitle: {
    color: colors.textSecondary,
    ...typography.bodySm,
    marginTop: 2,
  },
  fieldSection: {
    marginBottom: spacing.lg,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
  },
  statusPill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusPillSuccess: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillDanger: {
    color: colors.signalDanger,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillNeutral: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  insigniaSub: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
  },
  atSymbol: {
    color: colors.textSecondary,
    ...typography.labelMonoMd,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.labelMonoMd,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarCell: {
    width: '23%',
    height: 64,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarCellSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.surfaceElevated,
  },
  selectedPip: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  avatarEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  avatarLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  avatarLabelSelected: {
    color: colors.accentPrimary,
    fontWeight: '700',
  },
  under18NoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  under18Icon: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  under18NoteText: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontSize: 11,
  },
  emergencyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  emergencyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emergencyTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
  },
  sosTag: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderColor: colors.signalDanger,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sosTagText: {
    color: colors.signalDanger,
    ...typography.labelMonoSm,
    fontSize: 9,
    fontWeight: '700',
  },
  emergencySub: {
    color: colors.textSecondary,
    ...typography.bodySm,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  emergencyInputBlock: {
    marginBottom: spacing.sm,
  },
  emergencyInputLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    marginBottom: 4,
  },
  emergencyInputWrapper: {
    height: 48,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  submitContainer: {
    marginTop: spacing.sm,
  },
});
