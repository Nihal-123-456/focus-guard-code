import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';

interface UsageAccessCardProps {
  onGrant: () => void;
}

/**
 * Permission card prompting the user to grant Usage Access.
 * Shown on the Home screen when the permission is not granted.
 *
 * Usage Access is required for reliable foreground-app detection
 * via UsageStatsManager. Without it, blocking will silently fail.
 */
export const UsageAccessCard: React.FC<UsageAccessCardProps> = ({ onGrant }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>📊</Text>
      </View>
      <Text style={styles.title}>Grant Usage Access</Text>
      <Text style={styles.description}>
        FocusGuard needs Usage Access to reliably detect which app is in the
        foreground. Without this permission, blocking may not work — you'll
        still be able to open blacklisted apps during a focus session.
      </Text>
      <Pressable style={styles.button} onPress={onGrant}>
        <Text style={styles.buttonText}>Open usage access settings</Text>
      </Pressable>
      <Text style={styles.note}>
        In Android Settings, find FocusGuard in the list and toggle it on.
        The card will disappear once permission is granted.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: {
    ...typography.button,
    color: colors.textInverse,
  },
  note: {
    ...typography.caption,
    color: colors.textTertiary,
    lineHeight: 16,
  },
});
