import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { colors, typography, spacing, radius } from '../theme';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: keyof typeof colors;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  accent = 'accent',
}) => {
  const theme = useTheme();
  const accentColor = colors[accent] as string;

  return (
    <Card mode="outlined" style={styles.container}>
      <Card.Content>
        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
        {sublabel && <Text style={[styles.sublabel, { color: theme.colors.onSurfaceVariant }]}>{sublabel}</Text>}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: radius.md,
    marginHorizontal: 3,
  },
  label: {
    ...typography.label,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.h1,
    color: colors.accent,
    fontSize: 32,
    fontWeight: '600',
  },
  sublabel: {
    ...typography.caption,
    marginTop: 2,
  },
});
