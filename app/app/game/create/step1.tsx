import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../../src/theme/theme';
import { Button } from '../../../src/components/Button';
import { useGameStore } from '../../../src/stores/gameStore';

export default function CreateStep1Basics() {
  const router = useRouter();
  const { draft, setDraftBasics } = useGameStore();

  const [matchName, setMatchName] = useState(draft.name || 'CENTRAL PARK PURSUIT');
  const [selectedMode, setSelectedMode] = useState<'Classic Manhunt' | 'Last Runner Standing'>(
    draft.mode || 'Classic Manhunt'
  );
  const [operatives, setOperatives] = useState(draft.maxPlayers || 16);

  const chasers = Math.max(1, Math.round(operatives * 0.25));
  const runners = operatives - chasers;

  const handleNext = () => {
    setDraftBasics(matchName.trim() || 'UNTITLED OPERATION', selectedMode, operatives);
    router.push('/game/create/step2');
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
            <Text style={styles.headerTitle}>STEP 1 BASIC INTEL</Text>
            <Text style={styles.stepProgressText}>STEP 1 OF 4</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '25%' }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Title Section */}
        <View style={styles.headingSection}>
          <View style={styles.protocolRow}>
            <Text style={styles.protocolText}>CONFIG PROTOCOL</Text>
            <Text style={styles.phaseText}>01 // 04</Text>
          </View>
          <Text style={styles.mainTitle}>GAME INTEL</Text>
          <Text style={styles.subTitle}>
            Set match identifier, operational mode, and squad capacity limit.
          </Text>
        </View>

        {/* Match Callsign Input */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>MATCH CALLSIGN</Text>
            <Text style={styles.inputSubLabel}>[MAX 28 CHARS]</Text>
          </View>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={matchName}
              onChangeText={(text) => setMatchName(text.toUpperCase().slice(0, 28))}
              placeholder="ENTER GAME TITLE..."
              placeholderTextColor={colors.textSecondary}
              maxLength={28}
            />
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        </View>

        {/* Rules of Engagement Mode Selection */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>RULES OF ENGAGEMENT</Text>
            <Text style={styles.inputSubLabel}>2 MODES READY</Text>
          </View>

          {/* Mode 1: Classic Manhunt */}
          <Pressable
            style={[
              styles.modeCard,
              selectedMode === 'Classic Manhunt' && styles.modeCardActive,
            ]}
            onPress={() => setSelectedMode('Classic Manhunt')}
          >
            <View style={styles.modeCardHeader}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.modeIcon}>📡</Text>
                <Text style={styles.modeTitle}>CLASSIC MANHUNT</Text>
              </View>
              {selectedMode === 'Classic Manhunt' && (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.modeDesc}>
              Chasers track runners via tactical pulsed GPS pings. Neutralize all rogue operatives to secure perimeter.
            </Text>
          </Pressable>

          {/* Mode 2: Last Runner Standing */}
          <Pressable
            style={[
              styles.modeCard,
              selectedMode === 'Last Runner Standing' && styles.modeCardActive,
            ]}
            onPress={() => setSelectedMode('Last Runner Standing')}
          >
            <View style={styles.modeCardHeader}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.modeIcon}>⏱</Text>
                <Text style={styles.modeTitle}>LAST RUNNER STANDING</Text>
              </View>
              {selectedMode === 'Last Runner Standing' && (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.modeDesc}>
              Solo survival protocol. Boundaries compress continuously; proximity triggers elimination warnings.
            </Text>
          </Pressable>
        </View>

        {/* Max Operatives Stepper */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.inputLabel}>MAX OPERATIVES</Text>
            <Text style={styles.recomText}>RECOMMENDED: 8-24</Text>
          </View>

          <View style={styles.stepperCard}>
            <View style={styles.stepperControls}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => setOperatives((prev) => Math.max(4, prev - 2))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>

              <View style={styles.countCenter}>
                <Text style={styles.countNumber}>{operatives}</Text>
                <Text style={styles.countLabel}>SLOTS ALLOCATED</Text>
              </View>

              <Pressable
                style={styles.stepBtn}
                onPress={() => setOperatives((prev) => Math.min(32, prev + 2))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.ratioRow}>
              <View style={styles.ratioItem}>
                <View style={[styles.ratioDot, { backgroundColor: colors.roleChaser }]} />
                <Text style={styles.ratioText}>CHASERS: {chasers}</Text>
              </View>
              <View style={styles.ratioItem}>
                <View style={[styles.ratioDot, { backgroundColor: colors.roleRunner }]} />
                <Text style={styles.ratioText}>RUNNERS: {runners}</Text>
              </View>
              <View style={styles.ratioItem}>
                <Text style={styles.ratioTextAlt}>RATIO: 1:3</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Host Privileges Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeIcon}>ℹ</Text>
          <Text style={styles.noticeText}>
            Host privileges will remain locked to your terminal. Match zones will be configured on coordinate grid in Step 2.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.bottomActions}>
          <Button
            label="NEXT: SET ZONE"
            variant="primary"
            onPress={handleNext}
            style={styles.nextBtn}
          />
          <Pressable onPress={() => router.back()} style={styles.abortBtn}>
            <Text style={styles.abortText}>ABORT MATCH SETUP</Text>
          </Pressable>
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
  headingSection: {
    marginBottom: spacing.lg,
  },
  protocolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  protocolText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    letterSpacing: 1,
  },
  phaseText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
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
  inputGroup: {
    marginBottom: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inputLabel: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
  },
  inputSubLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  recomText: {
    color: colors.accentPrimary,
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
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.labelMonoMd,
  },
  checkIcon: {
    color: colors.accentPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  modeCardActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.surfaceElevated,
  },
  modeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeIcon: {
    fontSize: 16,
  },
  modeTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
    fontSize: 15,
  },
  activePill: {
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activePillText: {
    color: colors.textInverse,
    ...typography.labelMonoSm,
    fontSize: 9,
    fontWeight: '800',
  },
  modeDesc: {
    color: colors.textSecondary,
    ...typography.bodySm,
    lineHeight: 18,
  },
  stepperCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  stepperControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  countCenter: {
    alignItems: 'center',
  },
  countNumber: {
    color: colors.textPrimary,
    ...typography.headlineLg,
    fontSize: 32,
    lineHeight: 34,
  },
  countLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    marginTop: 2,
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  ratioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ratioText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  ratioTextAlt: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radii.card,
    marginBottom: spacing.lg,
  },
  noticeIcon: {
    color: colors.accentPrimary,
    fontSize: 16,
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    ...typography.bodySm,
    lineHeight: 18,
  },
  bottomActions: {
    marginTop: spacing.sm,
  },
  nextBtn: {
    marginBottom: spacing.sm,
  },
  abortBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  abortText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    letterSpacing: 1,
  },
});
