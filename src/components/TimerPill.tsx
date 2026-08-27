import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, ProgressBar, useTheme } from 'react-native-paper';
import { typography, spacing, radius } from '../theme';
import { formatRemaining } from '../utils/time';

interface TimerPillProps {
  remainingMs: number;
  totalMs: number;
}

export const TimerPill: React.FC<TimerPillProps> = ({ remainingMs, totalMs }) => {
  const theme = useTheme();
  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const progressPct = Math.round(progress * 100);

  return (
    <Card mode="outlined" style={styles.container}>
      <Card.Content>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
        <Text style={styles.label}>Focus session</Text>
        <Text style={styles.time}>{formatRemaining(remainingMs)} left</Text>
      </View>
      <ProgressBar progress={progressPct / 100} color={theme.colors.primary} />
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.label,
    color: '#414944',
    fontSize: 11,
  },
  time: {
    ...typography.bodySmall,
    color: '#191C1A',
    marginLeft: 'auto',
    fontWeight: '500',
  },
});
