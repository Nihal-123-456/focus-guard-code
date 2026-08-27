import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius, shadows } from '../theme';
import { useBlacklistStore } from '../data/blacklistStore';
import { useTimerStore } from '../data/timerStore';
import { useHistoryStore } from '../data/historyStore';
import { useSettingsStore } from '../data/settingsStore';
import { useScheduleStore } from '../data/scheduleStore';
import { AppBlocker } from '../native/AppBlocker';
import { PermissionCard } from '../components/PermissionCard';
import { TimerPill } from '../components/TimerPill';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { formatDurationHuman, formatTime, formatRelativeUntil, MS_PER_HOUR } from '../utils/time';
import type { HomeStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const blacklist = useBlacklistStore();
  const timer = useTimerStore();
  const history = useHistoryStore();
  const settings = useSettingsStore();
  const schedules = useScheduleStore();
  const [accessibilityEnabled, setAccessibilityEnabled] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkAccessibility = useCallback(async () => {
    const enabled = await AppBlocker.isAccessibilityEnabled();
    setAccessibilityEnabled(enabled);
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkAccessibility();
    }, [checkAccessibility]),
  );

  useEffect(() => {
    // Hydrate all stores on mount.
    Promise.all([
      blacklist.hydrate(),
      timer.hydrate(),
      history.hydrate(),
      settings.hydrate(),
      schedules.hydrate(),
    ]).then(() => checkAccessibility());
    // Re-render every minute so "next schedule in 5 min" stays fresh.
    const id = setInterval(() => {
      setRefreshing((r) => r); // trigger a re-render without showing the spinner
    }, 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkAccessibility();
    setRefreshing(false);
  }, [checkAccessibility]);

  const activeSession = timer.activeSession;
  const hasActiveSession = !!activeSession;
  const blacklistedCount = blacklist.entries.length;
  const totalBlockedMs = history.getTotalBlockedMs();
  const weekBlockedMs = history.getRecentBlockedMs(7);

  // Compute the next upcoming schedule that's not currently active.
  const nextSchedule = useMemo(() => {
    const allNext = schedules.getAllNextFire();
    const upcoming = allNext.find(
      (f) => !f.isCurrentlyActive && f.nextFireAt !== null,
    );
    if (!upcoming || !upcoming.nextFireAt) return null;
    const schedule = schedules.schedules.find((s) => s.id === upcoming.scheduleId);
    if (!schedule) return null;
    return { schedule, fireAt: upcoming.nextFireAt };
  }, [schedules.schedules, activeSession]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Welcome back</Text>
          <Text style={styles.title}>FocusGuard</Text>
        </View>

        {accessibilityEnabled === false && (
          <PermissionCard onGrant={() => AppBlocker.openAccessibilitySettings()} />
        )}

        {hasActiveSession && activeSession ? (
          <View style={styles.activeSection}>
            <Pressable
              onPress={() => navigation.navigate('ActiveTimer')}
              style={styles.activeCard}
            >
              <TimerPill
                remainingMs={timer.remainingMs}
                totalMs={activeSession.plannedDurationMs}
              />
              <Text style={styles.activeHint}>
                Tap to view focus session · ends at {formatTime(activeSession.endTime)}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.heroCard}>
            <Text style={styles.heroEmoji}>🌿</Text>
            <Text style={styles.heroTitle}>Ready to focus?</Text>
            <Text style={styles.heroDescription}>
              Start a focus session and FocusGuard will keep you out of your
              blacklisted apps until the timer ends.
            </Text>

            <Pressable
              style={[
                styles.ctaButton,
                blacklistedCount === 0 && styles.ctaButtonDisabled,
              ]}
              onPress={() => navigation.navigate('TimerSetup')}
              disabled={blacklistedCount === 0}
            >
              <Text style={styles.ctaButtonText}>
                {blacklistedCount === 0
                  ? 'Add apps to blacklist first'
                  : 'Start focus session'}
              </Text>
            </Pressable>

            {blacklistedCount === 0 && (
              <Pressable
                style={styles.secondaryLink}
                onPress={() => navigation.getParent()?.navigate('Apps')}
              >
                <Text style={styles.secondaryLinkText}>
                  Go to app list →
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {nextSchedule && !hasActiveSession && (
          <Pressable
            style={styles.nextScheduleCard}
            onPress={() => navigation.getParent()?.navigate('SchedulesTab')}
          >
            <View style={styles.nextScheduleHeader}>
              <View style={styles.nextScheduleIcon}>
                <Text style={styles.nextScheduleIconText}>🗓️</Text>
              </View>
              <View style={styles.nextScheduleInfo}>
                <Text style={styles.nextScheduleLabel}>Next schedule</Text>
                <Text style={styles.nextScheduleName} numberOfLines={1}>
                  {nextSchedule.schedule.name}
                </Text>
              </View>
            </View>
            <Text style={styles.nextScheduleTime}>
              Fires {formatRelativeUntil(nextSchedule.fireAt)}
            </Text>
          </Pressable>
        )}

        <View style={styles.statsRow}>
          <StatCard
            label="Blacklisted"
            value={blacklistedCount.toString()}
            sublabel={blacklistedCount === 1 ? 'app' : 'apps'}
          />
          <StatCard
            label="This week"
            value={formatDurationHuman(weekBlockedMs)}
            sublabel="focused"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blacklisted apps</Text>
          {blacklistedCount === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                No apps in your blacklist. Tap "Apps" below to add distracting apps.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {blacklist.entries.slice(0, 4).map((entry) => (
                <View key={entry.packageName} style={styles.row}>
                  <View style={styles.rowDot} />
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {entry.packageName}
                  </Text>
                  {entry.allowCallPassthrough && (
                    <View style={styles.callPill}>
                      <Text style={styles.callPillText}>Calls allowed</Text>
                    </View>
                  )}
                </View>
              ))}
              {blacklistedCount > 4 && (
                <Text style={styles.moreText}>
                  + {blacklistedCount - 4} more…
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent sessions</Text>
          {history.entries.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                No focus sessions yet. Start your first one above.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {history.entries.slice(0, 3).map((entry) => (
                <View key={entry.id} style={styles.row}>
                  <View
                    style={[
                      styles.rowDot,
                      {
                        backgroundColor:
                          entry.status === 'completed'
                            ? colors.accent
                            : colors.danger,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>
                      {formatDurationHuman(entry.actualDurationMs)}
                    </Text>
                    <Text style={styles.rowSub}>
                      {formatTime(entry.startedAt)} · {entry.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Total focused time: {formatDurationHuman(totalBlockedMs)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 11,
    marginBottom: 4,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  activeSection: {
    marginBottom: spacing.lg,
  },
  activeCard: {
    marginBottom: 0,
  },
  activeHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  heroDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: colors.border,
  },
  ctaButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
  secondaryLink: {
    marginTop: spacing.md,
  },
  secondaryLinkText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  emptyRow: {
    paddingVertical: spacing.md,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    lineHeight: 20,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  rowSub: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  callPill: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  callPillText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  moreText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  nextScheduleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextScheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  nextScheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextScheduleIconText: {
    fontSize: 20,
  },
  nextScheduleInfo: {
    flex: 1,
  },
  nextScheduleLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 10,
    marginBottom: 2,
  },
  nextScheduleName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  nextScheduleTime: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
    marginLeft: 56,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
