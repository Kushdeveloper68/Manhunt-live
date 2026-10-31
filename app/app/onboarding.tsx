import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../src/theme/theme';
import { Button } from '../src/components/Button';

interface Slide {
  nodeId: string;
  title: string;
  description: string;
  tags: string[];
  gapMetric: string;
}

const SLIDES: Slide[] = [
  {
    nodeId: 'NODE // ONB-01',
    title: 'RUN OR HUNT',
    description: 'Real players. Real sprint speeds. The whole city is your arena.',
    tags: ['GPS SURVIVAL', 'LIVE MATCHES'],
    gapMetric: '24M GAP',
  },
  {
    nodeId: 'NODE // ONB-02',
    title: 'PERIODIC PINGS',
    description: 'Chasers only receive runner snapshots at reveal ticks. Stealth is survival.',
    tags: ['RADAR TICKS', 'TACTICAL STEALTH'],
    gapMetric: '1:42 PING',
  },
  {
    nodeId: 'NODE // ONB-03',
    title: 'SURVIVE THE ZONE',
    description: 'Boundary shrinks continuously. Step outside and face immediate penalty.',
    tags: ['ZONE COLLAPSE', 'ELIMINATION'],
    gapMetric: '500M PERIMETER',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slide = SLIDES[currentSlide];

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      router.replace('/auth/login');
    }
  };

  const handleSkip = () => {
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Navigation & Skip Action */}
        <View style={styles.topNav}>
          <View style={styles.nodeTag}>
            <View style={styles.limeDot} />
            <Text style={styles.nodeText}>{slide.nodeId}</Text>
          </View>
          <Pressable onPress={handleSkip}>
            <Text style={styles.skipButton}>SKIP</Text>
          </Pressable>
        </View>

        {/* Central Tactical Visual Card */}
        <View style={styles.tacticalCard}>
          {/* Telemetry Corner Overlays */}
          <View style={styles.telemetryOverlayTop}>
            <Text style={styles.telemetryCornerText}>LOC: AUTO_SYS</Text>
            <Text style={styles.telemetryCornerText}>LAT: 40.7128</Text>
          </View>

          {/* Center Graphic */}
          <View style={styles.graphicBox}>
            <View style={styles.gapTag}>
              <Text style={styles.gapTagText}>{slide.gapMetric}</Text>
            </View>

            <View style={styles.vectorTracks}>
              <View style={styles.trackLine} />
              <View style={styles.runnerLeadBlip} />
              <View style={styles.runnerTrailBlip} />
            </View>
          </View>

          {/* Copy */}
          <View style={styles.copyBlock}>
            <Text style={styles.headline}>{slide.title}</Text>
            <Text style={styles.body}>{slide.description}</Text>
          </View>

          {/* Mode Badges */}
          <View style={styles.tagsRow}>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>{slide.tags[0]}</Text>
            </View>
            <View style={styles.neutralTag}>
              <Text style={styles.neutralTagText}>{slide.tags[1]}</Text>
            </View>
          </View>

          <View style={styles.telemetryOverlayBottom}>
            <Text style={styles.telemetryCornerText}>SENSORS: ACTIVE</Text>
            <Text style={styles.telemetryCornerText}>RADAR: 360°</Text>
          </View>
        </View>

        {/* Bottom Thumb-Zone Controls */}
        <View style={styles.bottomControls}>
          {/* Step Indicators */}
          <View style={styles.indicatorsRow}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.indicatorDot,
                  i === currentSlide && styles.indicatorActive,
                ]}
              />
            ))}
          </View>

          <Button
            label={currentSlide === SLIDES.length - 1 ? 'ENTER ARENA' : 'NEXT'}
            variant="primary"
            onPress={handleNext}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
  },
  nodeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  limeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  nodeText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 1.5,
  },
  skipButton: {
    color: colors.textSecondary,
    ...typography.bodyMd,
    fontWeight: '600',
    letterSpacing: 1,
  },
  tacticalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 420,
    position: 'relative',
  },
  telemetryOverlayTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryOverlayBottom: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryCornerText: {
    color: 'rgba(160, 160, 160, 0.4)',
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  graphicBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
    width: '100%',
  },
  gapTag: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  gapTagText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontWeight: '700',
  },
  vectorTracks: {
    width: '80%',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  trackLine: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    width: '100%',
  },
  runnerLeadBlip: {
    position: 'absolute',
    right: 30,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.roleRunner,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  runnerTrailBlip: {
    position: 'absolute',
    left: 40,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.roleChaser,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  copyBlock: {
    alignItems: 'center',
    textAlign: 'center',
  },
  headline: {
    color: colors.textPrimary,
    ...typography.headlineLg,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    color: colors.textSecondary,
    ...typography.bodyMd,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  activeTag: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeTagText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
  },
  neutralTag: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  neutralTagText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
  },
  bottomControls: {
    width: '100%',
    marginTop: spacing.lg,
  },
  indicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  indicatorActive: {
    width: 32,
    backgroundColor: colors.accentPrimary,
  },
});
