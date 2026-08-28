import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius, shadows } from '../theme';
import { useHistoryStore } from '../data/historyStore';
import { useAppListStore } from '../data/appListStore';
import { useBlacklistStore } from '../data/blacklistStore';
import { EmptyState } from '../components/EmptyState';
import { isCompleted, isAborted } from '../utils/stats';
import { formatDurationHuman, formatDateTime } from '../utils/time';
import type { StatsStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<StatsStackParamList>;

type FilterStatus = 'all' | 'completed' | 'aborted';

export function HistoryScreen() {
  const history = useHistoryStore();
  const appList = useAppListStore();
  const blacklist = useBlacklistStore();
  const navigation = useNavigation<Nav>();
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    if (!history.loaded) history.hydrate();
    if (!appList.loaded) appList.hydrate();
    if (!blacklist.loaded) blacklist.hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of appList.apps) map.set(a.packageName, a.label);
    for (const b of blacklist.entries) {
      if (!map.has(b.packageName)) {
        map.set(b.packageName, b.packageName.split('.').pop() ?? b.packageName);
      }
    }
    return map;
  }, [appList.apps, blacklist.entries]);

  const filtered = useMemo(() => {
    if (filter === 'all') return history.entries;
    if (filter === 'completed') return history.entries.filter(isCompleted);
    return history.entries.filter(isAborted);
  }, [history.entries, filter]);

  const clearHistory = () => {
    Alert.alert(
      'Clear history?',
      'This will permanently delete all past session records.',
      [
        { text: 'Cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => history.clear(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Stats</Text>
        </Pressable>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {filtered.length} {filtered.length === 1 ? 'session' : 'sessions'}
        </Text>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'completed', 'aborted'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterBtnText,
                filter === f && styles.filterBtnTextActive,
              ]}
            >
              {f === 'all' ? 'All' : f === 'completed' ? 'Completed' : 'Ended early'}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📜"
          title="No sessions yet"
          description="Your session history will appear here as you complete focus sessions."
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((entry) => (
            <View key={entry.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isCompleted(entry)
                        ? colors.accent
                        : isAborted(entry)
                          ? colors.danger
                          : colors.warning,
                    },
                  ]}
                />
                <Text style={styles.sessionDuration}>
                  {formatDurationHuman(entry.actualDurationMs)}
                  {isAborted(entry) && ' · ended early'}
                  {entry.abortReason === 'schedule_window_ended' && ' · schedule ended'}
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {entry.source === 'schedule' ? 'Schedule' : 'Manual'}
                  </Text>
                </View>
              </View>

              <View style={styles.sessionBody}>
                <Text style={styles.sessionMeta}>
                  Started {formatDateTime(entry.startedAt)}
                </Text>
                {entry.endedAt && (
                  <Text style={styles.sessionMeta}>
                    Ended {formatDateTime(entry.endedAt)}
                  </Text>
                )}
                {entry.source === 'schedule' && entry.scheduleName && (
                  <Text style={styles.sessionMeta}>
                    Schedule: {entry.scheduleName}
                  </Text>
                )}
                <Text style={styles.sessionMeta}>
                  Planned: {formatDurationHuman(entry.plannedDurationMs)} ·{' '}
                  {entry.blacklistSnapshot.length} apps blocked
                </Text>
              </View>

              {entry.blacklistSnapshot.length > 0 && (
                <View style={styles.appListWrap}>
                  {entry.blacklistSnapshot.slice(0, 5).map((pkg) => (
                    <View key={pkg} style={styles.appPill}>
                      <Text style={styles.appPillText} numberOfLines={1}>
                        {labelMap.get(pkg) ?? pkg.split('.').pop() ?? pkg}
                      </Text>
                    </View>
                  ))}
                  {entry.blacklistSnapshot.length > 5 && (
                    <View style={styles.appPill}>
                      <Text style={styles.appPillText}>
                        +{entry.blacklistSnapshot.length - 5} more
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}

          <Pressable style={styles.clearBtn} onPress={clearHistory}>
            <Text style={styles.clearBtnText}>Clear all history</Text>
          </Pressable>
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
  backBtn: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
    marginBottom: spacing.xs,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterBtnTextActive: {
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
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionDuration: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  statusBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionBody: {
    gap: 2,
    marginBottom: spacing.md,
  },
  sessionMeta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  appListWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  appPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: 140,
  },
  appPillText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  clearBtnText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '500',
  },
});
