import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';

interface OverlayPermissionCardProps {
  onGrant: () => void;
}

/**
 * Permission card prompting the user to grant "Display over other apps"
 * (SYSTEM_ALERT_WINDOW) permission.
 *
 * Required on Android 10+ for the accessibility service to bring the blocking
 * overlay to the FOREGROUND when a blacklisted app is opened. Without it,
 * the overlay gets created in a background task and never appears over the
 * blocked app.
 */
export const OverlayPermissionCard: React.FC<OverlayPermissionCardProps> = ({ onGrant }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🪟</Text>
      </View>
      <Text style={styles.title}>Allow display over other apps</Text>
      <Text style={styles.description}>
        FocusGuard needs "Display over other apps" permission so the blocking
        screen can appear over YouTube, Chrome, or any blacklisted app when you
        try to open it. Without this permission, blocking will silently fail.
      </Text>
      <Pressable style={styles.button} onPress={onGrant}>
        <Text style={styles.buttonText}>Open display settings</Text>
      </Pressable>
      <Text style={styles.note}>
        In Android Settings, find FocusGuard and toggle "Allow display over
        other apps" to ON. The card will disappear once permission is granted.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
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
