import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

interface StreakBadgeProps {
  current: number;
  longest: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ current, longest }) => {
  const hasStreak = current > 0;

  return (
    <View
      style={[
        styles.container,
        hasStreak ? styles.containerActive : styles.containerIdle,
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{hasStreak ? '🔥' : '🌙'}</Text>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>
          {hasStreak ? `${current}-day streak` : 'No active streak'}
        </Text>
        <Text style={styles.sub}>
          {hasStreak
            ? `Longest: ${longest} ${longest === 1 ? 'day' : 'days'}`
            : 'Complete a session today to start one'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
  },
  containerActive: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  containerIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  sub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
