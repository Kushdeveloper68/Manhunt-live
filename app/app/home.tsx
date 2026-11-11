import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../src/theme/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useGameStore } from '../src/stores/gameStore';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { loadMyGames, activeGames, recentGames } = useGameStore();

  useEffect(() => {
    loadMyGames();
  }, [loadMyGames]);

  const username = user?.username ? `@${user.username.toUpperCase()}` : '@SHADOW_RUNNER';
  const gamesCount = user?.stats?.games || 42;
  const winsCount = user?.stats?.wins || 28;
  const tagsCount = user?.stats?.tags || 64;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerPulseDot} />
          <Text style={styles.headerTitle}>HOME</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => router.push('/game/join')}
          >
            <Text style={styles.headerIconText}>📡</Text>
          </Pressable>
          <Pressable
            style={styles.profileBadge}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.profileBadgeText}>👤</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Operator Telemetry Status Bar */}
        <View style={styles.operatorBar}>
          <View style={styles.operatorLeft}>
            <View style={styles.pingTarget}>
              <View style={styles.pingPing} />
              <View style={styles.pingDot} />
            </View>
            <View style={styles.operatorInfo}>
              <Text style={styles.operatorHandle}>{username}</Text>
              <Text style={styles.operatorStatus}>GRID READY</Text>
            </View>
          </View>
          <View style={styles.operatorRight}>
            <View style={styles.levelPill}>
              <Text style={styles.levelText}>LVL 24</Text>
            </View>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarEmoji}>🐺</Text>
            </View>
          </View>
        </View>

        {/* Primary Mission Action Stack */}
        <View style={styles.actionStack}>
          {/* Create Game Button */}
          <Pressable
            style={styles.createGameBtn}
            onPress={() => router.push('/game/create/step1')}
          >
            <View style={styles.btnContentLeft}>
              <Text style={styles.btnIcon}>⊕</Text>
              <Text style={styles.createGameBtnText}>CREATE GAME</Text>
            </View>
            <Text style={styles.createGameSubTag}>HOST LOBBY</Text>
          </Pressable>

          {/* Join Game Button */}
          <Pressable
            style={styles.joinGameBtn}
            onPress={() => router.push('/game/join')}
          >
            <View style={styles.btnContentLeft}>
              <Text style={styles.btnIcon}>⌗</Text>
              <Text style={styles.joinGameBtnText}>JOIN GAME</Text>
            </View>
            <Text style={styles.joinGameSubTag}>CODE / RADAR</Text>
          </Pressable>
        </View>

        {/* Lifetime Stats Matrix */}
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsHeaderText}>LIFETIME STATS</Text>
            <Text style={styles.statsSectorText}>SEC: NYC-08</Text>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statNumber}>{gamesCount}</Text>
              <Text style={styles.statLabel}>GAMES</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statNumber, { color: colors.accentPrimary }]}>
                {winsCount}
              </Text>
              <Text style={styles.statLabel}>WINS</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statNumber}>{tagsCount}</Text>
              <Text style={styles.statLabel}>TAGS</Text>
            </View>
          </View>
        </View>

        {/* Active Patrol Minimap Telemetry Preview */}
        <View style={styles.radarPreviewSection}>
          <View style={styles.radarPreviewHeader}>
            <Text style={styles.radarPreviewTitle}>ACTIVE ZONE RADAR</Text>
            <Text style={styles.radarPreviewCount}>14 RUNNERS NEARBY</Text>
          </View>
          <View style={styles.radarImageBox}>
            <View style={styles.radarSweepBadge}>
              <Text style={styles.radarSweepIcon}>📍</Text>
              <Text style={styles.radarSweepText}>RADAR SWEEP ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* Recent Sessions Log */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>RECENT SESSIONS</Text>
            <Text style={styles.recentArchive}>ARCHIVE →</Text>
          </View>

          {/* Session 1 */}
          <View style={styles.sessionCard}>
            <View style={styles.sessionCardTop}>
              <View style={styles.sessionTitleRow}>
                <View style={styles.runnerRolePill}>
                  <Text style={styles.runnerRoleText}>RUNNER</Text>
                </View>
                <Text style={styles.sessionName}>CENTRAL PARK SECTOR</Text>
              </View>
              <Text style={styles.sessionDate}>YESTERDAY</Text>
            </View>
            <View style={styles.sessionCardBottom}>
              <Text style={styles.winTag}>✓ SURVIVED (WIN)</Text>
              <Text style={styles.sessionDuration}>DURATION 45:10</Text>
            </View>
          </View>

          {/* Session 2 */}
          <View style={styles.sessionCard}>
            <View style={styles.sessionCardTop}>
              <View style={styles.sessionTitleRow}>
                <View style={styles.chaserRolePill}>
                  <Text style={styles.chaserRoleText}>CHASER</Text>
                </View>
                <Text style={styles.sessionName}>SOHO GRID SHRINK</Text>
              </View>
              <Text style={styles.sessionDate}>OCT 12</Text>
            </View>
            <View style={styles.sessionCardBottom}>
              <Text style={styles.winTag}>🎯 3 TAGS (WIN)</Text>
              <Text style={styles.sessionDuration}>DURATION 22:45</Text>
            </View>
          </View>

          {/* Session 3 */}
          <View style={styles.sessionCard}>
            <View style={styles.sessionCardTop}>
              <View style={styles.sessionTitleRow}>
                <View style={styles.runnerRolePill}>
                  <Text style={styles.runnerRoleText}>RUNNER</Text>
                </View>
                <Text style={styles.sessionName}>BROOKLYN NAVY YARD</Text>
              </View>
              <Text style={styles.sessionDate}>OCT 08</Text>
            </View>
            <View style={styles.sessionCardBottom}>
              <Text style={styles.elimTag}>⏱ TAGGED AT 14:22</Text>
              <Text style={styles.sessionDuration}>TOTAL 18:00</Text>
            </View>
          </View>
        </View>

        {/* Tactical Satellite Footer */}
        <View style={styles.satelliteFooter}>
          <Text style={styles.satelliteText}>NEXT SATELLITE WINDOW: 04:19 UTC</Text>
          <View style={styles.greenPip} />
        </View>
      </ScrollView>

      {/* Bottom Navigation Tab Bar */}
      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <Text style={styles.navIconActive}>🏆</Text>
          <Text style={styles.navLabelActive}>HOME</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => router.push('/game/join')}
        >
          <Text style={styles.navIcon}>👥</Text>
          <Text style={styles.navLabel}>LOBBY</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => router.push('/friends')}
        >
          <Text style={styles.navIcon}>🤝</Text>
          <Text style={styles.navLabel}>FRIENDS</Text>
        </Pressable>
        <Pressable
          style={styles.navItem}
          onPress={() => router.push('/profile')}
        >
          <Text style={styles.navIcon}>🎖</Text>
          <Text style={styles.navLabel}>PROFILE</Text>
        </Pressable>
      </View>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  headerTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 16,
  },
  profileBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBadgeText: {
    fontSize: 16,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 80,
  },
  operatorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  operatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pingTarget: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingPing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(198, 255, 0, 0.3)',
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  operatorInfo: {
    justifyContent: 'center',
  },
  operatorHandle: {
    color: colors.textPrimary,
    ...typography.labelMonoMd,
    fontWeight: '700',
  },
  operatorStatus: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    letterSpacing: 1,
  },
  operatorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  levelPill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  actionStack: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  createGameBtn: {
    height: 56,
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  btnContentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  btnIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textInverse,
  },
  createGameBtnText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  createGameSubTag: {
    color: colors.textInverse,
    ...typography.labelMonoSm,
    fontSize: 10,
    opacity: 0.75,
  },
  joinGameBtn: {
    height: 56,
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  joinGameBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  joinGameSubTag: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statsHeaderText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
  },
  statsSectorText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statCell: {
    flex: 1,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  statNumber: {
    color: colors.textPrimary,
    ...typography.headlineMd,
    fontSize: 26,
    lineHeight: 28,
  },
  statLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
    marginTop: 2,
  },
  radarPreviewSection: {
    marginBottom: spacing.md,
  },
  radarPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  radarPreviewTitle: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
  },
  radarPreviewCount: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontWeight: '700',
  },
  radarImageBox: {
    height: 100,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarSweepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  radarSweepIcon: {
    fontSize: 14,
  },
  radarSweepText: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  recentSection: {
    marginBottom: spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recentTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
  },
  recentArchive: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  sessionCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  runnerRolePill: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  runnerRoleText: {
    color: colors.roleRunner,
    ...typography.labelMonoSm,
    fontSize: 9,
    fontWeight: '700',
  },
  chaserRolePill: {
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chaserRoleText: {
    color: colors.roleChaser,
    ...typography.labelMonoSm,
    fontSize: 9,
    fontWeight: '700',
  },
  sessionName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sessionDate: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  sessionCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  winTag: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 11,
    fontWeight: '700',
  },
  elimTag: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 11,
  },
  sessionDuration: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  satelliteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    borderRadius: radii.card,
  },
  satelliteText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  greenPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  navIconActive: {
    fontSize: 18,
  },
  navLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
  },
  navLabelActive: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 9,
    fontWeight: '700',
  },
});
