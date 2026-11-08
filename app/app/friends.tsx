import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { colors, spacing, radii, typography } from '../src/theme/theme';

const fMono = typography.labelMonoSm.fontFamily;
const fMonoMd = typography.labelMonoMd.fontFamily;
const fHeadlineSm = typography.headlineSm.fontFamily;
const fBody = typography.bodyMd.fontFamily;
const fBodyLg = typography.bodyLg.fontFamily;

// ─── Mock data ──────────────────────────────────────────────────────────────

type FriendStatus = 'IN_LOBBY' | 'ONLINE' | 'IN_GAME' | 'OFFLINE';

interface Friend {
  id: string;
  callsign: string;
  status: FriendStatus;
  statusDetail?: string;
  lastSeenLabel?: string;
  avatar: string;
}

const MOCK_FRIENDS: Friend[] = [
  { id: '1', callsign: 'KRONOS_9',   status: 'IN_LOBBY', statusDetail: 'IN LOBBY: CENTRAL PARK', avatar: 'K' },
  { id: '2', callsign: 'NEON_HARE',  status: 'ONLINE',   statusDetail: 'ONLINE',                  avatar: 'N' },
  { id: '3', callsign: 'CIPHER_88',  status: 'IN_GAME',  statusDetail: 'IN GAME',                 avatar: 'C' },
  { id: '4', callsign: 'VEX_ROOK',   status: 'ONLINE',   statusDetail: 'ONLINE',                  avatar: 'V' },
  { id: '5', callsign: 'METRO_HAWK', status: 'OFFLINE',  lastSeenLabel: '2H AGO',                 avatar: 'M' },
  { id: '6', callsign: 'BLITZ_KID',  status: 'OFFLINE',  lastSeenLabel: 'YESTERDAY',              avatar: 'B' },
  { id: '7', callsign: 'ZERO_TRACE', status: 'OFFLINE',  lastSeenLabel: '3D AGO',                 avatar: 'Z' },
];

const ACTIVE_STATUSES: FriendStatus[] = ['IN_LOBBY', 'ONLINE', 'IN_GAME'];

type TabKey = 'friends' | 'requests' | 'nearby';

// ─── Sub-components ──────────────────────────────────────────────────────────

function AvatarBubble({ letter, online }: { letter: string; online: boolean }) {
  return (
    <View style={styles.avatarWrapper}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>{letter}</Text>
      </View>
      {online && <View style={styles.onlineDot} />}
    </View>
  );
}

function ActionButton({
  status,
  onPress,
}: {
  status: FriendStatus;
  onPress: () => void;
}) {
  if (status === 'IN_GAME') {
    return (
      <TouchableOpacity style={[styles.actionBtn, styles.watchBtn]} onPress={onPress} activeOpacity={0.8}>
        <Text style={[styles.actionBtnText, { color: colors.roleRunner }]}>WATCH</Text>
      </TouchableOpacity>
    );
  }
  if (status === 'OFFLINE') {
    return (
      <TouchableOpacity style={[styles.actionBtn, styles.pingBtn]} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.actionBtnText}>PING</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={[styles.actionBtn, styles.inviteBtn]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.actionBtnText, { color: colors.canvas }]}>INVITE</Text>
    </TouchableOpacity>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  const isOnline = ACTIVE_STATUSES.includes(friend.status);

  const handleAction = () => {
    if (friend.status === 'IN_GAME') {
      Alert.alert('Coming Soon', 'Live spectate will be available after launch.');
    } else if (friend.status === 'OFFLINE') {
      Alert.alert('Ping Sent', `Hail transmitted to @${friend.callsign}.`);
    } else {
      Alert.alert('Invite Sent', `Squad invite transmitted to @${friend.callsign}.`);
    }
  };

  return (
    <View style={styles.friendRow}>
      <AvatarBubble letter={friend.avatar} online={isOnline} />
      <View style={styles.friendInfo}>
        <Text style={styles.callsign}>@{friend.callsign}</Text>
        {friend.status !== 'OFFLINE' ? (
          <Text style={styles.statusText}>{friend.statusDetail}</Text>
        ) : (
          <Text style={styles.lastSeenText}>{friend.lastSeenLabel}</Text>
        )}
      </View>
      <ActionButton status={friend.status} onPress={handleAction} />
    </View>
  );
}

// ─── Stub tab contents ───────────────────────────────────────────────────────

function RequestsTab() {
  const MOCK_REQUESTS = [
    { id: 'r1', callsign: 'SCAVENGER_01', avatar: 'S' },
    { id: 'r2', callsign: 'RED_VIPER',    avatar: 'R' },
    { id: 'r3', callsign: 'NYX_SOLO',     avatar: 'N' },
  ];
  return (
    <View style={styles.tabContent}>
      {MOCK_REQUESTS.map((req) => (
        <View key={req.id} style={styles.requestRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{req.avatar}</Text>
          </View>
          <Text style={[styles.callsign, { flex: 1, marginLeft: spacing.sm }]}>@{req.callsign}</Text>
          <TouchableOpacity
            style={[styles.actionBtn, styles.inviteBtn, { marginRight: spacing.xs }]}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Accepted', `@${req.callsign} added to your network.`)}
          >
            <Text style={[styles.actionBtnText, { color: colors.canvas }]}>CONFIRM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.pingBtn]}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Declined', `Request from @${req.callsign} dismissed.`)}
          >
            <Text style={styles.actionBtnText}>DENY</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function NearbyTab() {
  return (
    <View style={styles.tabContent}>
      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonIcon}>📡</Text>
        <Text style={styles.comingSoonTitle}>NEARBY RADAR</Text>
        <Text style={styles.comingSoonBody}>
          Proximity detection will be available in the next operational update.
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabKey>('friends');
  const [query, setQuery] = useState('');

  const myCallsign = user?.username?.toUpperCase() ?? 'SHADOW_RUNNER';

  const filtered = useMemo(() => {
    if (!query.trim()) return MOCK_FRIENDS;
    const q = query.toLowerCase().replace('@', '');
    return MOCK_FRIENDS.filter((f) => f.callsign.toLowerCase().includes(q));
  }, [query]);

  const onlineFriends = filtered.filter((f) => ACTIVE_STATUSES.includes(f.status));
  const offlineFriends = filtered.filter((f) => f.status === 'OFFLINE');

  const handleShare = () =>
    Alert.alert('Coming Soon', 'QR code sharing will be available after launch.');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={styles.pulseDot} />
          <Text style={styles.headerTitle}>FRIENDS</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{myCallsign.charAt(0)}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Recruit Uplink Card */}
        <View style={styles.recruitCard}>
          <View style={styles.recruitTop}>
            <View style={{ flex: 1 }}>
              <View style={styles.uplinkRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.uplinkLabel}>UPLINK BROADCAST</Text>
              </View>
              <Text style={styles.recruitTitle}>RECRUIT OPERATIVES</Text>
              <Text style={styles.recruitBody}>
                Transmit your tactical coordinate QR or encoded squad link into local runner networks.
              </Text>
            </View>
            <View style={styles.qrIconBox}>
              <Text style={styles.qrIcon}>▦</Text>
            </View>
          </View>
          <View style={styles.recruitActions}>
            <TouchableOpacity style={styles.shareQrBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.shareQrText}>⬆ SHARE QR CODE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.copyLinkBtn}
              onPress={() => Alert.alert('Coming Soon', 'Link copy will be available after launch.')}
              activeOpacity={0.85}
            >
              <Text style={styles.copyLinkText}>LINK</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search @callsign or phone..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Segmented tabs */}
        <View style={styles.tabPills}>
          {(['friends', 'requests', 'nearby'] as TabKey[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabPillText, activeTab === tab && styles.tabPillTextActive]}>
                {tab === 'friends' ? 'FRIENDS (18)' : tab === 'requests' ? 'REQUESTS' : 'NEARBY (5)'}
              </Text>
              {tab === 'requests' && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>3</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'friends' && (
          <View style={{ gap: spacing.lg }}>
            {/* Online Now */}
            {onlineFriends.length > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.pulseDot, { backgroundColor: colors.accentPrimary }]} />
                    <Text style={styles.sectionTitle}>ONLINE NOW ({onlineFriends.length})</Text>
                  </View>
                  <Text style={styles.sectionMeta}>LIVE SECTOR</Text>
                </View>
                <View style={{ gap: spacing.xs }}>
                  {onlineFriends.map((f) => <FriendRow key={f.id} friend={f} />)}
                </View>
              </View>
            )}

            {/* Offline */}
            {offlineFriends.length > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={[styles.pulseDot, { backgroundColor: colors.textSecondary }]} />
                    <Text style={styles.sectionTitle}>OFFLINE OPERATIVES ({offlineFriends.length})</Text>
                  </View>
                </View>
                <View style={{ gap: spacing.xs }}>
                  {offlineFriends.map((f) => <FriendRow key={f.id} friend={f} />)}
                </View>
              </View>
            )}

            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👁</Text>
                <Text style={styles.emptyTitle}>NO OPERATIVES FOUND</Text>
                <Text style={styles.emptyBody}>Adjust your search parameters.</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'requests' && <RequestsTab />}
        {activeTab === 'nearby' && <NearbyTab />}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },

  // Header
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backArrow: {
    color: colors.textSecondary,
    fontSize: 20,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  headerTitle: {
    fontFamily: fHeadlineSm,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  headerRight: { alignItems: 'flex-end' },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    fontFamily: fMono,
    fontSize: 14,
    color: colors.accentPrimary,
  },

  scroll: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // Recruit card
  recruitCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recruitTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  uplinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  uplinkLabel: {
    fontFamily: fMono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.accentPrimary,
  },
  recruitTitle: {
    fontFamily: fHeadlineSm,
    fontSize: 18,
    letterSpacing: 1.5,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  recruitBody: {
    fontFamily: fBody,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  qrIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qrIcon: {
    fontSize: 24,
    color: colors.accentPrimary,
  },
  recruitActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  shareQrBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareQrText: {
    fontFamily: fBodyLg,
    fontSize: 14,
    fontWeight: '700',
    color: colors.canvas,
    letterSpacing: 1,
  },
  copyLinkBtn: {
    height: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyLinkText: {
    fontFamily: fMono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textPrimary,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontFamily: fMonoMd,
    fontSize: 13,
    color: colors.textPrimary,
  },
  clearIcon: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Tabs
  tabPills: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tabPillActive: {
    backgroundColor: colors.accentPrimary,
  },
  tabPillText: {
    fontFamily: fMono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  tabPillTextActive: {
    color: colors.canvas,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: colors.roleChaser,
    borderRadius: radii.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontFamily: fMono,
    fontSize: 9,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fHeadlineSm,
    fontSize: 14,
    letterSpacing: 1.5,
    color: colors.textPrimary,
  },
  sectionMeta: {
    fontFamily: fMono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.accentPrimary,
  },

  // Friend row
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: fMono,
    fontSize: 16,
    color: colors.accentPrimary,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accentPrimary,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
  },
  callsign: {
    fontFamily: fMonoMd,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  statusText: {
    fontFamily: fBody,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lastSeenText: {
    fontFamily: fMono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Action buttons
  actionBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexShrink: 0,
  },
  inviteBtn: {
    backgroundColor: colors.accentPrimary,
  },
  watchBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.roleRunner,
  },
  pingBtn: {
    backgroundColor: colors.surfaceElevated,
  },
  actionBtnText: {
    fontFamily: fMono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  // Request row
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },

  // Tab content wrapper
  tabContent: {
    gap: spacing.xs,
  },

  // Coming soon card (Nearby tab)
  comingSoonCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  comingSoonIcon: { fontSize: 36 },
  comingSoonTitle: {
    fontFamily: fHeadlineSm,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  comingSoonBody: {
    fontFamily: fBody,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 32 },
  emptyTitle: {
    fontFamily: fHeadlineSm,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  emptyBody: {
    fontFamily: fBody,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
