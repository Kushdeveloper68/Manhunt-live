import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../../src/theme/theme';
import { Button } from '../../../src/components/Button';
import { useGameStore } from '../../../src/stores/gameStore';

export default function CreateStep2Zone() {
  const router = useRouter();
  const { draft, setDraftZone, removeNoGoZone } = useGameStore();

  const [radiusMeters, setRadiusMeters] = useState(draft.settings.zone.radius || 1500);
  const [centerCoord, setCenterCoord] = useState(
    draft.settings.zone.center || { latitude: 40.78509, longitude: -73.96828 }
  );
  const [noGoZones, setNoGoZones] = useState(draft.settings.noGoZones || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [locating, setLocating] = useState(false);

  // Centre the zone on where the host really is (the old default was New York)
  const centerOnMe = useCallback(async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Location needed', 'Allow location so the zone can be centred on you.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCenterCoord({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      Alert.alert('No GPS fix', 'Could not read your location. Turn on GPS and tap RE-CENTER.');
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    void centerOnMe();
  }, [centerOnMe]);

  const radiusKm = (radiusMeters / 1000).toFixed(1);
  const estLapMin = Math.round((radiusMeters / 1000) * 9.3);

  const handleRemoveNoGo = (id: string) => {
    removeNoGoZone(id);
    setNoGoZones((prev) => prev.filter((z) => z.id !== id));
  };

  const handleAddNoGo = () => {
    const newId = `nogo_${Date.now()}`;
    const newZone = {
      id: newId,
      name: 'HIGHWAY CORRIDOR',
      polygon: [
        { latitude: centerCoord.latitude + 0.005, longitude: centerCoord.longitude - 0.005 },
        { latitude: centerCoord.latitude + 0.008, longitude: centerCoord.longitude },
        { latitude: centerCoord.latitude + 0.005, longitude: centerCoord.longitude + 0.005 },
      ],
    };
    setNoGoZones((prev) => [...prev, newZone]);
  };

  const goNext = () => {
    setDraftZone(centerCoord, radiusMeters);
    router.push('/game/create/step3');
  };

  const handleNext = () => {
    const stillDefault =
      Math.abs(centerCoord.latitude - 40.78509) < 0.001 && Math.abs(centerCoord.longitude + 73.96828) < 0.001;
    if (stillDefault) {
      Alert.alert(
        'Zone is in New York',
        'The zone is not centred on you. Players outside the zone are penalised. Continue anyway?',
        [
          { text: 'Re-centre on me', onPress: () => void centerOnMe() },
          { text: 'Continue', style: 'destructive', onPress: goNext },
        ]
      );
      return;
    }
    goNext();
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
            <Text style={styles.headerTitle}>STEP 2 ZONE PARAMETERS</Text>
            <Text style={styles.stepProgressText}>STEP 2 OF 4</Text>
          </View>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '50%' }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Tactical Map Canvas */}
        <View style={styles.mapCanvas}>
          {/* Top telemetry floating bar */}
          <View style={styles.mapTopBar}>
            <View style={styles.coordPill}>
              <View style={styles.pulseDot} />
              <Text style={styles.coordText}>
                {locating ? 'LOCATING…' : `GRID: ${centerCoord.latitude.toFixed(4)}, ${centerCoord.longitude.toFixed(4)}`}
              </Text>
            </View>
            <Pressable
              style={styles.recenterBtn}
              onPress={() => void centerOnMe()}
            >
              <Text style={styles.recenterIcon}>🎯</Text>
              <Text style={styles.recenterText}>RE-CENTER</Text>
            </Pressable>
          </View>

          {/* No-Go Zone Restricted Overlay */}
          {noGoZones.length > 0 && (
            <View style={styles.noGoOverlayBox}>
              <View style={styles.noGoTag}>
                <Text style={styles.noGoTagText}>⚠ RESTRICTED</Text>
              </View>
              <Text style={styles.noGoTitle}>{noGoZones[0].name}</Text>
            </View>
          )}

          {/* Dynamic Zone Perimeter Circle */}
          <View
            style={[
              styles.zoneHalo,
              {
                width: Math.min(260, Math.max(140, 140 + ((radiusMeters - 500) / 9500) * 120)),
                height: Math.min(260, Math.max(140, 140 + ((radiusMeters - 500) / 9500) * 120)),
              },
            ]}
          >
            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />
            <View style={styles.zoneOriginPin}>
              <View style={styles.originDot} />
            </View>
            <View style={styles.originLabel}>
              <Text style={styles.originLabelText}>ZONE ORIGIN</Text>
            </View>
          </View>

          {/* Compass bearing */}
          <View style={styles.compassBox}>
            <Text style={styles.compassText}>🧭 042° NE</Text>
          </View>
        </View>

        {/* Operational Configuration Card */}
        <View style={styles.configCard}>
          <View style={styles.radiusHeader}>
            <View>
              <Text style={styles.configLabel}>ZONE RADIUS</Text>
              <View style={styles.radiusMetricRow}>
                <Text style={styles.radiusNumber}>{radiusKm}</Text>
                <Text style={styles.radiusUnit}>KM</Text>
                <Text style={styles.radiusMetersAlt}>({radiusMeters.toLocaleString()} M)</Text>
              </View>
            </View>
            <View style={styles.estLapBox}>
              <Text style={styles.configLabel}>EST. RUN TIME</Text>
              <Text style={styles.estLapText}>~{estLapMin} MIN LAP</Text>
            </View>
          </View>

          {/* Slider Stepper Buttons */}
          <View style={styles.sliderControlRow}>
            <Pressable
              style={styles.radiusAdjustBtn}
              onPress={() => setRadiusMeters((prev) => Math.max(500, prev - 250))}
            >
              <Text style={styles.adjustBtnText}>− 250M</Text>
            </Pressable>
            <View style={styles.radiusBarVisual}>
              <View
                style={[
                  styles.radiusBarFill,
                  { width: `${((radiusMeters - 500) / 9500) * 100}%` },
                ]}
              />
            </View>
            <Pressable
              style={styles.radiusAdjustBtn}
              onPress={() => setRadiusMeters((prev) => Math.min(10000, prev + 250))}
            >
              <Text style={styles.adjustBtnText}>+ 250M</Text>
            </Pressable>
          </View>

          <View style={styles.radiusRangeMarkers}>
            <Text style={styles.markerText}>0.5 KM (SPRINT)</Text>
            <Text style={styles.markerText}>5.0 KM</Text>
            <Text style={styles.markerText}>10.0 KM (CITY-WIDE)</Text>
          </View>

          {/* Active Boundaries Chips */}
          <View style={styles.boundariesBlock}>
            <Text style={styles.configLabel}>ACTIVE BOUNDARIES</Text>
            <View style={styles.chipsRow}>
              <View style={styles.activeCircleChip}>
                <View style={styles.limeChipDot} />
                <Text style={styles.activeCircleText}>{radiusKm} KM CIRCLE</Text>
              </View>

              {noGoZones.map((z) => (
                <View key={z.id} style={styles.noGoChip}>
                  <Text style={styles.noGoChipText}>⛔ {z.name}</Text>
                  <Pressable
                    onPress={() => handleRemoveNoGo(z.id)}
                    style={styles.removeNoGoBtn}
                  >
                    <Text style={styles.removeNoGoText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          {/* Add No-Go Zone Button */}
          <Pressable
            style={[
              styles.addNoGoBtn,
              isDrawing && styles.addNoGoBtnActive,
            ]}
            onPress={handleAddNoGo}
          >
            <Text style={styles.addNoGoIcon}>⌕</Text>
            <Text style={styles.addNoGoText}>
              {isDrawing ? 'TAP MAP TO DELINEATE' : 'ADD NO-GO ZONE'}
            </Text>
          </Pressable>
        </View>

        {/* Dynamic Collapse Snippet */}
        <View style={styles.guidanceBox}>
          <Text style={styles.guidanceIcon}>📍</Text>
          <View style={styles.guidanceContent}>
            <Text style={styles.guidanceTitle}>Dynamic Collapse Enabled</Text>
            <Text style={styles.guidanceDesc}>
              The circle constricts 200m every 8 minutes, forcing Chasers and Runners into closer proximity.
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.bottomActions}>
          <Button
            label="NEXT: CONFIGURE RULES"
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
  mapCanvas: {
    width: '100%',
    height: 320,
    backgroundColor: '#0c0f12',
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  mapTopBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  coordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  coordText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  recenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  recenterIcon: {
    fontSize: 12,
  },
  recenterText: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  noGoOverlayBox: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(147, 0, 10, 0.4)',
    borderColor: colors.signalDanger,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: 6,
    zIndex: 5,
  },
  noGoTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 4,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  noGoTagText: {
    color: colors.signalDanger,
    ...typography.labelMonoSm,
    fontSize: 8,
    fontWeight: '700',
  },
  noGoTitle: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 9,
    marginTop: 2,
  },
  zoneHalo: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    backgroundColor: 'rgba(198, 255, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  crosshairH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(198, 255, 0, 0.25)',
  },
  crosshairV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(198, 255, 0, 0.25)',
  },
  zoneOriginPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.canvas,
  },
  originLabel: {
    position: 'absolute',
    top: '60%',
    backgroundColor: colors.canvas,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  originLabelText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 8,
    fontWeight: '700',
  },
  compassBox: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(10, 10, 10, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  compassText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  configCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  configLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    marginBottom: 2,
  },
  radiusMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  radiusNumber: {
    color: colors.accentPrimary,
    ...typography.headlineLg,
    fontSize: 32,
    lineHeight: 34,
  },
  radiusUnit: {
    color: colors.textPrimary,
    ...typography.headlineSm,
  },
  radiusMetersAlt: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 11,
  },
  estLapBox: {
    alignItems: 'flex-end',
  },
  estLapText: {
    color: colors.textPrimary,
    ...typography.labelMonoMd,
    fontSize: 13,
    fontWeight: '700',
  },
  sliderControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  radiusAdjustBtn: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  adjustBtnText: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  radiusBarVisual: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  radiusBarFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
  },
  radiusRangeMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  markerText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  boundariesBlock: {
    marginBottom: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  activeCircleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.canvas,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  limeChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  activeCircleText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  noGoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderColor: colors.signalDanger,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noGoChipText: {
    color: colors.signalDanger,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  removeNoGoBtn: {
    marginLeft: 2,
  },
  removeNoGoText: {
    color: colors.signalDanger,
    fontSize: 11,
    fontWeight: '700',
  },
  addNoGoBtn: {
    height: 48,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addNoGoBtnActive: {
    backgroundColor: colors.accentPrimary,
  },
  addNoGoIcon: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  addNoGoText: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 11,
    fontWeight: '700',
  },
  guidanceBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  guidanceIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  guidanceContent: {
    flex: 1,
  },
  guidanceTitle: {
    color: colors.textPrimary,
    ...typography.bodyMd,
    fontWeight: '700',
  },
  guidanceDesc: {
    color: colors.textSecondary,
    ...typography.bodySm,
    lineHeight: 18,
    marginTop: 2,
  },
  bottomActions: {
    marginTop: spacing.xs,
  },
});
