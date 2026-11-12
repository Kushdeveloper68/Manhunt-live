import React, { useCallback, useEffect, useState } from 'react';
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
import { useLobbyStore } from '../src/stores/lobbyStore';
import { api, FriendEntry, FriendRequestEntry, FriendSearchResult } from '../src/services/api';
import { colors, spacing, radii, typography } from '../src/theme/theme';

const fMono = typography.labelMonoSm.fontFamily;
const fMonoMd = typography.labelMonoMd.fontFamily;
const fHeadlineSm = typography.headlineSm.fontFamily;
const fBody = typography.bodyMd.fontFamily;
const fBodyLg = typography.bodyLg.fontFamily;

// ─── Types & helpers ─────────────────────────────────────────────────────────

type FriendStatus = FriendEntry['status'];
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

function ActionButton({ status, onPress }: { status: FriendStatus; onPress: () => void }) {
  if (status === 'IN_GAME' || status === 'OFFLINE') {
    // Nothing to do with a friend who is mid-game or offline
    return (
      <View style={[styles.actionBtn, styles.pingBtn, { opacity: 0.45 }]}>
        <Text style={styles.actionBtnText}>{status === 'IN_GAME' ? 'IN GAME' : 'OFFLINE'}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={[styles.actionBtn, styles.inviteBtn]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.actionBtnText, { color: colors.canvas }]}>INVITE</Text>
    </TouchableOpacity>
  );
}

function FriendRow({
  friend,
  onInvite,
  onRemove,
}: {
  friend: FriendEntry;
  onInvite: (f: FriendEntry) => void;
  onRemove: (f: FriendEntry) => void;
}) {
  const isOnline = ACTIVE_STATUSES.includes(friend.status);
  return (
    <TouchableOpacity activeOpacity={1} onLongPress={() => onRemove(friend)} delayLongPress={600}>
      <View style={styles.friendRow}>
        <AvatarBubble letter={friend.username.charAt(0).toUpperCase()} online={isOnline} />
        <View style={styles.friendInfo}>
          <Text style={styles.callsign}>@{friend.username.toUpperCase()}</Text>
          {friend.status !== 'OFFLINE' ? (
            <Text style={styles.statusText}>{friend.statusDetail}</Text>
          ) : (
            <Text style={styles.lastSeenText}>{friend.lastSeenLabel ?? 'OFFLINE'}</Text>
          )}
        </View>
        <ActionButton status={friend.status} onPress={() => onInvite(friend)} />
      </View>
    </TouchableOpacity>
  );
}

function RequestsTab({
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onCancel,
}: {
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
  onAccept: (r: FriendRequestEntry) => void;
  onDecline: (r: FriendRequestEntry) => void;
  onCancel: (r: FriendRequestEntry) => void;
}) {
  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>NO PENDING REQUESTS</Text>
        <Text style={styles.emptyBody}>Search a @callsign above to add someone.</Text>
      </View>
    );
  }
  return (
    <View style={styles.tabContent}>
      {incoming.map((req) => (
        <View key={req.requestId} style={styles.requestRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{req.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.callsign, { flex: 1, marginLeft: spacing.sm }]}>@{req.username.toUpperCase()}</Text>
          <TouchableOpacity
            style={[styles.actionBtn, styles.inviteBtn, { marginRight: spacing.xs }]}
            activeOpacity={0.8}
            onPress={() => onAccept(req)}
          >
            <Text style={[styles.actionBtnText, { color: colors.canvas }]}>CONFIRM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.pingBtn]} activeOpacity={0.8} onPress={() => onDecline(req)}>
            <Text style={styles.actionBtnText}>DENY</Text>
          </TouchableOpacity>
        </View>
      ))}
      {outgoing.map((req) => (
        <View key={req.requestId} style={styles.requestRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>{req.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={[styles.callsign, { flex: 1, marginLeft: spacing.sm }]}>@{req.username.toUpperCase()}</Text>
          <TouchableOpacity style={[styles.actionBtn, styles.pingBtn]} activeOpacity={0.8} onPress={() => onCancel(req)}>
            <Text style={styles.actionBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function SearchResultRow({
  result,
  onAdd,
  onAccept,
}: {
  result: FriendSearchResult;
  onAdd: (r: FriendSearchResult) => void;
  onAccept: (r: FriendSearchResult) => void;
}) {
  return (
    <View style={styles.friendRow}>
      <AvatarBubble letter={result.username.charAt(0).toUpperCase()} online={false} />
      <View style={styles.friendInfo}>
        <Text style={styles.callsign}>@{result.username.toUpperCase()}</Text>
      </View>
      {result.relationship === 'NONE' && (
        <TouchableOpacity style={[styles.actionBtn, styles.inviteBtn]} onPress={() => onAdd(result)} activeOpacity={0.8}>
          <Text style={[styles.actionBtnText, { color: colors.canvas }]}>ADD</Text>
        </TouchableOpacity>
      )}
      {result.relationship === 'REQUEST_RECEIVED' && (
        <TouchableOpacity style={[styles.actionBtn, styles.inviteBtn]} onPress={() => onAccept(result)} activeOpacity={0.8}>
          <Text style={[styles.actionBtnText, { color: colors.canvas }]}>ACCEPT</Text>
        </TouchableOpacity>
      )}
      {(result.relationship === 'REQUEST_SENT' || result.relationship === 'FRIEND') && (
        <View style={[styles.actionBtn, styles.pingBtn, { opacity: 0.6 }]}>
          <Text style={styles.actionBtnText}>{result.relationship === 'FRIEND' ? 'FRIEND' : 'SENT'}</Text>
        </View>
      )}
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

  const lobby = useLobbyStore((st) => st.gameState);

  const [activeTab, setActiveTab] = useState<TabKey>('friends');
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestEntry[]>([]);
  const [results, setResults] = useState<FriendSearchResult[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  const myCallsign = user?.username?.toUpperCase() ?? 'OPERATIVE';

  const load = useCallback(() => {
    api
      .getFriends()
      .then((d) => {
        setFriends(d.friends);
        setIncoming(d.incoming);
        setOutgoing(d.outgoing);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Load now, then keep presence fresh while the screen is open
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Debounced username search on the server
  useEffect(() => {
    const q = query.trim().replace(/^@/, '').toLowerCase();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      api.searchFriends(q).then((r) => setResults(r.results)).catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const fail = (err: unknown) => Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong');

  const handleInvite = (f: FriendEntry) => {
    if (!lobby || lobby.status !== 'lobby') {
      Alert.alert('No lobby', 'Create or join a lobby first, then invite your friends from here.');
      return;
    }
    api.inviteFriend(lobby.gameId, f.userId).then(() => Alert.alert('Invite sent', `@${f.username} was invited.`)).catch(fail);
  };

  const handleRemove = (f: FriendEntry) =>
    Alert.alert('Remove friend', `Remove @${f.username} from your network?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => api.removeFriend(f.userId).then(load).catch(fail) },
    ]);

  const handleAdd = (r: FriendSearchResult) =>
    api
      .sendFriendRequest(r.username)
      .then((res) => {
        setResults((list) =>
          list ? list.map((x) => (x.userId === r.userId ? { ...x, relationship: res.status === 'FRIENDS' ? 'FRIEND' : 'REQUEST_SENT' } : x)) : list
        );
        load();
      })
      .catch(fail);

  const acceptById = (requestId: string) =>
    api.acceptFriendRequest(requestId).then(() => {
      setQuery('');
      load();
    }).catch(fail);

  const onlineFriends = friends.filter((f) => ACTIVE_STATUSES.includes(f.status));
  const offlineFriends = friends.filter((f) => f.status === 'OFFLINE');

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
            placeholder="Search @callsign..."
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
                {tab === 'friends' ? `FRIENDS (${friends.length})` : tab === 'requests' ? 'REQUESTS' : 'NEARBY'}
              </Text>
              {tab === 'requests' && incoming.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{incoming.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {results !== null && (
          <View style={{ gap: spacing.xs }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SEARCH RESULTS ({results.length})</Text>
            </View>
            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👁</Text>
                <Text style={styles.emptyTitle}>NO OPERATIVES FOUND</Text>
                <Text style={styles.emptyBody}>Check the spelling of the callsign.</Text>
              </View>
            ) : (
              results.map((r) => (
                <SearchResultRow
                  key={r.userId}
                  result={r}
                  onAdd={handleAdd}
                  onAccept={(x) => (x.requestId ? acceptById(x.requestId) : undefined)}
                />
              ))
            )}
          </View>
        )}

        {results === null && activeTab === 'friends' && (
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
                  {onlineFriends.map((f) => <FriendRow key={f.userId} friend={f} onInvite={handleInvite} onRemove={handleRemove} />)}
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
                  {offlineFriends.map((f) => <FriendRow key={f.userId} friend={f} onInvite={handleInvite} onRemove={handleRemove} />)}
                </View>
              </View>
            )}

            {loaded && friends.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>NO FRIENDS YET</Text>
                <Text style={styles.emptyBody}>Search a @callsign above to send a friend request.</Text>
              </View>
            )}
          </View>
        )}

        {results === null && activeTab === 'requests' && (
          <RequestsTab
            incoming={incoming}
            outgoing={outgoing}
            onAccept={(r) => acceptById(r.requestId)}
            onDecline={(r) => api.declineFriendRequest(r.requestId).then(load).catch(fail)}
            onCancel={(r) => api.cancelFriendRequest(r.requestId).then(load).catch(fail)}
          />
        )}
        {results === null && activeTab === 'nearby' && <NearbyTab />}
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
