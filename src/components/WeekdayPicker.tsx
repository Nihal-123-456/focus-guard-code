import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import { DAY_LABELS_SHORT } from '../data/scheduleStore';

interface WeekdayPickerProps {
  value: number[]; // 0-6
  onChange: (days: number[]) => void;
}

export const WeekdayPicker: React.FC<WeekdayPickerProps> = ({ value, onChange }) => {
  const toggle = (day: number) => {
    const set = new Set(value);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    onChange(Array.from(set).sort((a, b) => a - b));
  };

  return (
    <View style={styles.container}>
      {DAY_LABELS_SHORT.map((label, day) => {
        const selected = value.includes(day);
        return (
          <Pressable
            key={day}
            style={[
              styles.day,
              selected && styles.daySelected,
            ]}
            onPress={() => toggle(day)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={DAY_LABELS_SHORT[day]}
          >
            <Text
              style={[
                styles.dayLabel,
                selected && styles.dayLabelSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dayLabelSelected: {
    color: colors.textInverse,
  },
});
