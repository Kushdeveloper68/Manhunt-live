import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii, typography } from '../../src/theme/theme';
import { Button } from '../../src/components/Button';
import { CodeInput } from '../../src/components/CodeInput';
import { useGameStore } from '../../src/stores/gameStore';

export default function JoinGameScreen() {
  const router = useRouter();
  const { lookupGameByCode, isLoading } = useGameStore();

  const [code, setCode] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [hasInvite, setHasInvite] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEnterLobby = async () => {
    setErrorMsg(null);
    if (code.trim().length !== 6) {
      setErrorMsg('Please enter a 6-character code');
      return;
    }

    try {
      const game = await lookupGameByCode(code.trim().toUpperCase());
      Alert.alert(
        'LOBBY LOCATED',
        `Successfully connected to session "${game.name}" [${game.code}]`,
        [
          {
            text: 'ENTER LOBBY',
            onPress: () => router.push('/'),
          },
        ]
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Game session not found');
    }
  };

  const handleScanQr = () => {
    setShowQrScanner((prev) => !prev);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>JOIN GAME</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Subhead Section */}
        <View style={styles.headingSection}>
          <View style={styles.syncRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.syncText}>NODE SYNC: ACTIVE</Text>
          </View>
          <Text style={styles.mainTitle}>ENTER GAME CODE</Text>
          <Text style={styles.subTitle}>
            Input the 6-character lobby code from the host or scan their tactical QR badge to uplink.
          </Text>
        </View>

        {/* 6-Character Code Input Card */}
        <View style={styles.codeCard}>
          <CodeInput
            length={6}
            value={code}
            onChange={(val) => {
              setCode(val);
              setErrorMsg(null);
            }}
            error={Boolean(errorMsg)}
          />

          <View style={styles.codeMetaRow}>
            <Text style={styles.encryptedLabel}>🔒 ENCRYPTED</Text>
            {code.length > 0 && (
              <Pressable onPress={() => setCode('')}>
                <Text style={styles.clearBtnText}>CLEAR PIN</Text>
              </Pressable>
            )}
          </View>

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionRow}>
          <Button
            label="ENTER LOBBY"
            variant="primary"
            onPress={handleEnterLobby}
            loading={isLoading}
            style={styles.actionBtn}
          />
          <Button
            label={showQrScanner ? 'CLOSE SCANNER' : 'SCAN HOST QR CODE (COMING SOON)'}
            variant="secondary"
            onPress={handleScanQr}
            style={styles.actionBtn}
          />
        </View>

        {/* Tactical QR HUD Drawer (Optical Scanner Stub) */}
        {showQrScanner && (
          <View style={styles.qrDrawer}>
            <View style={styles.qrDrawerHeader}>
              <Text style={styles.qrDrawerTitle}>HUD OPTICAL SCANNER</Text>
              <Pressable onPress={() => setShowQrScanner(false)}>
                <Text style={styles.qrCloseText}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.scannerBox}>
              <View style={styles.reticleFrame}>
                <View style={styles.reticleBeam} />
              </View>
              <Text style={styles.scannerHint}>
                ALIGN HOST QR CODE GLYPH (FEATURE COMING SOON)
              </Text>
            </View>
          </View>
        )}

        {/* Direct Invites Section */}
        <View style={styles.invitesSection}>
          <View style={styles.invitesHeader}>
            <View style={styles.invitesTitleRow}>
              <Text style={styles.invitesTitle}>DIRECT INVITES</Text>
              <View style={styles.inviteCountBadge}>
                <Text style={styles.inviteCountText}>{hasInvite ? '1' : '0'}</Text>
              </View>
            </View>
            <Text style={styles.expiresText}>EXPIRES SOON</Text>
          </View>

          {hasInvite ? (
            <View style={styles.inviteCard}>
              <View style={styles.inviteCardTop}>
                <View style={styles.hostAvatar}>
                  <Text style={styles.hostAvatarText}>🦅</Text>
                </View>
                <View style={styles.inviteDetails}>
                  <View style={styles.hostHandleRow}>
                    <Text style={styles.hostHandle}>@METRO_HAWK</Text>
                    <View style={styles.chaserSquadPill}>
                      <Text style={styles.chaserSquadText}>CHASER SQUAD</Text>
                    </View>
                  </View>
                  <Text style={styles.inviteMatchName}>MIDTOWN SHADOW PURSUIT</Text>
                  <Text style={styles.inviteMetrics}>
                    📍 2.4 km zone • ⏱ Starts in 12m
                  </Text>
                </View>
              </View>

              <View style={styles.inviteActions}>
                <Pressable
                  style={styles.declineBtn}
                  onPress={() => setHasInvite(false)}
                >
                  <Text style={styles.declineBtnText}>DECLINE</Text>
                </Pressable>
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => {
                    setCode('MH7842');
                    Alert.alert('Invite Accepted', 'Lobby code MH7842 loaded. Tap "ENTER LOBBY" to join.');
                  }}
                >
                  <Text style={styles.acceptBtnText}>ACCEPT</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.noInvitesBox}>
              <Text style={styles.noInvitesTitle}>QUEUE CLEARED</Text>
              <Text style={styles.noInvitesSub}>
                No pending orbital matches. Share your operative handle to receive pings.
              </Text>
            </View>
          )}
        </View>

        {/* Tactical Guidance Snippet */}
        <View style={styles.guidanceBox}>
          <Text style={styles.guidanceIcon}>🛰</Text>
          <View style={styles.guidanceContent}>
            <Text style={styles.guidanceTitle}>TACTICAL BRIEFING</Text>
            <Text style={styles.guidanceText}>
              Once synced, players have 90 seconds to reach the drop perimeter before live chaser hunting telemetry activates.
            </Text>
          </View>
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
    height: 56,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
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
  headerTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
  },
  placeholder: {
    width: 40,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headingSection: {
    marginBottom: spacing.lg,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  syncText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    letterSpacing: 1.2,
  },
  mainTitle: {
    color: colors.textPrimary,
    ...typography.headlineLg,
    letterSpacing: 1,
  },
  subTitle: {
    color: colors.textSecondary,
    ...typography.bodyMd,
    marginTop: 4,
  },
  codeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  codeMetaRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  encryptedLabel: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  clearBtnText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  errorText: {
    color: colors.signalDanger,
    ...typography.bodySm,
    marginTop: spacing.xs,
  },
  actionRow: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    width: '100%',
  },
  qrDrawer: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  qrDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  qrDrawerTitle: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    letterSpacing: 1,
  },
  qrCloseText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  scannerBox: {
    height: 160,
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleFrame: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: 'rgba(198, 255, 0, 0.4)',
    borderRadius: radii.sm,
    justifyContent: 'center',
  },
  reticleBeam: {
    height: 2,
    backgroundColor: colors.accentPrimary,
    width: '100%',
  },
  scannerHint: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 9,
    marginTop: spacing.sm,
  },
  invitesSection: {
    marginBottom: spacing.lg,
  },
  invitesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  invitesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  invitesTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
    fontSize: 16,
  },
  inviteCountBadge: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  inviteCountText: {
    color: colors.accentPrimary,
    ...typography.labelMonoSm,
    fontSize: 10,
    fontWeight: '700',
  },
  expiresText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  inviteCardTop: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    fontSize: 22,
  },
  inviteDetails: {
    flex: 1,
  },
  hostHandleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostHandle: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontWeight: '700',
  },
  chaserSquadPill: {
    backgroundColor: 'rgba(255, 59, 92, 0.15)',
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chaserSquadText: {
    color: colors.roleChaser,
    ...typography.labelMonoSm,
    fontSize: 8,
    fontWeight: '700',
  },
  inviteMatchName: {
    color: colors.textPrimary,
    ...typography.headlineSm,
    fontSize: 15,
    marginTop: 2,
  },
  inviteMetrics: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontSize: 10,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  declineBtn: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.button,
  },
  declineBtnText: {
    color: colors.textSecondary,
    ...typography.labelMonoSm,
    fontWeight: '700',
  },
  acceptBtn: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.button,
  },
  acceptBtnText: {
    color: colors.textInverse,
    ...typography.labelMonoSm,
    fontWeight: '800',
  },
  noInvitesBox: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
  },
  noInvitesTitle: {
    color: colors.textPrimary,
    ...typography.headlineSm,
  },
  noInvitesSub: {
    color: colors.textSecondary,
    ...typography.bodySm,
    textAlign: 'center',
    marginTop: 4,
  },
  guidanceBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  guidanceIcon: {
    fontSize: 20,
  },
  guidanceContent: {
    flex: 1,
  },
  guidanceTitle: {
    color: colors.textPrimary,
    ...typography.labelMonoSm,
    fontWeight: '700',
  },
  guidanceText: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontSize: 11,
    marginTop: 2,
  },
});
