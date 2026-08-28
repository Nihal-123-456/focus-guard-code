import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { useScheduleStore } from '../data/scheduleStore';
import { useTimerStore } from '../data/timerStore';
import { useSettingsStore } from '../data/settingsStore';
import { ScheduleCard } from '../components/ScheduleCard';
import { EmptyState } from '../components/EmptyState';
import type { SchedulesStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<SchedulesStackParamList>;

export function SchedulesScreen() {
  const navigation = useNavigation<Nav>();
  const scheduleStore = useScheduleStore();
  const timer = useTimerStore();
  const settings = useSettingsStore();
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!scheduleStore.loaded) scheduleStore.hydrate();
    if (!settings.loaded) settings.hydrate();
    if (!timer.loaded) timer.hydrate();
    // Re-render every 30s so "Next: in 5 min" stays fresh.
    const id = setInterval(() => forceTick((n) => n + 1), 30 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allNextFire = useMemo(
    () => scheduleStore.getAllNextFire(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleStore.schedules, timer.activeSession],
  );

  const onToggleSchedule = useCallback(
    (id: string) => {
      const s = scheduleStore.getById(id);
      if (!s) return;
      // If turning OFF a schedule that's currently running, ask for confirmation.
      if (s.enabled) {
        const isActive = timer.activeSession?.source === 'schedule' &&
          timer.activeSession?.scheduleId === id;
        if (isActive) {
          Alert.alert(
            'Disable running schedule?',
            `The "${s.name}" schedule is currently running. Disabling it will end the active session immediately.`,
            [
              { text: 'Cancel' },
              {
                text: 'Disable & end session',
                style: 'destructive',
                onPress: async () => {
                  await scheduleStore.toggle(id);
                  await timer.endSessionEarly('schedule_window_ended');
                },
              },
            ],
          );
          return;
        }
      }
      scheduleStore.toggle(id);
    },
    [scheduleStore, timer],
  );

  const onDeleteSchedule = useCallback(
    (id: string) => {
      const s = scheduleStore.getById(id);
      if (!s) return;
      Alert.alert(
        'Delete schedule?',
        `Are you sure you want to delete "${s.name}"? This cannot be undone.`,
        [
          { text: 'Cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // If it's currently running, end the session.
              if (
                timer.activeSession?.source === 'schedule' &&
                timer.activeSession?.scheduleId === id
              ) {
                await timer.endSessionEarly('schedule_window_ended');
              }
              await scheduleStore.remove(id);
            },
          },
        ],
      );
    },
    [scheduleStore, timer],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Schedules</Text>
        <Text style={styles.subtitle}>
          {scheduleStore.schedules.length}{' '}
          {scheduleStore.schedules.length === 1 ? 'schedule' : 'schedules'} ·{' '}
          {scheduleStore.schedules.filter((s) => s.enabled).length} active
        </Text>
      </View>

      {!settings.schedulesAutoStart && (
        <View style={styles.disabledBanner}>
          <Text style={styles.disabledBannerText}>
            ⚠️ Auto-start is disabled in Settings. Schedules won't fire
            automatically — toggle "Scheduled session auto-start" in Settings to enable.
          </Text>
        </View>
      )}

      {scheduleStore.schedules.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No schedules yet"
          description="Create a recurring schedule to automatically block apps during set times — like every weekday morning or every night."
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {scheduleStore.schedules.map((schedule) => {
            const nextFire = allNextFire.find(
              (f) => f.scheduleId === schedule.id,
            ) ?? null;
            return (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                nextFire={nextFire}
                onToggle={() => onToggleSchedule(schedule.id)}
                onPress={() =>
                  navigation.navigate('ScheduleEditor', { scheduleId: schedule.id })
                }
              />
            );
          })}

          <Pressable
            style={styles.deleteHint}
            onLongPress={() => {
              if (scheduleStore.schedules.length === 0) return;
              const first = scheduleStore.schedules[0];
              onDeleteSchedule(first.id);
            }}
          >
            <Text style={styles.deleteHintText}>
              Tip: long-press a schedule in the editor to delete it.
            </Text>
          </Pressable>
        </ScrollView>
      )}

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('ScheduleEditor', { scheduleId: undefined })}
      >
        <Text style={styles.fabText}>+ New schedule</Text>
      </Pressable>
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
  disabledBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  disabledBannerText: {
    ...typography.caption,
    color: colors.warning,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  deleteHint: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  deleteHintText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.lg + 60, // leave room for tab bar
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadows.md,
  },
  fabText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 17,
  },
});
