import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography, spacing, radius, shadows } from '../theme';
import { useTimerStore } from '../data/timerStore';
import { formatDuration, formatTime } from '../utils/time';

export function ActiveTimerScreen() {
  const timer = useTimerStore();
  const session = timer.activeSession;
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideCountdown, setOverrideCountdown] = useState(10);

  // Hydrate if not loaded yet (in case user opens via deep link).
  useEffect(() => {
    if (!timer.loaded) {
      timer.hydrate();
    }
  }, [timer]);

  const handleEndEarly = useCallback(() => {
    setShowOverrideModal(true);
    setOverrideCountdown(10);
  }, []);

  useEffect(() => {
    if (!showOverrideModal) return;
    if (overrideCountdown <= 0) return;
    const id = setTimeout(() => {
      setOverrideCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [showOverrideModal, overrideCountdown]);

  const confirmOverride = useCallback(async () => {
    try {
      await timer.endSessionEarly('user_override');
      setShowOverrideModal(false);
    } catch (e: any) {
      Alert.alert('Failed to end session', e?.message ?? String(e));
    }
  }, [timer]);

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, styles.centering]} edges={['top']}>
        <Text style={styles.noSessionText}>No active focus session</Text>
        <Text style={styles.noSessionSubtext}>
          The session may have just completed or been aborted.
        </Text>
      </SafeAreaView>
    );
  }

  const totalMs = session.plannedDurationMs;
  const remainingMs = timer.remainingMs;
  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const elapsedMs = totalMs - remainingMs;
  const progressPct = Math.round(progress * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Focus session in progress</Text>
        <Text style={styles.headerHint}>
          Ends at {formatTime(session.endTime)}
        </Text>
      </View>

      <View style={styles.timerContainer}>
        <View style={styles.timerCard}>
          <Text style={styles.timerDigit}>{formatDuration(remainingMs)}</Text>
          <Text style={styles.timerLabel}>remaining</Text>

          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progressPct}%` }]}
            />
          </View>

          <Text style={styles.progressPctText}>{progressPct}% complete</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{session.blacklistSnapshot.length}</Text>
            <Text style={styles.statLabel}>apps blocked</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{Math.floor(elapsedMs / 60000)}</Text>
            <Text style={styles.statLabel}>min elapsed</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{Math.ceil(remainingMs / 60000)}</Text>
            <Text style={styles.statLabel}>min remaining</Text>
          </View>
        </View>
      </View>

      <View style={styles.lockedNotice}>
        <Text style={styles.lockedTitle}>🔒 Session locked</Text>
        <Text style={styles.lockedText}>
          You cannot stop the timer or edit your blacklist during this session.
          Incoming calls will still come through.
        </Text>
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutIcon}>📞</Text>
        <View style={styles.calloutBody}>
          <Text style={styles.calloutTitle}>Calls are allowed</Text>
          <Text style={styles.calloutText}>
            Phone, WhatsApp, imo, Messenger — incoming calls will ring normally
            and you can answer them.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          Try to open a blacklisted app — FocusGuard will block it automatically.
        </Text>
        <Pressable style={styles.endBtn} onPress={handleEndEarly}>
          <Text style={styles.endBtnText}>End session early</Text>
        </Pressable>
        <Text style={styles.footerWarn}>
          This requires a 10-second confirmation hold.
        </Text>
      </View>

      {/* Override modal — 10-second cooldown */}
      <Modal
        visible={showOverrideModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverrideModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogIcon}>⚠️</Text>
            <Text style={styles.dialogTitle}>End session early?</Text>
            <Text style={styles.dialogDescription}>
              You committed to this focus session. Ending it early will break your
              streak and the remaining time won't count toward your stats.
            </Text>
            {overrideCountdown > 0 ? (
              <>
                <Text style={styles.dialogCountdown}>
                  Hold to confirm ({overrideCountdown}s)
                </Text>
                <View style={styles.dialogActions}>
                  <Pressable
                    style={styles.dialogBtn}
                    onPress={() => setShowOverrideModal(false)}
                  >
                    <Text style={styles.dialogBtnTextSecondary}>Keep focusing</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dialogBtn, styles.dialogBtnDangerDisabled]}
                    disabled
                  >
                    <Text style={styles.dialogBtnTextDangerDisabled}>
                      End early ({overrideCountdown}s)
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.dialogCountdownReady}>
                  Are you sure? This cannot be undone.
                </Text>
                <View style={styles.dialogActions}>
                  <Pressable
                    style={styles.dialogBtn}
                    onPress={() => setShowOverrideModal(false)}
                  >
                    <Text style={styles.dialogBtnTextSecondary}>Keep focusing</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dialogBtn, styles.dialogBtnDanger]}
                    onPress={confirmOverride}
                  >
                    <Text style={styles.dialogBtnTextDanger}>End session</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centering: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noSessionText: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  noSessionSubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  eyebrow: {
    ...typography.label,
    color: colors.accent,
    fontSize: 11,
  },
  headerHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  timerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xl,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerDigit: {
    ...typography.displayHero,
    fontSize: 64,
    color: colors.textPrimary,
    fontWeight: '300',
    letterSpacing: -2,
  },
  timerLabel: {
    ...typography.label,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.ringTrack,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressPctText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  statCell: {
    alignItems: 'center',
  },
  statVal: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 24,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  lockedNotice: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  lockedTitle: {
    ...typography.h3,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  lockedText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  callout: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  calloutIcon: {
    fontSize: 20,
  },
  calloutBody: {
    flex: 1,
  },
  calloutTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  calloutText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  footerHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  endBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  endBtnText: {
    ...typography.button,
    color: colors.danger,
  },
  footerWarn: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...shadows.lg,
  },
  dialogIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  dialogTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  dialogDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  dialogCountdown: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  dialogCountdownReady: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '600',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    justifyContent: 'center',
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dialogBtnDanger: {
    backgroundColor: colors.danger,
  },
  dialogBtnDangerDisabled: {
    backgroundColor: colors.border,
  },
  dialogBtnTextSecondary: {
    ...typography.button,
    color: colors.textSecondary,
  },
  dialogBtnTextDanger: {
    ...typography.button,
    color: colors.textInverse,
  },
  dialogBtnTextDangerDisabled: {
    ...typography.button,
    color: colors.textTertiary,
  },
});
