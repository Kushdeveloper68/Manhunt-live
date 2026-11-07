import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

export default function TermsAndSafetyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [reaffirmed, setReaffirmed] = useState(false);

  const policies = [
    {
      num: '01',
      title: 'Traffic & Pedestrian Safety',
      points: [
        {
          bold: 'Zero Roadway Incursion:',
          text: 'Absolute ban on entering active vehicular travel lanes, expressways, rail corridors, and active construction enclosures.',
          icon: '⛔',
        },
        {
          bold: 'Transit Signals Enforced:',
          text: 'Signalized intersections must be cleared via legal walk signals only. Running red lights constitutes instant match ejection and score forfeit.',
          icon: '🚦',
        },
      ],
    },
    {
      num: '02',
      title: 'Private Property & Trespass',
      points: [
        {
          bold: 'Sanctuary Zones:',
          text: 'Private residences, corporate buildings, secured rooftop infrastructure, schools, and private industrial land are out-of-bounds (OOB).',
          icon: '🚫',
        },
        {
          bold: 'Immediate Revocation:',
          text: 'Any verified trespass report results in immediate account termination, biometric identifier blacklisting, and cooperation with local property enforcement.',
          icon: '⚖️',
        },
      ],
    },
    {
      num: '03',
      title: 'Zero Physical Violence Policy',
      points: [
        {
          bold: 'Contactless Tag Mechanics:',
          text: 'Tags must rely on proximity beacon ping (BLE), camera optical line-of-sight code scan, or agreed two-finger light touch on the shoulder.',
          icon: '📲',
        },
        {
          bold: 'Battery & Assault Bar:',
          text: 'Grabbing clothes, pushing, tripping, or physical restraint constitutes felonious conduct under law and triggers automated emergency telemetry dispatch.',
          icon: '✋',
        },
      ],
    },
    {
      num: '04',
      title: 'Night Play & Luminescence Standards',
      points: [
        {
          bold: 'Post-Sunset Protocols:',
          text: 'Matches initiated or active after local nautical dusk require runners and chasers to wear certified 360° retro-reflective wrist bands or active LED markers.',
          icon: '💡',
        },
        {
          bold: 'Stealth Restrictions:',
          text: 'Total light-suppression gear in public rights-of-way is barred due to municipal motor-vehicle hazard codes.',
          icon: '👁️',
        },
      ],
    },
    {
      num: '05',
      title: 'Data Privacy & GPS Telemetry',
      points: [
        {
          bold: 'Ephemerality:',
          text: 'High-accuracy GPS polling streams only while an active lobby state is live. Coordinates are purged from dynamic memory 12 hours post-match.',
          icon: '📍',
        },
        {
          bold: 'Zero Commercial Brokering:',
          text: 'Geospatial breadcrumbs are never sold to ad aggregators, insurance carriers, or data clearinghouses.',
          icon: '🛡️',
        },
      ],
    },
  ];

  function toggleAccordion(index: number) {
    setExpandedIndex(expandedIndex === index ? null : index);
  }

  function handleReaffirm() {
    setReaffirmed(true);
    Alert.alert('PROTOCOLS RE-AFFIRMED', 'Compliance certificate logged to active profile.');
  }

  function handleDownload() {
    Alert.alert('PDF GENERATOR', 'Safety protocol document dispatched to local storage.');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ——— Header ——— */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={{ fontSize: 20, color: colors.textPrimary }}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal, Terms & Safety Policy</Text>
        <View style={styles.creditBadge}>
          <Text style={[styles.labelMonoSm, { color: colors.accentPrimary, fontWeight: 'bold' }]}>
            4,850 CR
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ——— Status Chip Row ——— */}
        <View style={styles.row}>
          <View style={styles.complianceChip}>
            <View style={styles.miniDotRed} />
            <Text style={[styles.labelMonoSm, { color: '#FFDAD6', fontWeight: 'bold' }]}>
              MANDATORY COMPLIANCE // V4.2
            </Text>
          </View>
          <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>REV. 2024.09</Text>
        </View>

        {/* ——— Operational Directive Warning Banner ——— */}
        <View style={styles.directiveBanner}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={styles.directiveIconBox}>
              <Text style={{ fontSize: 22 }}>⚠️</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.headlineSm, { color: '#FFB4AB' }]}>
                Real-World Field Operating Directive
              </Text>
              <Text style={[styles.bodySm, { color: '#FFDAD6', lineHeight: 18 }]}>
                <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>MANHUNT LIVE</Text> is an outdoor evasion sport conducted within civic infrastructure. Operators remain subject to state penal codes, municipal speed-of-transit laws, and civil pedestrian regulations. Zero corporate indemnity for reckless conduct.
              </Text>
            </View>
          </View>
        </View>

        {/* ——— Policy Articles Stack ——— */}
        <View style={styles.policyStack}>
          {policies.map((item, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <View
                key={item.num}
                style={[
                  styles.policyCard,
                  isExpanded && { backgroundColor: colors.surfaceElevated },
                ]}
              >
                <TouchableOpacity
                  style={styles.policyHeader}
                  onPress={() => toggleAccordion(index)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.policyNumBadge}>
                      <Text style={[styles.labelMonoSm, { color: colors.accentPrimary, fontWeight: 'bold' }]}>
                        {item.num}
                      </Text>
                    </View>
                    <Text style={styles.policyTitle}>{item.title}</Text>
                  </View>
                  <Text style={[styles.labelMonoMd, { color: colors.textSecondary }]}>
                    {isExpanded ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.policyBody}>
                    {item.points.map((pt, pIdx) => (
                      <View key={pIdx} style={styles.pointRow}>
                        <Text style={{ fontSize: 16 }}>{pt.icon}</Text>
                        <Text style={[styles.bodySm, { color: colors.textPrimary, flex: 1, lineHeight: 18 }]}>
                          <Text style={{ fontWeight: 'bold', color: colors.accentPrimary }}>
                            {pt.bold}{' '}
                          </Text>
                          {pt.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ——— Civic Grid Operations Context Card ——— */}
        <View style={styles.civicCard}>
          <View style={styles.row}>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
              SANCTIONED SECTOR BASELINE
            </Text>
            <Text style={[styles.labelMonoSm, { color: colors.accentPrimary }]}>
              GPS JURISDICTION 09
            </Text>
          </View>
          <View style={styles.civicHero}>
            <Text style={styles.headlineSm}>Civic Grid Operations</Text>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
              Stay alert. Respect your playground. Protect fellow operators.
            </Text>
          </View>
        </View>

        {/* ——— Signed Compliance Box ——— */}
        <View style={styles.signedBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.verifiedShield}>
              <Text style={{ color: '#0A0A0A', fontSize: 16, fontWeight: 'bold' }}>✓</Text>
            </View>
            <View>
              <Text style={[styles.labelMonoSm, { color: colors.accentPrimary, fontWeight: 'bold' }]}>
                LEGAL BINDING ACTIVE
              </Text>
              <Text style={[styles.labelMonoSm, { color: colors.textPrimary }]}>
                STATUS: VERIFIED & SIGNED
              </Text>
            </View>
          </View>
          <View style={styles.signatureRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>🔒</Text>
              <Text style={[styles.labelMonoSm, { color: colors.textPrimary, fontWeight: 'bold' }]}>
                @{user?.username?.toUpperCase() || 'SHADOW_RUNNER'}
              </Text>
            </View>
            <Text style={[styles.labelMonoSm, { color: colors.textSecondary }]}>
              2024-09-12 14:02:18 UTC
            </Text>
          </View>
        </View>

        {/* ——— Action CTA Buttons ——— */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.reaffirmButton, reaffirmed && { backgroundColor: colors.surfaceElevated }]}
            onPress={handleReaffirm}
            activeOpacity={0.88}
          >
            <Text style={{ fontSize: 18 }}>👍</Text>
            <Text style={[styles.bodyMd, { color: reaffirmed ? colors.accentPrimary : colors.textInverse, fontWeight: 'bold' }]}>
              {reaffirmed ? 'PROTOCOLS RE-AFFIRMED' : 'RE-AFFIRM SAFETY PROTOCOL'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownload}
            activeOpacity={0.88}
          >
            <Text style={{ fontSize: 18 }}>📥</Text>
            <Text style={[styles.bodyMd, { color: colors.textPrimary, fontWeight: '600' }]}>
              DOWNLOAD PDF COPY OF SAFETY PROTOCOL
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.headlineSm,
    fontSize: 16,
    color: colors.textPrimary,
  },
  creditBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  complianceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C7003A',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  miniDotRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFDAD6',
  },
  directiveBanner: {
    backgroundColor: '#93000A',
    borderRadius: radii.card,
    padding: spacing.md,
  },
  directiveIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyStack: {
    gap: spacing.sm,
  },
  policyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  policyNumBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  policyTitle: {
    ...typography.headlineSm,
    fontSize: 16,
    color: colors.textPrimary,
  },
  policyBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  civicCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  civicHero: {
    height: 80,
    backgroundColor: '#1E1E1E',
    borderRadius: radii.md,
    padding: spacing.md,
    justifyContent: 'center',
  },
  signedBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  verifiedShield: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  actionSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reaffirmButton: {
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.accentPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  downloadButton: {
    height: 52,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headlineSm: {
    ...typography.headlineSm,
  },
  labelMonoSm: {
    ...typography.labelMonoSm,
  },
  labelMonoMd: {
    ...typography.labelMonoMd,
  },
  bodySm: {
    ...typography.bodySm,
  },
  bodyMd: {
    ...typography.bodyMd,
  },
});
