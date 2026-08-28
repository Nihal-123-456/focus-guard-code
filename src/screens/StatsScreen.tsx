import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius, shadows } from '../theme';
import { useHistoryStore } from '../data/historyStore';
import { useAppListStore } from '../data/appListStore';
import { useBlacklistStore } from '../data/blacklistStore';
import { aggregateStats, formatDayLabel, formatHourLabel, peakFocusHour, isCompleted, isAborted } from '../utils/stats';
import { formatDurationHuman, formatDateTime } from '../utils/time';
import { StatCard } from '../components/StatCard';
import { BarChart } from '../components/BarChart';
import { StreakBadge } from '../components/StreakBadge';
import { EmptyState } from '../components/EmptyState';
import type { StatsRange } from '../types';
import type { StatsStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<StatsStackParamList>;

export function StatsScreen() {
  const history = useHistoryStore();
  const appList = useAppListStore();
  const blacklist = useBlacklistStore();
  const navigation = useNavigation<Nav>();
  const [range, setRange] = useState<StatsRange>('7d');

  useEffect(() => {
    if (!history.loaded) history.hydrate();
    if (!appList.loaded) appList.hydrate();
    if (!blacklist.loaded) blacklist.hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(
    () => aggregateStats(history.entries, range),
    [history.entries, range],
  );

  const dailyChartData = useMemo(
    () =>
      stats.daily.map((d) => ({
        label: formatDayLabel(d.date, range),
        value: d.ms,
        sublabel: formatDurationHuman(d.ms),
      })),
    [stats.daily, range],
  );

  const hourlyChartData = useMemo(() => {
    // Show only hours where the user typically focuses, otherwise compress to every 3rd hour.
    return stats.hourly
      .filter((_, i) => i % 3 === 0)
      .map((h) => ({
        label: formatHourLabel(h.hour).replace(' ', '').replace('M', ''),
        value: h.ms,
        sublabel: formatDurationHuman(h.ms),
      }));
  }, [stats.hourly]);

  // Build a package-name → label map for the per-app breakdown.
  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of appList.apps) {
      map.set(a.packageName, a.label);
    }
    for (const b of blacklist.entries) {
      if (!map.has(b.packageName)) {
        // Fallback: use the part after the last dot.
        const short = b.packageName.split('.').pop() ?? b.packageName;
        map.set(b.packageName, short);
      }
    }
    return map;
  }, [appList.apps, blacklist.entries]);

  const peakHour = useMemo(() => peakFocusHour(stats.hourly), [stats.hourly]);

  const recentSessions = useMemo(() => history.entries.slice(0, 5), [history.entries]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>
          {stats.sessionCount} {stats.sessionCount === 1 ? 'session' : 'sessions'} ·{' '}
          {formatDurationHuman(stats.totalMs)} focused
        </Text>
      </View>

      <View style={styles.rangeRow}>
        {(['7d', '30d', 'all'] as const).map((r) => (
          <Pressable
            key={r}
            style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
            onPress={() => setRange(r)}
          >
            <Text
              style={[
                styles.rangeBtnText,
                range === r && styles.rangeBtnTextActive,
              ]}
            >
              {r === 'all' ? 'All time' : `Last ${r}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {history.entries.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No stats yet"
          description="Complete your first focus session and your stats will appear here."
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Top stats grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Total focus"
              value={formatDurationHuman(stats.totalMs)}
              sublabel={range === 'all' ? 'all time' : `last ${range}`}
            />
            <StatCard
              label="Avg / session"
              value={formatDurationHuman(stats.avgSessionMs)}
              sublabel={`${stats.sessionCount} sessions`}
            />
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              label="Completed"
              value={stats.completedCount.toString()}
              accent="accent"
            />
            <StatCard
              label="Ended early"
              value={stats.abortedCount.toString()}
              accent="danger"
            />
          </View>

          {/* Streak */}
          <View style={styles.sectionCard}>
            <StreakBadge current={stats.currentStreak} longest={stats.longestStreak} />
            <View style={styles.completionRow}>
              <View style={styles.completionCell}>
                <Text style={styles.completionLabel}>Completion rate</Text>
                <Text style={styles.completionValue}>
                  {Math.round(stats.completionRate * 100)}%
                </Text>
              </View>
              <View style={styles.completionCell}>
                <Text style={styles.completionLabel}>Peak focus hour</Text>
                <Text style={styles.completionValue}>
                  {peakHour !== null ? formatHourLabel(peakHour) : '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Daily chart */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              Daily focus time {range !== 'all' ? `(${range})` : '(last 30 days)'}
            </Text>
            <BarChart
              data={dailyChartData}
              height={120}
              formatValue={(v) => formatDurationHuman(v)}
            />
          </View>

          {/* Time-of-day pattern */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Time of day</Text>
            <Text style={styles.sectionSubtitle}>
              When do you usually start focus sessions?
            </Text>
            <BarChart
              data={hourlyChartData}
              height={100}
              formatValue={(v) => formatDurationHuman(v)}
            />
          </View>

          {/* Per-app breakdown */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Most-blocked apps</Text>
            {stats.perApp.length === 0 ? (
              <Text style={styles.emptyText}>
                No app-blocking data in this range.
              </Text>
            ) : (
              <View>
                {stats.perApp.slice(0, 6).map((app) => {
                  const maxCount = stats.perApp[0].count || 1;
                  const widthPct = Math.max(8, (app.count / maxCount) * 100);
                  const label = labelMap.get(app.packageName) ?? app.packageName;
                  return (
                    <View key={app.packageName} style={styles.perAppRow}>
                      <View style={styles.perAppLabelRow}>
                        <Text style={styles.perAppLabel} numberOfLines={1}>
                          {label}
                        </Text>
                        <Text style={styles.perAppCount}>
                          {app.count}× · {formatDurationHuman(app.ms)}
                        </Text>
                      </View>
                      <View style={styles.perAppBarTrack}>
                        <View
                          style={[styles.perAppBarFill, { width: `${widthPct}%` }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Recent sessions preview + link to history */}
          <View style={styles.sectionCard}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Recent sessions</Text>
              <Pressable
                onPress={() => navigation.navigate('History')}
              >
                <Text style={styles.seeAllBtn}>See all →</Text>
              </Pressable>
            </View>

            {recentSessions.length === 0 ? (
              <Text style={styles.emptyText}>No sessions yet.</Text>
            ) : (
              recentSessions.map((entry) => (
                <View key={entry.id} style={styles.sessionRow}>
                  <View
                    style={[
                      styles.sessionDot,
                      {
                        backgroundColor: isCompleted(entry)
                          ? colors.accent
                          : isAborted(entry)
                            ? colors.danger
                            : colors.warning,
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionDuration} numberOfLines={1}>
                      {formatDurationHuman(entry.actualDurationMs)}
                      {isAborted(entry) && ' · ended early'}
                      {entry.source === 'schedule' && entry.scheduleName
                        ? ` · ${entry.scheduleName}`
                        : ''}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {formatDateTime(entry.startedAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  rangeRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  rangeBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rangeBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  rangeBtnTextActive: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionCard: {
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
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  completionRow: {
    flexDirection: 'row',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  completionCell: {
    flex: 1,
  },
  completionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 10,
    marginBottom: 2,
  },
  completionValue: {
    ...typography.h2,
    color: colors.textPrimary,
    fontSize: 22,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    paddingVertical: spacing.md,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllBtn: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionDuration: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  sessionMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  perAppRow: {
    paddingVertical: spacing.xs,
  },
  perAppLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  perAppLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  perAppCount: {
    ...typography.caption,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  perAppBarTrack: {
    height: 6,
    backgroundColor: colors.ringTrack,
    borderRadius: 3,
    overflow: 'hidden',
  },
  perAppBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
});
