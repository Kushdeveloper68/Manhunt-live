import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../../src/theme/theme';
import { Button } from '../../../src/components/Button';
import { useGameStore } from '../../../src/stores/gameStore';

const CHECKLIST_ITEMS = [
  'Stay off highways, active train tracks, and vehicular roadways.',
  'Respect private property, trespass laws, and residential zones.',
  'Avoid unlit public areas and isolated sectors when operating alone.',
  'Maintain operational buddy system / squad contact.',
  'Verify all operatives understand the 3-second SOS beacon protocol.',
];

export default function CreateStep4SafetyCheck() {
  const router = useRouter();
  const { createGameFromDraft, isLoading, error } = useGameStore();

  const [checkedIndices, setCheckedIndices] = useState<number[]>([]);

  const toggleCheck = (index: number) => {
    setCheckedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const allChecked = checkedIndices.length === CHECKLIST_ITEMS.length;

  const handleCreateGame = async () => {
    if (!allChecked) {
      Alert.alert('Safety Check Required', 'You must verify all 5 safety requirements before hosting.');
      return;
    }

    try {
      const created = await createGameFromDraft();
      Alert.alert(
        'SESSION INITIALIZED',
        `Match "${created.name}" established with Uplink Key: ${created.code}`,
        [
          {
            text: 'GO TO LOBBY',
            onPress: () =>
              router.replace({
                pathname: '/lobby/host',
                params: { gameId: String((created as any)._id ?? (created as any).id) },
              }),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Creation Failed', err instanceof Error ? err.message : 'Could not create game session');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header & Step Progress Bar */}
      <View style={styles.header}>
        <View style={styles.headerNavRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>
          <View style={styles.headerTitleCenter}>
            <Text style={styles.headerTitle}>STEP 4 SAFETY & REVIEW</Text>
            <Text style={styles.stepProgressText}>STEP 4 OF 4</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '100%' }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Progress Tracker */}
        <View style={styles.progressRow}>
          <Text style={styles.phaseText}>PROTOCOL PHASE 04/04</Text>
          <Text
            style={[
              styles.readyText,
              allChecked && { color: colors.accentPrimary },
            ]}
          >
            {allChecked ? '100% READY' : `${checkedIndices.length * 20}% VERIFIED`}
          </Text>
        </View>

        {/* Tactical Notice Banner */}
        <View style={styles.bannerBox}>
          <View style={styles.bannerIconBox}>
            <Text style={styles.bannerIcon}>🛡</Text>
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>BEFORE YOU PLAY</Text>
            <Text style={styles.bannerDesc}>
              Mandatory field safety protocol verification prior to sector deployment.
            </Text>
          </View>
        </View>

        {/* Environmental Hazard Advisory */}
        <View style={styles.hazardBox}>
          <View style={styles.hazardIconBox}>
            <Text style={styles.hazardIcon}>🌙</Text>
          </View>
          <View style={styles.hazardContent}>
            <Text style={styles.hazardTitle}>SUNSET DETECTED (18:42)</Text>
            <Text style={styles.hazardDesc}>
              Operatives must carry high-visibility reflective bands or tactical torches.
            </Text>
          </View>
        </View>

        {/* Checklist Section */}
        <View style={styles.checklistSection}>
          <View style={styles.checklistHeader}>
            <Text style={styles.checklistTitle}>HOST VERIFICATION CHECKLIST</Text>
            <View
              style={[
                styles.counterBadge,
                allChecked && styles.counterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.counterText,
                  allChecked && styles.counterTextActive,
                ]}
              >
                {checkedIndices.length}/5 VERIFIED
              </Text>
            </View>
          </View>

          {/* Checklist Items */}
          <View style={styles.checklistStack}>
            {CHECKLIST_ITEMS.map((item, idx) => {
              const isChecked = checkedIndices.includes(idx);
              return (
                <Pressable
                  key={idx}
                  style={[
                    styles.checkRow,
                    isChecked && styles.checkRowActive,
                  ]}
                  onPress={() => toggleCheck(idx)}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      isChecked && styles.checkboxBoxChecked,
                    ]}
                  >
                    {isChecked && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.checkItemText}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Legal & Personal Responsibility Box */}
        <View style={styles.legalBox}>
          <Text style={styles.legalNotice}>
            Every operative is legally and personally responsible for their own physical safety and territorial compliance.
          </Text>
        </View>

        {error && <Text style={styles.errorBanner}>{error}</Text>}

        {/* Primary Action Button */}
        <View style={styles.bottomDock}>
          <Button
            label="CREATE GAME (HOST LOBBY)"
            variant={allChecked ? 'primary' : 'secondary'}
            disabled={!allChecked}
            loading={isLoading}
            onPress={handleCreateGame}
            style={allChecked ? {} : { opacity: 0.5 }}
          />
          <View style={styles.pinHintRow}>
            <Text style={styles.pinHintIcon}>🔒</Text>
            <Text style={styles.pinHintText}>Generates secure 6-character uplink pin</Text>
          </View>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  headerNavRow: {
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitleCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
    fontSize: 16,
  },
  stepProgressText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
    letterSpacing: 1,
  },
  placeholder: {
    width: 40,
  },
  progressBarTrack: {
    width: '100%',
    height: 3,
    backgroundColor: colors.surfaceElevated,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  phaseText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    letterSpacing: 1,
  },
  readyText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  bannerBox: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIcon: {
    fontSize: 20,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
    fontSize: 15,
  },
  bannerDesc: {
    color: colors.textSecondary,
    ...typography.bodySm,
    lineHeight: 18,
    marginTop: 2,
  },
  hazardBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  hazardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hazardIcon: {
    fontSize: 16,
  },
  hazardContent: {
    flex: 1,
  },
  hazardTitle: {
    color: colors.signalWarning,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  hazardDesc: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontSize: 11,
    marginTop: 2,
  },
  checklistSection: {
    marginBottom: spacing.md,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  checklistTitle: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  counterBadge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  counterBadgeActive: {
    backgroundColor: 'rgba(198, 255, 0, 0.15)',
    borderColor: colors.accentPrimary,
    borderWidth: 1,
  },
  counterText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  counterTextActive: {
    color: colors.accentPrimary,
    fontWeight: '700',
  },
  checklistStack: {
    gap: spacing.xs,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  checkRowActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.surfaceElevated,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  checkMark: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '900',
  },
  checkItemText: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.bodyMd,
    fontSize: 13,
    lineHeight: 18,
  },
  legalBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  legalNotice: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  errorBanner: {
    color: colors.signalDanger,
    ...typography.bodySm,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  bottomDock: {
    gap: spacing.xs,
  },
  pinHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  pinHintIcon: {
    fontSize: 12,
  },
  pinHintText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
});
