import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, typography, spacing, radius, shadows } from '../theme';
import { useScheduleStore } from '../data/scheduleStore';
import { useBlacklistStore } from '../data/blacklistStore';
import { useAppListStore } from '../data/appListStore';
import { WeekdayPicker } from '../components/WeekdayPicker';
import { TimeRangePicker } from '../components/TimeRangePicker';
import { isCommunicationApp } from '../utils/constants';
import type { PresetSchedule } from '../types';
import type { SchedulesStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<SchedulesStackParamList>;

interface ScheduleEditorScreenProps {
  route: { params: { scheduleId?: string } };
}

export function ScheduleEditorScreen({ route }: ScheduleEditorScreenProps) {
  const navigation = useNavigation<Nav>();
  const scheduleId = route.params?.scheduleId;
  const scheduleStore = useScheduleStore();
  const blacklist = useBlacklistStore();
  const appList = useAppListStore();
  const isEditing = !!scheduleId;

  const [name, setName] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(11);
  const [endMinute, setEndMinute] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [blacklistPackages, setBlacklistPackages] = useState<string[]>([]);
  const [useCustomBlacklist, setUseCustomBlacklist] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [appQuery, setAppQuery] = useState('');

  useEffect(() => {
    if (!scheduleStore.loaded) scheduleStore.hydrate();
    if (!blacklist.loaded) blacklist.hydrate();
    if (!appList.loaded) appList.hydrate();
    if (!appList.apps.length) appList.refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load existing schedule if editing.
  useEffect(() => {
    if (!scheduleId) return;
    const s = scheduleStore.getById(scheduleId);
    if (!s) return;
    setName(s.name);
    setDaysOfWeek(s.daysOfWeek);
    setStartHour(s.startHour);
    setStartMinute(s.startMinute);
    setEndHour(s.endHour);
    setEndMinute(s.endMinute);
    setEnabled(s.enabled);
    if (s.blacklist.length > 0) {
      setUseCustomBlacklist(true);
      setBlacklistPackages(s.blacklist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const filteredApps = useMemo(() => {
    const q = appQuery.trim().toLowerCase();
    let list = appList.apps;
    if (q) {
      list = list.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [appList.apps, appQuery]);

  const toggleBlacklistPackage = useCallback((pkg: string) => {
    setBlacklistPackages((prev) =>
      prev.includes(pkg)
        ? prev.filter((p) => p !== pkg)
        : [...prev, pkg],
    );
  }, []);

  const isOvernight =
    endHour < startHour || (endHour === startHour && endMinute <= startMinute);

  const durationMs = useMemo(() => {
    const startMs = startHour * 60 * 60 * 1000 + startMinute * 60 * 1000;
    const endMs = endHour * 60 * 60 * 1000 + endMinute * 60 * 1000;
    if (isOvernight) return 24 * 60 * 60 * 1000 - startMs + endMs;
    return Math.max(60 * 1000, endMs - startMs);
  }, [startHour, startMinute, endHour, endMinute, isOvernight]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Schedule name is required.';
    if (daysOfWeek.length === 0) return 'Select at least one day of the week.';
    if (useCustomBlacklist && blacklistPackages.length === 0) {
      return 'Select at least one app to block, or uncheck "Use custom blacklist".';
    }
    if (!useCustomBlacklist && blacklist.entries.length === 0) {
      return 'Your main blacklist is empty. Either add apps to it on the Apps tab, or use a custom blacklist here.';
    }
    return null;
  };

  const handleSave = useCallback(async () => {
    const error = validate();
    if (error) {
      Alert.alert('Cannot save', error);
      return;
    }

    const payload: Omit<PresetSchedule, 'id' | 'createdAt' | 'updatedAt'> = {
      name: name.trim(),
      daysOfWeek: daysOfWeek.slice().sort((a, b) => a - b),
      startHour,
      startMinute,
      endHour,
      endMinute,
      enabled,
      blacklist: useCustomBlacklist ? blacklistPackages : [],
    };

    if (isEditing && scheduleId) {
      await scheduleStore.update(scheduleId, payload);
    } else {
      await scheduleStore.add(payload);
    }
    navigation.goBack();
  }, [
    name,
    daysOfWeek,
    startHour,
    startMinute,
    endHour,
    endMinute,
    enabled,
    useCustomBlacklist,
    blacklistPackages,
    isEditing,
    scheduleId,
    scheduleStore,
    navigation,
    blacklist.entries.length,
  ]);

  const handleDelete = useCallback(async () => {
    if (!scheduleId) return;
    Alert.alert(
      'Delete schedule?',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await scheduleStore.remove(scheduleId);
            navigation.goBack();
          },
        },
      ],
    );
  }, [scheduleId, name, scheduleStore, navigation]);

  // Quick presets for common schedules.
  const applyPreset = (preset: 'weekday-morning' | 'weekday-evening' | 'weekend-morning' | 'all-day') => {
    switch (preset) {
      case 'weekday-morning':
        setDaysOfWeek([1, 2, 3, 4, 5]);
        setStartHour(9); setStartMinute(0);
        setEndHour(11); setEndMinute(0);
        break;
      case 'weekday-evening':
        setDaysOfWeek([1, 2, 3, 4, 5]);
        setStartHour(22); setStartMinute(0);
        setEndHour(7); setEndMinute(0);
        break;
      case 'weekend-morning':
        setDaysOfWeek([0, 6]);
        setStartHour(9); setStartMinute(0);
        setEndHour(12); setEndMinute(0);
        break;
      case 'all-day':
        setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
        setStartHour(0); setStartMinute(0);
        setEndHour(23); setEndMinute(59);
        break;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Cancel</Text>
        </Pressable>
        <Text style={styles.title}>
          {isEditing ? 'Edit schedule' : 'New schedule'}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick presets */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Quick templates</Text>
            <View style={styles.presetRow}>
              <Pressable style={styles.presetBtn} onPress={() => applyPreset('weekday-morning')}>
                <Text style={styles.presetBtnText}>Weekday mornings</Text>
              </Pressable>
              <Pressable style={styles.presetBtn} onPress={() => applyPreset('weekday-evening')}>
                <Text style={styles.presetBtnText}>Bedtime</Text>
              </Pressable>
              <Pressable style={styles.presetBtn} onPress={() => applyPreset('weekend-morning')}>
                <Text style={styles.presetBtnText}>Weekend mornings</Text>
              </Pressable>
              <Pressable style={styles.presetBtn} onPress={() => applyPreset('all-day')}>
                <Text style={styles.presetBtnText}>All day</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Morning focus"
            placeholderTextColor={colors.textTertiary}
            maxLength={50}
          />
        </View>

        {/* Days */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Days of week</Text>
          <WeekdayPicker value={daysOfWeek} onChange={setDaysOfWeek} />
          {daysOfWeek.length === 0 && (
            <Text style={styles.hintText}>
              Select at least one day.
            </Text>
          )}
        </View>

        {/* Time range */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time window</Text>
          <TimeRangePicker
            startHour={startHour}
            startMinute={startMinute}
            endHour={endHour}
            endMinute={endMinute}
            onChange={({ startHour, startMinute, endHour, endMinute }) => {
              setStartHour(startHour);
              setStartMinute(startMinute);
              setEndHour(endHour);
              setEndMinute(endMinute);
            }}
          />
          <Text style={styles.hintText}>
            Duration:{' '}
            <Text style={styles.hintValue}>
              {Math.floor(durationMs / (60 * 60 * 1000))}h{' '}
              {Math.floor((durationMs % (60 * 60 * 1000)) / (60 * 1000))}m
            </Text>
            {isOvernight && ' · overnight window'}
          </Text>
        </View>

        {/* Blacklist source */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Apps to block</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Use custom blacklist</Text>
              <Text style={styles.switchSublabel}>
                {useCustomBlacklist
                  ? `${blacklistPackages.length} apps selected`
                  : `Uses main blacklist (${blacklist.entries.length} apps)`}
              </Text>
            </View>
            <Switch
              value={useCustomBlacklist}
              onValueChange={setUseCustomBlacklist}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          {useCustomBlacklist && (
            <View>
              <Pressable
                style={styles.selectAppsBtn}
                onPress={() => setShowAppPicker(true)}
              >
                <Text style={styles.selectAppsBtnText}>
                  {blacklistPackages.length === 0
                    ? 'Select apps to block'
                    : `${blacklistPackages.length} ${blacklistPackages.length === 1 ? 'app' : 'apps'} selected — tap to edit`}
                </Text>
              </Pressable>

              {blacklistPackages.length > 0 && (
                <View style={styles.selectedAppsWrap}>
                  {blacklistPackages.slice(0, 6).map((pkg) => {
                    const app = appList.apps.find((a) => a.packageName === pkg);
                    return (
                      <View key={pkg} style={styles.appPill}>
                        <Text style={styles.appPillText} numberOfLines={1}>
                          {app?.label ?? pkg.split('.').pop() ?? pkg}
                        </Text>
                      </View>
                    );
                  })}
                  {blacklistPackages.length > 6 && (
                    <View style={styles.appPill}>
                      <Text style={styles.appPillText}>
                        +{blacklistPackages.length - 6} more
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Enabled */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Enabled</Text>
              <Text style={styles.switchSublabel}>
                When disabled, the schedule will not fire automatically.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        {isEditing && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete schedule</Text>
          </Pressable>
        )}
      </ScrollView>

      <Pressable style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveBtnText}>
          {isEditing ? 'Save changes' : 'Create schedule'}
        </Text>
      </Pressable>

      {/* App picker modal */}
      {showAppPicker && (
        <View style={styles.appPickerOverlay}>
          <View style={styles.appPickerDialog}>
            <View style={styles.appPickerHeader}>
              <Text style={styles.appPickerTitle}>Select apps to block</Text>
              <Pressable onPress={() => setShowAppPicker(false)}>
                <Text style={styles.appPickerDone}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.appPickerSearch}
              value={appQuery}
              onChangeText={setAppQuery}
              placeholder="Search apps…"
              placeholderTextColor={colors.textTertiary}
            />
            <ScrollView style={styles.appPickerList} showsVerticalScrollIndicator={false}>
              {filteredApps.length === 0 ? (
                <Text style={styles.appPickerEmpty}>No apps found.</Text>
              ) : (
                filteredApps.map((app) => {
                  const selected = blacklistPackages.includes(app.packageName);
                  return (
                    <Pressable
                      key={app.packageName}
                      style={[styles.appPickerRow, selected && styles.appPickerRowSelected]}
                      onPress={() => toggleBlacklistPackage(app.packageName)}
                    >
                      <View style={styles.appPickerRowInfo}>
                        <Text style={styles.appPickerRowLabel}>{app.label}</Text>
                        <Text style={styles.appPickerRowSub}>{app.packageName}</Text>
                        {isCommunicationApp(app.packageName) && (
                          <Text style={styles.appPickerRowCallout}>📞 Calls allowed</Text>
                        )}
                      </View>
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Text style={styles.checkboxIcon}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
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
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  presetBtnText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  hintText: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  hintValue: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  switchSublabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  selectAppsBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
  },
  selectAppsBtnText: {
    ...typography.button,
    color: colors.accent,
  },
  selectedAppsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  appPill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    maxWidth: 140,
  },
  appPillText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '500',
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  deleteBtnText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '500',
  },
  saveBtn: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    ...shadows.md,
  },
  saveBtnText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 17,
  },
  appPickerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  appPickerDialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
    ...shadows.lg,
  },
  appPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appPickerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  appPickerDone: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  appPickerSearch: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  appPickerList: {
    maxHeight: 400,
  },
  appPickerEmpty: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  appPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  appPickerRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  appPickerRowInfo: {
    flex: 1,
  },
  appPickerRowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  appPickerRowSub: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  appPickerRowCallout: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxIcon: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
});
