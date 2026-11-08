import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveGameStore } from '../../src/stores/liveGameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { colors, spacing, radii, typography } from '../../src/theme/theme';

const fMono = typography.labelMonoSm.fontFamily;
const fMonoMd = typography.labelMonoMd.fontFamily;
const fMonoLg = typography.labelMonoLg.fontFamily;
const fHeadlineLg = typography.headlineLg.fontFamily;
const fHeadlineMd = typography.headlineMd.fontFamily;
const fHeadlineSm = typography.headlineSm.fontFamily;
const fBody = typography.bodyMd.fontFamily;
const fBodyLg = typography.bodyLg.fontFamily;

export default function GameOverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const { matchEnd, myRole, players, startedAt, durationMin, resetGame } = useLiveGameStore();

  const winnerRole = matchEnd?.winnerRole || 'RUNNER';
  const reason = matchEnd?.reason || 'SURVIVED: Match duration ended';
  const isWinner =
    (winnerRole === 'RUNNER' && myRole === 'RUNNER') ||
    (winnerRole === 'CHASER' && myRole === 'CHASER');

  const matchDurationMin = startedAt
    ? Math.round((Date.now() - startedAt) / 60000)
    : durationMin;

  // Stats computed from live game state
  const runnersAlive = players.filter(
    (p) => p.role === 'RUNNER' && p.status === 'ACTIVE'
  ).length;
  const totalRunners = players.filter((p) => p.role === 'RUNNER').length;
  const totalChasers = players.filter((p) => p.role === 'CHASER').length;
  const totalPlayers = players.length || 8;

  // Fallback demo stats for profile
  const userStats = {
    tags: user?.stats?.tags || 3,
    kmRun: user?.stats?.kmRun || 2.4,
    wins: user?.stats?.wins || 1,
    games: user?.stats?.games || 1,
    xpEarned: isWinner ? 450 : 120,
  };

  // Victory/defeat animations
  const bannerScale = useRef(new Animated.Value(0.6)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const statsFadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Vibration.vibrate(isWinner ? [100, 100, 200, 300] : [200, 100, 200]);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(bannerScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(bannerOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(statsFadeIn, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  function handlePlayAgain() {
    resetGame();
    router.replace('/home');
  }

  function handleViewProfile() {
    router.push('/profile');
  }

  const bannerBg = isWinner ? colors.accentPrimary : '#1A0A0A';
  const bannerTextColor = isWinner ? colors.textInverse : colors.textPrimary;
  const bannerBorder = isWinner ? 'transparent' : colors.signalDanger;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Victory / Defeat Banner */}
        <Animated.View
          style={[
            styles.banner,
            { backgroundColor: bannerBg, borderColor: bannerBorder },
            { transform: [{ scale: bannerScale }], opacity: bannerOpacity },
          ]}
        >
          {/* Match outcome label */}
          <View style={styles.outcomeRow}>
            <Text style={[styles.outcomeEmoji]}>{isWinner ? '🏆' : '💀'}</Text>
            <View>
              <Text style={[styles.outcomeLabel, { color: bannerTextColor }]}>
                {isWinner ? 'MISSION COMPLETE' : 'OPERATIVE DOWN'}
              </Text>
              <Text style={[styles.outcomeRole, { color: bannerTextColor, opacity: 0.7 }]}>
                {winnerRole}S WIN
              </Text>
            </View>
          </View>

          {/* Winning/losing message */}
          <Text style={[styles.outcomeSub, { color: bannerTextColor, opacity: 0.8 }]}>
            {reason}
          </Text>

          {/* Match Duration Pill */}
          <View
            style={[
              styles.durationPill,
              {
                backgroundColor: isWinner
                  ? 'rgba(0,0,0,0.15)'
                  : 'rgba(255,255,255,0.08)',
              },
            ]}
          >
            <Text style={{ fontSize: 14 }}>⏱</Text>
            <Text style={[styles.durationText, { color: bannerTextColor }]}>
              {matchDurationMin}:00 ELAPSED
            </Text>
          </View>
        </Animated.View>

        {/* Match Stats Grid */}
        <Animated.View style={[styles.section, { opacity: statsFadeIn }]}>
          <Text style={styles.sectionLabel}>OPERATIVE STATS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{userStats.tags}</Text>
              <Text style={styles.statKey}>TAGS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{userStats.kmRun.toFixed(1)}</Text>
              <Text style={styles.statKey}>KM RUN</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.accentPrimary }]}>
                +{userStats.xpEarned}
              </Text>
              <Text style={styles.statKey}>XP EARNED</Text>
            </View>
          </View>
        </Animated.View>

        {/* Survival Timeline */}
        <Animated.View style={[styles.section, { opacity: statsFadeIn }]}>
          <Text style={styles.sectionLabel}>MATCH INTEL</Text>
          <View style={styles.intelCard}>
            <View style={styles.intelRow}>
              <View style={styles.intelLeft}>
                <View style={[styles.intelDot, { backgroundColor: colors.roleRunner }]} />
                <Text style={styles.intelKey}>RUNNERS SURVIVING</Text>
              </View>
              <Text style={styles.intelVal}>
                {runnersAlive} / {totalRunners || 4}
              </Text>
            </View>
            <View style={styles.intelDivider} />
            <View style={styles.intelRow}>
              <View style={styles.intelLeft}>
                <View style={[styles.intelDot, { backgroundColor: colors.roleChaser }]} />
                <Text style={styles.intelKey}>CHASERS DEPLOYED</Text>
              </View>
              <Text style={styles.intelVal}>{totalChasers || 3}</Text>
            </View>
            <View style={styles.intelDivider} />
            <View style={styles.intelRow}>
              <View style={styles.intelLeft}>
                <View style={[styles.intelDot, { backgroundColor: colors.textSecondary }]} />
                <Text style={styles.intelKey}>TOTAL OPERATIVES</Text>
              </View>
              <Text style={styles.intelVal}>{totalPlayers}</Text>
            </View>
            <View style={styles.intelDivider} />
            <View style={styles.intelRow}>
              <View style={styles.intelLeft}>
                <View style={[styles.intelDot, { backgroundColor: colors.accentPrimary }]} />
                <Text style={styles.intelKey}>MATCH DURATION</Text>
              </View>
              <Text style={styles.intelVal}>{matchDurationMin} MIN</Text>
            </View>
          </View>
        </Animated.View>

        {/* Leaderboard Top 3 Stub */}
        <Animated.View style={[styles.section, { opacity: statsFadeIn }]}>
          <Text style={styles.sectionLabel}>SESSION LEADERBOARD</Text>
          <View style={styles.leaderboardCard}>
            {[
              { rank: 1, name: user?.username?.toUpperCase() || 'SHADOW_RUNNER', role: myRole, xp: userStats.xpEarned + 50 },
              { rank: 2, name: 'KRONOS_9', role: 'CHASER', xp: 300 },
              { rank: 3, name: 'NEON_HARE', role: 'RUNNER', xp: 220 },
            ].map((entry) => (
              <View key={entry.rank} style={styles.leaderRow}>
                <View style={styles.leaderRankBox}>
                  <Text style={[
                    styles.leaderRank,
                    { color: entry.rank === 1 ? colors.accentPrimary : colors.textSecondary },
                  ]}>
                    #{entry.rank}
                  </Text>
                </View>
                <View style={[
                  styles.leaderRoleDot,
                  { backgroundColor: entry.role === 'RUNNER' ? colors.roleRunner : colors.roleChaser },
                ]} />
                <Text style={[
                  styles.leaderName,
                  { color: entry.rank === 1 ? colors.textPrimary : colors.textSecondary },
                ]}>
                  @{entry.name}
                </Text>
                <Text style={styles.leaderXP}>+{entry.xp} XP</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* CTA Buttons */}
        <Animated.View style={[styles.ctaBlock, { opacity: statsFadeIn }]}>
          <TouchableOpacity
            style={styles.playAgainBtn}
            activeOpacity={0.88}
            onPress={handlePlayAgain}
          >
            <Text style={{ fontSize: 20 }}>⚡</Text>
            <Text style={styles.playAgainText}>NEW OPERATION</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.profileBtn}
            activeOpacity={0.8}
            onPress={handleViewProfile}
          >
            <Text style={{ fontSize: 18 }}>👤</Text>
            <Text style={styles.profileBtnText}>VIEW DOSSIER</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  banner: {
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 2,
    gap: spacing.sm,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  outcomeEmoji: {
    fontSize: 44,
  },
  outcomeLabel: {
    fontFamily: fHeadlineLg,
    fontSize: 32,
    letterSpacing: 1,
    lineHeight: 36,
  },
  outcomeRole: {
    fontFamily: fMono,
    fontSize: 12,
    letterSpacing: 2,
  },
  outcomeSub: {
    fontFamily: fBody,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
  },
  durationText: {
    fontFamily: fMono,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fMono,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statValue: {
    fontFamily: fMonoLg,
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  statKey: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  intelCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  intelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  intelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  intelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  intelKey: {
    fontFamily: fMono,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  intelVal: {
    fontFamily: fMonoMd,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  intelDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  leaderboardCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  leaderRankBox: {
    width: 32,
  },
  leaderRank: {
    fontFamily: fMonoMd,
    fontSize: 13,
    fontWeight: 'bold',
  },
  leaderRoleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  leaderName: {
    flex: 1,
    fontFamily: fMono,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  leaderXP: {
    fontFamily: fMono,
    fontSize: 11,
    color: colors.accentPrimary,
    fontWeight: 'bold',
  },
  ctaBlock: {
    gap: spacing.sm,
  },
  playAgainBtn: {
    height: 56,
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  playAgainText: {
    fontFamily: fBodyLg,
    fontSize: 16,
    color: colors.textInverse,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  profileBtn: {
    height: 48,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  profileBtnText: {
    fontFamily: fBody,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
