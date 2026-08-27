import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography, spacing, radius } from '../theme';
import { useAppListStore, isMockMode } from '../data/appListStore';
import { useBlacklistStore } from '../data/blacklistStore';
import { useSettingsStore } from '../data/settingsStore';
import { useTimerStore } from '../data/timerStore';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { isCommunicationApp } from '../utils/constants';

export function AppListScreen() {
  const appList = useAppListStore();
  const blacklist = useBlacklistStore();
  const settings = useSettingsStore();
  const timer = useTimerStore();
  const [query, setQuery] = useState('');

  const sessionActive = timer.activeSession !== null;

  useEffect(() => {
    if (!appList.loaded) {
      appList.hydrate().then(() => {
        appList.refresh().catch(() => undefined);
      });
    }
    if (!blacklist.loaded) blacklist.hydrate();
    if (!settings.loaded) settings.hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    appList.refresh().catch((e) => {
      Alert.alert('Failed to refresh', e?.message ?? String(e));
    });
  }, [appList]);

  const filteredApps = useMemo(() => {
    let list = appList.search(query);
    if (!settings.showSystemApps) {
      list = list.filter((a) => !a.isSystem);
    }
    return list;
  }, [appList.apps, query, settings.showSystemApps]);

  const onToggle = useCallback(
    (packageName: string, label: string) => {
      if (sessionActive) {
        Alert.alert(
          'Blacklist is locked',
          "You can't modify the blacklist while a focus session is active. Wait for the timer to end.",
          [{ text: 'OK' }],
        );
        return;
      }
      const existing = blacklist.entries.find((e) => e.packageName === packageName);
      if (existing) {
        blacklist.remove(packageName);
      } else {
        blacklist.add({ packageName, label, isLaunchable: true, isSystem: false });
      }
    },
    [blacklist, sessionActive],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Apps</Text>
        <Text style={styles.subtitle}>
          {blacklist.entries.length} blacklisted · {appList.apps.length} total
        </Text>
      </View>

      {isMockMode() && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>
            Demo mode — using a stub list of apps. Build with{' '}
            <Text style={{ fontWeight: '600' }}>expo run:android</Text> to see real
            installed apps.
          </Text>
        </View>
      )}

      {sessionActive && (
        <View style={styles.lockedBanner}>
          <Text style={styles.lockedBannerText}>
            🔒 Blacklist is locked during the active focus session.
          </Text>
        </View>
      )}

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search apps…"
          placeholderTextColor={colors.textTertiary}
        />
        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          {appList.loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.refreshBtnText}>↻</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Show system apps</Text>
        <Switch
          value={settings.showSystemApps}
          onValueChange={(v) => settings.update({ showSystemApps: v })}
          trackColor={{ false: colors.border, true: colors.accent }}
        />
      </View>

      {filteredApps.length === 0 && !appList.loading ? (
        <EmptyState
          icon="🔍"
          title={query ? 'No apps found' : 'No apps available'}
          description={
            query
              ? `No installed apps match "${query}".`
              : 'Pull to refresh or grant permissions.'
          }
        />
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredApps.map((app) => {
            const isBlacklisted = blacklist.entries.some(
              (e) => e.packageName === app.packageName,
            );
            return (
              <AppCard
                key={app.packageName}
                label={app.label}
                packageName={app.packageName}
                isBlacklisted={isBlacklisted}
                isLocked={sessionActive}
                isCommunicationApp={isCommunicationApp(app.packageName)}
                onToggle={() => onToggle(app.packageName, app.label)}
              />
            );
          })}
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
  mockBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  mockBannerText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  lockedBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  lockedBannerText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: {
    fontSize: 22,
    color: colors.accent,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  list: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
});
