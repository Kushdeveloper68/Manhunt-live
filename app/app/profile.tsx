import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const AVATAR_OPTIONS = ['🐺', '🦊', '🐻', '🐯', '🦁', '🐺', '🦝', '🐺'];
const AVATAR_IDS = ['wolf', 'fox', 'bear', 'tiger', 'lion', 'wolf2', 'raccoon', 'wolf3'];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, logout, isLoading } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editAvatarId, setEditAvatarId] = useState(user?.avatarId || 'wolf');
  const [editEmergencyName, setEditEmergencyName] = useState(
    user?.emergencyContact?.name || ''
  );
  const [editEmergencyPhone, setEditEmergencyPhone] = useState(
    user?.emergencyContact?.phone || ''
  );

  const username = user?.username?.toUpperCase() || 'SHADOW_RUNNER';
  const stats = user?.stats || { games: 42, wins: 28, tags: 64, escapes: 18, kmRun: 142.3 };
  const winRate =
    stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;

  const avatarIndex = AVATAR_IDS.indexOf(editAvatarId);
  const avatarEmoji = AVATAR_OPTIONS[avatarIndex >= 0 ? avatarIndex : 0];

  async function handleSaveProfile() {
    try {
      await updateProfile({
        username: editUsername.toLowerCase(),
        avatarId: editAvatarId,
        emergencyContact:
          editEmergencyName && editEmergencyPhone
            ? { name: editEmergencyName, phone: editEmergencyPhone }
            : undefined,
      });
      setIsEditing(false);
    } catch (err) {
      Alert.alert('UPDATE FAILED', err instanceof Error ? err.message : 'Profile update error');
    }
  }

  function handleLogout() {
    Alert.alert('SIGN OUT', 'Terminate current operative session?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'SIGN OUT',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/auth/login');
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={{ fontSize: 20, color: colors.textSecondary }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OPERATIVE DOSSIER</Text>
        <TouchableOpacity
          style={styles.editToggleBtn}
          onPress={() => (isEditing ? handleSaveProfile() : setIsEditing(true))}
          activeOpacity={0.8}
        >
          <Text style={styles.editToggleText}>{isEditing ? 'SAVE' : 'EDIT'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Operative Identity Card */}
        <View style={styles.identityCard}>
          {/* Avatar Ring */}
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 44 }}>{avatarEmoji}</Text>
            </View>
            {/* Status beacon */}
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.identityText}>
            <View style={styles.callsignRow}>
              <Text style={styles.callsignLabel}>CALLSIGN</Text>
            </View>
            <Text style={styles.callsign}>@{username}</Text>
            <Text style={styles.joinedDate}>
              OPERATIVE SINCE {user?.createdAt ? new Date(user.createdAt).getFullYear() : 2024}
            </Text>
          </View>

          {/* Rank Badge */}
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>
              {stats.wins >= 50 ? 'VETERAN' : stats.wins >= 20 ? 'HUNTER' : 'ROOKIE'}
            </Text>
          </View>
        </View>

        {/* Avatar Selector (edit mode) */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SELECT AVATAR</Text>
            <View style={styles.avatarSelector}>
              {AVATAR_OPTIONS.map((emoji, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.avatarOption,
                    editAvatarId === AVATAR_IDS[idx] && styles.avatarOptionActive,
                  ]}
                  onPress={() => setEditAvatarId(AVATAR_IDS[idx])}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Performance Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PERFORMANCE METRICS</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.games}</Text>
              <Text style={styles.statKey}>GAMES</Text>
            </View>
            <View style={[styles.statBox, { borderColor: colors.accentPrimary }]}>
              <Text style={[styles.statValue, { color: colors.accentPrimary }]}>{winRate}%</Text>
              <Text style={styles.statKey}>WIN RATE</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.roleChaser }]}>{stats.tags}</Text>
              <Text style={styles.statKey}>TAGS</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.roleRunner }]}>{stats.escapes}</Text>
              <Text style={styles.statKey}>ESCAPES</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.kmRun.toFixed(1)}</Text>
              <Text style={styles.statKey}>KM RUN</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.wins}</Text>
              <Text style={styles.statKey}>WINS</Text>
            </View>
          </View>
        </View>

        {/* Callsign Editor */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CALLSIGN</Text>
            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.textInput}
                value={editUsername}
                onChangeText={setEditUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="your_callsign"
                placeholderTextColor={colors.textSecondary}
                maxLength={20}
              />
              <Text style={styles.inputHint}>3–20 chars. Letters, numbers, underscores only.</Text>
            </View>
          </View>
        )}

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
          <View style={styles.emergencyCard}>
            {isEditing ? (
              <View style={styles.emergencyEditBlock}>
                <View style={styles.inputCard}>
                  <Text style={styles.inputLabel}>CONTACT NAME</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmergencyName}
                    onChangeText={setEditEmergencyName}
                    placeholder="Contact name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={[styles.inputCard, { marginTop: spacing.sm }]}>
                  <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editEmergencyPhone}
                    onChangeText={setEditEmergencyPhone}
                    placeholder="+1 234 567 8900"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.emergencyRow}>
                  <Text style={{ fontSize: 18 }}>🚨</Text>
                  <View style={styles.emergencyInfo}>
                    <Text style={styles.emergencyName}>
                      {user?.emergencyContact?.name || 'NOT SET'}
                    </Text>
                    <Text style={styles.emergencyPhone}>
                      {user?.emergencyContact?.phone || 'Tap EDIT to add emergency contact'}
                    </Text>
                  </View>
                </View>
                <View style={styles.emergencyNotice}>
                  <Text style={{ fontSize: 12 }}>ℹ️</Text>
                  <Text style={styles.emergencyNoticeText}>
                    Emergency contact is notified when SOS is triggered during an active operation.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/friends')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18 }}>👥</Text>
              <Text style={styles.actionLabel}>MANAGE SQUAD</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>›</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18 }}>⚙️</Text>
              <Text style={styles.actionLabel}>TACTICAL SETTINGS</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>›</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/legal/terms')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18 }}>📋</Text>
              <Text style={styles.actionLabel}>TERMS & SAFETY POLICY</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>›</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity
              style={[styles.actionRow]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 18 }}>🚪</Text>
              <Text style={[styles.actionLabel, { color: colors.signalDanger }]}>SIGN OUT</Text>
              <Text style={{ color: colors.signalDanger, fontSize: 16 }}>›</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fHeadlineSm,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  editToggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.pill,
  },
  editToggleText: {
    fontFamily: fMono,
    fontSize: 11,
    color: colors.textInverse,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 60,
  },
  identityCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  avatarRing: {
    position: 'relative',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accentPrimary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.signalSuccess,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  callsignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  callsignLabel: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  callsign: {
    fontFamily: fHeadlineMd,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  joinedDate: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  rankBadge: {
    backgroundColor: '#1A2B00',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  rankText: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.accentPrimary,
    fontWeight: 'bold',
    letterSpacing: 1,
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
  avatarSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  avatarOption: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  avatarOptionActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: '#1A2B00',
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
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  statKey: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  inputLabel: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  textInput: {
    fontFamily: fBody,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  inputHint: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  emergencyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  emergencyEditBlock: {
    gap: spacing.sm,
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emergencyInfo: {
    flex: 1,
    gap: 2,
  },
  emergencyName: {
    fontFamily: fMonoMd,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  emergencyPhone: {
    fontFamily: fMono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  emergencyNotice: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'flex-start',
  },
  emergencyNoticeText: {
    flex: 1,
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  actionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  actionLabel: {
    flex: 1,
    fontFamily: fMono,
    fontSize: 12,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
});
