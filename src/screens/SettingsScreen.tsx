import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography, spacing, radius, shadows } from '../theme';
import { useSettingsStore } from '../data/settingsStore';
import { AppBlocker } from '../native/AppBlocker';
import { isMockMode } from '../data/appListStore';

export function SettingsScreen() {
  const settings = useSettingsStore();
  const [accessibilityEnabled, setAccessibilityEnabled] = useState<boolean | null>(null);
  const [blockerStatus, setBlockerStatus] = useState<{
    isBlockingActive: boolean;
  } | null>(null);

  const refreshStatus = useCallback(async () => {
    const enabled = await AppBlocker.isAccessibilityEnabled();
    setAccessibilityEnabled(enabled);
    try {
      const status = await AppBlocker.getStatus();
      setBlockerStatus({ isBlockingActive: status.isBlockingActive });
    } catch {
      setBlockerStatus({ isBlockingActive: false });
    }
  }, []);

  useEffect(() => {
    if (!settings.loaded) settings.hydrate();
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Accessibility permission status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accessibility permission</Text>
          <Text style={styles.cardDesc}>
            Required for FocusGuard to block apps during focus sessions.
          </Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Service status</Text>
            <View
              style={[
                styles.statusBadge,
                accessibilityEnabled
                  ? styles.statusBadgeOn
                  : styles.statusBadgeOff,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  accessibilityEnabled
                    ? styles.statusBadgeTextOn
                    : styles.statusBadgeTextOff,
                ]}
              >
                {accessibilityEnabled === null
                  ? 'Checking…'
                  : accessibilityEnabled
                    ? 'Enabled'
                    : 'Disabled'}
              </Text>
            </View>
          </View>

          {blockerStatus && (
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Blocking active</Text>
              <Text style={styles.statusValue}>
                {blockerStatus.isBlockingActive ? 'Yes' : 'No'}
              </Text>
            </View>
          )}

          <Pressable
            style={styles.cardButton}
            onPress={() => AppBlocker.openAccessibilitySettings()}
          >
            <Text style={styles.cardButtonText}>Open accessibility settings</Text>
          </Pressable>

          <Pressable style={styles.cardLink} onPress={refreshStatus}>
            <Text style={styles.cardLinkText}>Refresh status</Text>
          </Pressable>
        </View>

        {/* Call passthrough */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Call passthrough</Text>
          <Text style={styles.cardDesc}>
            Allow incoming calls on Phone, WhatsApp, imo, and Messenger to ring
            and be answered during a focus session.
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable call passthrough</Text>
            <Switch
              value={settings.callPassthroughEnabled}
              onValueChange={(v) => settings.update({ callPassthroughEnabled: v })}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        {/* Show system apps */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App list</Text>
          <Text style={styles.cardDesc}>
            Include system apps (Settings, Phone, Clock, etc.) in the app list.
            Most users don't need to block these.
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Show system apps</Text>
            <Switch
              value={settings.showSystemApps}
              onValueChange={(v) => settings.update({ showSystemApps: v })}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        {/* Schedules auto-start */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Scheduled sessions</Text>
          <Text style={styles.cardDesc}>
            When enabled, schedules on the Schedules tab will automatically start
            focus sessions when their time window opens. Disable to keep schedules
            as reminders only.
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Auto-start scheduled sessions</Text>
            <Switch
              value={settings.schedulesAutoStart}
              onValueChange={(v) => settings.update({ schedulesAutoStart: v })}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        {/* Default duration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default session duration</Text>
          <Text style={styles.cardDesc}>
            The default duration when you start a new focus session.
          </Text>
          <View style={styles.durationRow}>
            {[15, 30, 60, 120, 240, 480].map((min) => (
              <Pressable
                key={min}
                style={[
                  styles.durationBtn,
                  settings.defaultDurationMin === min && styles.durationBtnActive,
                ]}
                onPress={() => settings.update({ defaultDurationMin: min })}
              >
                <Text
                  style={[
                    styles.durationBtnText,
                    settings.defaultDurationMin === min &&
                      styles.durationBtnTextActive,
                  ]}
                >
                  {min >= 60 ? `${min / 60}h` : `${min}m`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Dangerous mode */}
        <View style={styles.cardDanger}>
          <Text style={styles.cardTitleDanger}>Dangerous mode</Text>
          <Text style={styles.cardDescDanger}>
            Show a confirmation warning when you try to uninstall FocusGuard
            while a session is active. (Soft warning only — for true anti-uninstall,
            set up Device Owner mode via ADB.)
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable dangerous mode</Text>
            <Switch
              value={settings.dangerousModeEnabled}
              onValueChange={(v) => settings.update({ dangerousModeEnabled: v })}
              trackColor={{ false: colors.border, true: colors.danger }}
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About FocusGuard</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>
            FocusGuard helps you stay focused by blocking distracting apps during
            timed focus sessions. The app is fully offline — your blacklist and
            session history never leave your device.
          </Text>
          {isMockMode() && (
            <Text style={styles.aboutMock}>
              ⚠️ Currently running in mock mode (no native modules available).
              Build with `expo run:android` for full functionality.
            </Text>
          )}
          <Pressable
            style={styles.aboutLink}
            onPress={() => {
              Alert.alert(
                'Reset all data',
                'This will erase your blacklist, session history, and settings. This cannot be undone.',
                [
                  { text: 'Cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                      const { AsyncStorage } = await import(
                        '@react-native-async-storage/async-storage'
                      );
                      const keys = await AsyncStorage.getAllKeys();
                      const our = keys.filter((k) => k.startsWith('@focusguard:'));
                      await AsyncStorage.multiRemove(our as string[]);
                      Alert.alert('Done', 'All data erased. Restart the app.');
                    },
                  },
                ],
              );
            }}
          >
            <Text style={styles.aboutLinkText}>Erase all data</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDanger: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardTitleDanger: {
    ...typography.h3,
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  cardDescDanger: {
    ...typography.bodySmall,
    color: colors.danger,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  statusValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusBadgeOn: {
    backgroundColor: colors.accentSoft,
  },
  statusBadgeOff: {
    backgroundColor: colors.dangerSoft,
  },
  statusBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  statusBadgeTextOn: {
    color: colors.accent,
  },
  statusBadgeTextOff: {
    color: colors.danger,
  },
  cardButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cardButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
  cardLink: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  cardLinkText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  switchLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  durationBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  durationBtnActive: {
    backgroundColor: colors.accent,
  },
  durationBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  durationBtnTextActive: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aboutTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  aboutVersion: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  aboutText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  aboutMock: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  aboutLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  aboutLinkText: {
    ...typography.bodySmall,
    color: colors.danger,
    fontWeight: '500',
  },
});
