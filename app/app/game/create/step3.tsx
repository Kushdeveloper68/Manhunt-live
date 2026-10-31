import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../../src/theme/theme';
import { Button } from '../../../src/components/Button';
import { useGameStore } from '../../../src/stores/gameStore';

export default function CreateStep3Rules() {
  const router = useRouter();
  const { draft, setDraftRules } = useGameStore();

  const [expandedCard, setExpandedCard] = useState<number | null>(1);
  const [durationMin, setDurationMin] = useState(draft.settings.durationMin || 60);
  const [headStartSec, setHeadStartSec] = useState((draft.settings.headStartMin || 3) * 60);
  const [revealIntervalMin, setRevealIntervalMin] = useState(draft.settings.revealIntervalMin || 2);
  const [penalty, setPenalty] = useState<'WARNING' | 'REVEAL' | 'ELIMINATE'>(
    draft.settings.outOfZonePenalty || 'WARNING'
  );

  const headStartMins = Math.floor(headStartSec / 60).toString().padStart(2, '0');
  const headStartSecs = (headStartSec % 60).toString().padStart(2, '0');

  const handleNext = () => {
    setDraftRules({
      durationMin,
      headStartMin: Math.ceil(headStartSec / 60),
      revealIntervalMin,
      outOfZonePenalty: penalty,
    });
    router.push('/game/create/step4');
  };

  const toggleAccordion = (index: number) => {
    setExpandedCard((prev) => (prev === index ? null : index));
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
            <Text style={styles.headerTitle}>STEP 3 TACTICAL RULES</Text>
            <Text style={styles.stepProgressText}>STEP 3 OF 4</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '75%' }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Title Section */}
        <View style={styles.headingSection}>
          <View style={styles.protocolRow}>
            <Text style={styles.protocolText}>CONFIG 03/04</Text>
            <Text style={styles.phaseText}>75% COMPLETE</Text>
          </View>
          <Text style={styles.mainTitle}>OPERATIONAL RULES</Text>
          <Text style={styles.subTitle}>
            Fine-tune tactical timings, reveal intervals, and zone shrinkage.
          </Text>
        </View>

        {/* Accordion 1: TIMING & HEAD-START */}
        <View style={styles.ruleCard}>
          <Pressable style={styles.cardHeader} onPress={() => toggleAccordion(1)}>
            <View style={styles.cardTitleRow}>
              <View
                style={[
                  styles.dotPip,
                  expandedCard === 1 && { backgroundColor: colors.accentPrimary },
                ]}
              />
              <Text style={styles.cardTitleText}>TIMING & HEAD-START</Text>
            </View>
            <Text style={styles.expandIcon}>{expandedCard === 1 ? '▲' : '▼'}</Text>
          </Pressable>

          {expandedCard === 1 && (
            <View style={styles.cardBody}>
              <View style={styles.settingBlock}>
                <View style={styles.settingLabelRow}>
                  <Text style={styles.settingLabel}>MATCH DURATION</Text>
                  <Text style={styles.settingValueHighlight}>STANDBY {durationMin}M</Text>
                </View>
                <View style={styles.durationGrid}>
                  {[30, 45, 60, 90].map((d) => (
                    <Pressable
                      key={d}
                      style={[
                        styles.durationBtn,
                        durationMin === d && styles.durationBtnActive,
                      ]}
                      onPress={() => setDurationMin(d)}
                    >
                      <Text
                        style={[
                          styles.durationBtnText,
                          durationMin === d && styles.durationBtnTextActive,
                        ]}
                      >
                        {d} MIN
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.settingBlock}>
                <View style={styles.settingLabelRow}>
                  <Text style={styles.settingLabel}>RUNNER HEAD-START</Text>
                  <Text style={styles.settingSubLabel}>MIN: 01:00</Text>
                </View>
                <View style={styles.headStartBox}>
                  <Pressable
                    style={styles.stepperSmallBtn}
                    onPress={() => setHeadStartSec((prev) => Math.max(60, prev - 30))}
                  >
                    <Text style={styles.stepperSmallText}>−</Text>
                  </Pressable>
                  <View style={styles.headStartCenter}>
                    <Text style={styles.headStartTimeText}>
                      {headStartMins}:{headStartSecs}
                    </Text>
                    <Text style={styles.headStartDesc}>
                      {Math.ceil(headStartSec / 60)} min buffer before chaser release
                    </Text>
                  </View>
                  <Pressable
                    style={styles.stepperSmallBtn}
                    onPress={() => setHeadStartSec((prev) => Math.min(600, prev + 30))}
                  >
                    <Text style={styles.stepperSmallText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Accordion 2: REVEAL PROTOCOL */}
        <View style={styles.ruleCard}>
          <Pressable style={styles.cardHeader} onPress={() => toggleAccordion(2)}>
            <View>
              <View style={styles.cardTitleRow}>
                <View
                  style={[
                    styles.dotPip,
                    expandedCard === 2 && { backgroundColor: colors.accentPrimary },
                  ]}
                />
                <Text style={styles.cardTitleText}>REVEAL PROTOCOL</Text>
              </View>
              <Text style={styles.cardSubSummary}>
                INTERVAL: {revealIntervalMin} MIN • MODE: ALL RUNNERS
              </Text>
            </View>
            <Text style={styles.expandIcon}>{expandedCard === 2 ? '▲' : '▼'}</Text>
          </Pressable>

          {expandedCard === 2 && (
            <View style={styles.cardBody}>
              <View style={styles.settingLabelRow}>
                <Text style={styles.settingLabel}>PING CADENCE</Text>
                <Text style={styles.settingValueHighlight}>RADAR BURST</Text>
              </View>
              <View style={styles.pingCadenceRow}>
                {[1, 2, 5].map((interval) => (
                  <Pressable
                    key={interval}
                    style={[
                      styles.cadenceBtn,
                      revealIntervalMin === interval && styles.cadenceBtnActive,
                    ]}
                    onPress={() => setRevealIntervalMin(interval)}
                  >
                    <Text
                      style={[
                        styles.cadenceBtnText,
                        revealIntervalMin === interval && styles.cadenceBtnTextActive,
                      ]}
                    >
                      {interval} MIN
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.infoRowBox}>
                <View>
                  <Text style={styles.infoRowTitle}>Precision Radius</Text>
                  <Text style={styles.infoRowSub}>Fuzzy GPS pin (+/-25m)</Text>
                </View>
                <Text style={styles.activeTagText}>ACTIVE</Text>
              </View>
            </View>
          )}
        </View>

        {/* Accordion 3: ZONE SHRINK */}
        <View style={styles.ruleCard}>
          <Pressable style={styles.cardHeader} onPress={() => toggleAccordion(3)}>
            <View>
              <View style={styles.cardTitleRow}>
                <View
                  style={[
                    styles.dotPip,
                    expandedCard === 3 && { backgroundColor: colors.accentPrimary },
                  ]}
                />
                <Text style={styles.cardTitleText}>ZONE SHRINK</Text>
              </View>
              <Text style={styles.cardSubSummary}>
                STARTS AT 30M • 25% RATE (3 STAGES)
              </Text>
            </View>
            <Text style={styles.expandIcon}>{expandedCard === 3 ? '▲' : '▼'}</Text>
          </Pressable>

          {expandedCard === 3 && (
            <View style={styles.cardBody}>
              <View style={styles.settingLabelRow}>
                <Text style={styles.settingLabel}>ZONE DECAY TIMELINE</Text>
                <Text style={styles.settingSubLabel}>3 PHASES</Text>
              </View>

              <View style={styles.shrinkTimelineBox}>
                <View style={styles.phaseItem}>
                  <Text style={styles.phaseLabel}>INIT (100%)</Text>
                  <View style={styles.phaseBarTrack}>
                    <View style={[styles.phaseBarFill, { width: '100%' }]} />
                  </View>
                  <Text style={styles.phaseTime}>00:00</Text>
                </View>

                <View style={styles.phaseItem}>
                  <Text style={styles.phaseLabel}>PHASE 1 (75%)</Text>
                  <View style={styles.phaseBarTrack}>
                    <View style={[styles.phaseBarFill, { width: '75%' }]} />
                  </View>
                  <Text style={styles.phaseTime}>30:00</Text>
                </View>

                <View style={styles.phaseItem}>
                  <Text style={styles.phaseLabel}>FINAL (50%)</Text>
                  <View style={styles.phaseBarTrack}>
                    <View
                      style={[
                        styles.phaseBarFill,
                        { width: '50%', backgroundColor: colors.roleChaser },
                      ]}
                    />
                  </View>
                  <Text style={styles.phaseTime}>45:00</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Accordion 4: TACTICAL & SAFETY */}
        <View style={styles.ruleCard}>
          <Pressable style={styles.cardHeader} onPress={() => toggleAccordion(4)}>
            <View>
              <View style={styles.cardTitleRow}>
                <View
                  style={[
                    styles.dotPip,
                    expandedCard === 4 && { backgroundColor: colors.accentPrimary },
                  ]}
                />
                <Text style={styles.cardTitleText}>TACTICAL & SAFETY</Text>
              </View>
              <Text style={styles.cardSubSummary}>
                TAG: 4-DIGIT PIN • OUT-OF-ZONE: {penalty}
              </Text>
            </View>
            <Text style={styles.expandIcon}>{expandedCard === 4 ? '▲' : '▼'}</Text>
          </Pressable>

          {expandedCard === 4 && (
            <View style={styles.cardBody}>
              <View style={styles.infoRowBox}>
                <View>
                  <Text style={styles.infoRowTitle}>Tag Validation</Text>
                  <Text style={styles.infoRowSub}>4-Digit Code + Server Proximity</Text>
                </View>
                <Text style={styles.activeTagText}>DUAL-CHECK</Text>
              </View>

              <View style={styles.penaltySelector}>
                <Text style={styles.settingLabel}>BOUNDARY ENFORCEMENT</Text>
                <View style={styles.durationGrid}>
                  {(['WARNING', 'REVEAL', 'ELIMINATE'] as const).map((p) => (
                    <Pressable
                      key={p}
                      style={[
                        styles.durationBtn,
                        penalty === p && styles.durationBtnActive,
                      ]}
                      onPress={() => setPenalty(p)}
                    >
                      <Text
                        style={[
                          styles.durationBtnText,
                          penalty === p && styles.durationBtnTextActive,
                        ]}
                      >
                        {p}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Status Badge */}
        <View style={styles.statusBadgeBox}>
          <Text style={styles.statusBadgeIcon}>⚙</Text>
          <View>
            <Text style={styles.statusBadgeTitle}>ZONE PROTOCOL STATUS</Text>
            <Text style={styles.statusBadgeDesc}>
              Standard Pursuit Ruleset applied (Competitive)
            </Text>
          </View>
        </View>

        {/* Action */}
        <View style={styles.bottomActions}>
          <Button
            label="NEXT: SAFETY CHECK"
            variant="primary"
            onPress={handleNext}
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
  ruleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dotPip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  cardTitleText: {
    color: colors.textPrimary,
    ...typography.headlineSm,
    fontSize: 15,
  },
  cardSubSummary: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    marginTop: 4,
  },
  expandIcon: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  cardBody: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
  },
  settingBlock: {
    marginBottom: spacing.md,
  },
  settingLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  settingLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  settingSubLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  settingValueHighlight: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  durationGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  durationBtn: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnActive: {
    backgroundColor: colors.accentPrimary,
  },
  durationBtnText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '600',
  },
  durationBtnTextActive: {
    color: colors.textInverse,
    fontWeight: '800',
  },
  headStartBox: {
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperSmallBtn: {
    width: 36,
    height: 36,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSmallText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headStartCenter: {
    alignItems: 'center',
  },
  headStartTimeText: {
    color: colors.accentPrimary,
    ...typography.labelMonoLg,
    fontSize: 20,
  },
  headStartDesc: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontSize: 10,
    marginTop: 2,
  },
  pingCadenceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cadenceBtn: {
    flex: 1,
    height: 40,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadenceBtnActive: {
    backgroundColor: colors.accentPrimary,
  },
  cadenceBtnText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 11,
  },
  cadenceBtnTextActive: {
    color: colors.textInverse,
    fontWeight: '800',
  },
  infoRowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  infoRowTitle: {
    color: colors.textPrimary,
    ...typography.bodyMd,
    fontSize: 13,
  },
  infoRowSub: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontSize: 11,
  },
  activeTagText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  shrinkTimelineBox: {
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  phaseItem: {
    flex: 1,
    alignItems: 'center',
  },
  phaseLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 8,
  },
  phaseBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  phaseBarFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
  },
  phaseTime: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  penaltySelector: {
    marginTop: spacing.sm,
  },
  statusBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radii.card,
    marginVertical: spacing.md,
  },
  statusBadgeIcon: {
    fontSize: 20,
    color: colors.accentPrimary,
  },
  statusBadgeTitle: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  statusBadgeDesc: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontSize: 12,
  },
  bottomActions: {
    marginTop: spacing.xs,
  },
});
