import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Chip, Switch, useTheme } from 'react-native-paper';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { DAY_LABELS } from '../data/scheduleStore';
import type { PresetSchedule, ScheduleNextFire } from '../types';
import { formatTimeLabel } from './TimeRangePicker';
import { formatRelativeUntil } from '../utils/time';

interface ScheduleCardProps {
  schedule: PresetSchedule;
  nextFire: ScheduleNextFire | null;
  onToggle: () => void;
  onPress: () => void;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  nextFire,
  onToggle,
  onPress,
}) => {
  const theme = useTheme();
  const isCurrentlyActive = nextFire?.isCurrentlyActive ?? false;
  const days = schedule.daysOfWeek.length === 7
    ? 'Every day'
    : schedule.daysOfWeek.length === 5 &&
      [1, 2, 3, 4, 5].every((d) => schedule.daysOfWeek.includes(d))
      ? 'Weekdays'
      : schedule.daysOfWeek.length === 2 &&
        [0, 6].every((d) => schedule.daysOfWeek.includes(d))
        ? 'Weekends'
        : schedule.daysOfWeek.length === 0
          ? 'No days selected'
          : schedule.daysOfWeek
              .slice()
              .sort((a, b) => a - b)
              .map((d) => DAY_LABELS[d])
              .join(', ');

  return (
    <Card
      mode="outlined"
      onPress={onPress}
      style={[
        styles.container,
        !schedule.enabled && styles.containerDisabled,
        isCurrentlyActive && styles.containerActive,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {schedule.name}
          </Text>
          {isCurrentlyActive && (
            <Chip compact icon="play-circle" textStyle={{ color: theme.colors.onPrimaryContainer }} style={{ backgroundColor: theme.colors.primaryContainer }}>
              Running
            </Chip>
          )}
        </View>
        <Switch
          value={schedule.enabled}
          onValueChange={onToggle}
        />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeValue}>
          {formatTimeLabel(schedule.startHour, schedule.startMinute)}
        </Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={styles.timeValue}>
          {formatTimeLabel(schedule.endHour, schedule.endMinute)}
        </Text>
        {schedule.endHour < schedule.startHour ||
        (schedule.endHour === schedule.startHour &&
          schedule.endMinute <= schedule.startMinute) ? (
            <Chip compact icon="weather-night" style={styles.overnightPill}>Next day</Chip>
        ) : null}
      </View>

      <Text style={styles.days}>{days}</Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {schedule.blacklist.length > 0
            ? `${schedule.blacklist.length} ${schedule.blacklist.length === 1 ? 'app' : 'apps'} blocked`
            : 'Uses main blacklist'}
        </Text>
        {schedule.enabled && nextFire?.nextFireAt && !isCurrentlyActive && (
          <Text style={styles.nextFire}>
            Next: {formatRelativeUntil(nextFire.nextFireAt)}
          </Text>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  containerActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textInverse,
  },
  activePillText: {
    ...typography.caption,
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  timeValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 18,
    color: colors.textTertiary,
  },
  overnightPill: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  overnightPillText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  days: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  nextFire: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '500',
  },
});
