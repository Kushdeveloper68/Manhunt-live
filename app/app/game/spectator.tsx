import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, typography, spacing, radii } from '../../src/theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SpectatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const {
    startedAt,
    players,
    teammateLocations,
    eliminatedData,
    resetGame,
  } = useLiveGameStore();

  const [isBannerCollapsed, setIsBannerCollapsed] = useState(false);
  const [selectedOperativeIndex, setSelectedOperativeIndex] = useState(0);
  const [matchElapsedSec, setMatchElapsedSec] = useState(3138); // Default 52:18 mock
  const [cameraMode, setCameraMode] = useState<'lock' | 'free'>('lock');

  // Compute live match elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (startedAt) {
        setMatchElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
      } else {
        setMatchElapsedSec((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const activeRunners = useMemo(
    () => players.filter((p) => p.role === 'RUNNER' && p.status === 'ACTIVE'),
    [players]
  );
  const totalRunners = useMemo(
    () => players.filter((p) => p.role === 'RUNNER'),
    [players]
  );
  const activeChasers = useMemo(
    () => players.filter((p) => p.role === 'CHASER' && p.status === 'ACTIVE'),
    [players]
  );

  // List of active operatives to cycle through
  const operativeList = useMemo(() => {
    if (players.length > 0) {
      return players
        .filter((p) => p.status === 'ACTIVE')
        .map((p, idx) => ({
          name: `@${p.username.toUpperCase()}`,
          role: p.role,
          sub:
            p.role === 'RUNNER'
              ? `RUNNER • ${120 + idx * 85}M ${['WEST', 'SOUTH-EAST', 'NORTH'][idx % 3]}`
              : `CHASER • PURSUING`,
        }));
    }
    // Fallback default operatives matching Stitch mockup
    return [
      { name: '@NEON_HARE', role: 'RUNNER', sub: 'NEAREST RUNNER • 142M WEST' },
      { name: '@CIPHER_88', role: 'RUNNER', sub: 'RUNNER • 380M SOUTH-EAST' },
      { name: '@ECHO_TRACE', role: 'RUNNER', sub: 'RUNNER • 490M EAST (PINNED)' },
      { name: '@KRONOS_9', role: 'CHASER', sub: 'LEAD CHASER • PURSUING CIPHER' },
    ];
  }, [players]);

  const currentOperative = operativeList[selectedOperativeIndex % operativeList.length] || {
    name: '@NEON_HARE',
    role: 'RUNNER',
    sub: 'NEAREST RUNNER • 142M WEST',
  };

  function handlePrevOperative() {
    setSelectedOperativeIndex((prev) =>
      prev === 0 ? operativeList.length - 1 : prev - 1
    );
  }

  function handleNextOperative() {
    setSelectedOperativeIndex((prev) => (prev + 1) % operativeList.length);
  }

  function handleExitSession() {
    Alert.alert(
      'LEAVE SPECTATOR MODE',
      'Disconnect satellite stream and exit to lobby? Match telemetry will sync automatically.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DISCONNECT',
          style: 'destructive',
          onPress: () => {
            resetGame();
            router.replace('/home');
          },
        },
      ]
    );
  }

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const taggedByName = eliminatedData?.taggedBy || 'KRONOS_9';
  const taggedAtTime = eliminatedData?.taggedAt
    ? new Date(eliminatedData.taggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '14:22';

  return (
    <View style={styles.container}>
      {/* Top Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.spectatorBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.spectatorBadgeText}>SPECTATOR MODE</Text>
        </View>

        <TouchableOpacity
          style={styles.exitIconBtn}
          onPress={handleExitSession}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20, color: colors.textSecondary }}>🚪</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* "YOU'RE OUT" Collapsible Banner */}
        <View style={styles.eliminatedBanner}>
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerLeft}>
              <View style={styles.skullBox}>
                <Text style={{ fontSize: 22 }}>✕</Text>
              </View>
              <View>
                <Text style={styles.bannerHeadline}>YOU'RE OUT</Text>
                <Text style={styles.bannerSub}>
                  TAGGED AT {taggedAtTime} BY @{taggedByName.toUpperCase()}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.collapseBtn}
              onPress={() => setIsBannerCollapsed(!isBannerCollapsed)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18, color: '#FFD7D7' }}>
                {isBannerCollapsed ? '▼' : '▲'}
              </Text>
            </TouchableOpacity>
          </View>

          {!isBannerCollapsed && (
            <View style={styles.bannerDetailsRow}>
              <View style={styles.satFeedRow}>
                <View style={styles.greenPingDot} />
                <Text style={styles.satFeedText}>NOW IN SPECTATOR FEED</Text>
              </View>
              <Text style={styles.godViewText}>GLOBAL GOD-VIEW GRANTED</Text>
            </View>
          )}
        </View>

        {/* Real-time Match Telemetry Bar */}
        <View style={styles.telemetryCard}>
          <View style={styles.telemetryTopRow}>
            <View style={styles.timerBlock}>
              <Text style={{ fontSize: 16 }}>⏱</Text>
              <Text style={styles.timerText}>{formatTimer(matchElapsedSec)}</Text>
            </View>

            <View style={styles.aliveCounters}>
              <View style={styles.counterItem}>
                <View style={[styles.statusDot, { backgroundColor: colors.roleRunner }]} />
                <Text style={styles.counterText}>
                  {activeRunners.length || 3} / {totalRunners.length || 12} ALIVE
                </Text>
              </View>

              <View style={styles.counterItem}>
                <View style={[styles.statusDot, { backgroundColor: '#C7003A' }]} />
                <Text style={styles.counterText}>
                  {activeChasers.length || 4} HUNTING
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.satLinkBanner}>
            <Text style={styles.satLinkTitle}>ALL OPERATIVE GPS FEEDS UNLOCKED</Text>
            <Text style={styles.satLinkStatus}>SAT-LINK ONLINE</Text>
          </View>
        </View>

        {/* Global God-View Tactical Map Viewport */}
        <View style={styles.mapViewport}>
          {/* Grid lines background */}
          <View style={styles.gridOverlay}>
            <View style={[styles.gridLineH, { top: '25%' }]} />
            <View style={[styles.gridLineH, { top: '50%' }]} />
            <View style={[styles.gridLineH, { top: '75%' }]} />
            <View style={[styles.gridLineV, { left: '33%' }]} />
            <View style={[styles.gridLineV, { left: '66%' }]} />
          </View>

          {/* Safe Zone Boundary Circle */}
          <View style={styles.safeZoneCircle}>
            <View style={styles.safeZoneDashed}>
              <View style={styles.safeZonePill}>
                <Text style={styles.safeZoneText}>SAFE ZONE BOUNDARY</Text>
              </View>
            </View>
          </View>

          {/* Restricted Sector Warning Chip */}
          <View style={styles.restrictedSectorChip}>
            <Text style={{ fontSize: 11 }}>⚠️</Text>
            <Text style={styles.restrictedSectorText}>RESTRICTED SECTOR NORTH</Text>
          </View>

          {/* "YOU FELL HERE" marker */}
          <View style={styles.fellHereMarker}>
            <View style={styles.fellHereIconCircle}>
              <Text style={{ fontSize: 16 }}>💀</Text>
            </View>
            <View style={styles.fellHerePill}>
              <Text style={styles.fellHereText}>YOU FELL HERE</Text>
            </View>
          </View>

          {/* Runner operative markers (Cyan) */}
          <View style={[styles.operativeMarker, { top: '26%', left: '22%' }]}>
            <View style={styles.runnerPingHalo} />
            <View style={styles.runnerDot} />
            <Text style={styles.runnerTag}>@NEON_HARE</Text>
          </View>

          <View style={[styles.operativeMarker, { top: '62%', left: '70%' }]}>
            <View style={styles.runnerDot} />
            <Text style={styles.runnerTag}>@CIPHER_88</Text>
          </View>

          <View style={[styles.operativeMarker, { top: '34%', left: '76%' }]}>
            <View style={styles.runnerDot} />
            <Text style={styles.runnerTag}>@ECHO_TRACE</Text>
          </View>

          {/* Chaser operative markers (Crimson chevrons) */}
          <View style={[styles.operativeMarker, { top: '20%', left: '42%' }]}>
            <View style={styles.chaserChevron} />
            <Text style={styles.chaserTag}>@KRONOS_9</Text>
          </View>

          <View style={[styles.operativeMarker, { top: '50%', left: '32%' }]}>
            <View style={styles.chaserChevron} />
            <Text style={styles.chaserTag}>@APEX</Text>
          </View>

          <View style={[styles.operativeMarker, { top: '74%', left: '52%' }]}>
            <View style={styles.chaserChevron} />
            <Text style={styles.chaserTag}>@VIPER</Text>
          </View>

          {/* Live Radar Watermark */}
          <View style={styles.radarWatermark}>
            <View style={styles.radarDot} />
            <Text style={styles.radarText}>RADAR: 30FPS REALTIME</Text>
          </View>
        </View>

        {/* Tactical Camera Lock Switcher */}
        <View style={styles.cameraLockCard}>
          <TouchableOpacity
            style={styles.navChevronBtn}
            onPress={handlePrevOperative}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>‹</Text>
          </TouchableOpacity>

          <View style={styles.cameraLockInfo}>
            <Text style={styles.lockHeaderLabel}>TACTICAL CAMERA LOCK</Text>
            <Text
              style={[
                styles.lockOperativeName,
                currentOperative.role === 'CHASER'
                  ? { color: '#FF3B5C' }
                  : { color: colors.roleRunner },
              ]}
            >
              {currentOperative.name}
            </Text>
            <Text style={styles.lockOperativeSub}>{currentOperative.sub}</Text>
          </View>

          <TouchableOpacity
            style={styles.navChevronBtn}
            onPress={handleNextOperative}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20, color: colors.textPrimary }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Tactical Controls */}
        <View style={styles.subControlsRow}>
          <TouchableOpacity
            style={[
              styles.subControlBtn,
              cameraMode === 'free' && styles.subControlBtnActive,
            ]}
            onPress={() => setCameraMode(cameraMode === 'free' ? 'lock' : 'free')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>📐</Text>
            <Text style={styles.subControlText}>
              {cameraMode === 'free' ? 'LOCKED DRONE' : 'FREE DRONE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subControlBtn}
            onPress={() => Alert.alert('KILL FEED', 'All 8 past eliminations logged')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>👥</Text>
            <Text style={styles.subControlText}>KILL FEED</Text>
          </TouchableOpacity>
        </View>

        {/* Giant Leave Session CTA */}
        <TouchableOpacity
          style={styles.leaveSessionBtn}
          activeOpacity={0.88}
          onPress={handleExitSession}
        >
          <Text style={{ fontSize: 20 }}>🚪</Text>
          <Text style={styles.leaveSessionText}>LEAVE GAME SESSION</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const fontMono = typography.labelMonoSm.fontFamily;
const fontHeadline = typography.headlineMd.fontFamily;
const fontBody = typography.bodyMd.fontFamily;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: '#0E0E0ECC',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    zIndex: 10,
  },
  spectatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C7003A',
  },
  spectatorBadgeText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  exitIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  eliminatedBanner: {
    backgroundColor: '#C7003A',
    borderRadius: radii.card,
    padding: spacing.md,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  skullBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerHeadline: {
    fontFamily: fontHeadline,
    fontSize: 22,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  bannerSub: {
    fontFamily: fontMono,
    fontSize: 11,
    color: '#FFDADA',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  collapseBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  satFeedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  greenPingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  satFeedText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  godViewText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: '#FFDADA',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  telemetryCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  telemetryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerText: {
    fontFamily: fontMono,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  aliveCounters: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  counterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  counterText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  satLinkBanner: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  satLinkTitle: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  satLinkStatus: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.accentPrimary,
    fontWeight: 'bold',
  },
  mapViewport: {
    width: '100%',
    height: 380,
    backgroundColor: '#0A0A0A',
    borderRadius: radii.card,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  safeZoneCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(198, 255, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeZoneDashed: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeZonePill: {
    backgroundColor: 'rgba(14, 14, 14, 0.85)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  safeZoneText: {
    fontFamily: fontMono,
    fontSize: 9,
    color: colors.accentPrimary,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  restrictedSectorChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#93000A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restrictedSectorText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: '#FFDAD6',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  fellHereMarker: {
    position: 'absolute',
    top: '42%',
    left: '46%',
    alignItems: 'center',
  },
  fellHereIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#93000A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fellHerePill: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 3,
  },
  fellHereText: {
    fontFamily: fontMono,
    fontSize: 9,
    color: '#FF3B30',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  operativeMarker: {
    position: 'absolute',
    alignItems: 'center',
  },
  runnerPingHalo: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(47, 217, 244, 0.3)',
    top: -4,
  },
  runnerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.roleRunner,
  },
  runnerTag: {
    marginTop: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
    fontFamily: fontMono,
    fontSize: 9,
    color: colors.roleRunner,
    fontWeight: 'bold',
  },
  chaserChevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#C7003A',
  },
  chaserTag: {
    marginTop: 3,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
    fontFamily: fontMono,
    fontSize: 9,
    color: '#FF3B5C',
    fontWeight: 'bold',
  },
  radarWatermark: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(32, 31, 31, 0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  radarText: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  cameraLockCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  navChevronBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLockInfo: {
    alignItems: 'center',
    gap: 2,
  },
  lockHeaderLabel: {
    fontFamily: fontMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  lockOperativeName: {
    fontFamily: fontHeadline,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  lockOperativeSub: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
  },
  subControlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  subControlBtn: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  subControlBtnActive: {
    borderColor: colors.accentPrimary,
  },
  subControlText: {
    fontFamily: fontMono,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  leaveSessionBtn: {
    height: 52,
    backgroundColor: '#93000A',
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  leaveSessionText: {
    fontFamily: fontBody,
    fontSize: 15,
    color: '#FFDAD6',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
