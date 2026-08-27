import React, { useState, useEffect, useCallback } from 'react';
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

import { colors, typography, spacing, radius, shadows } from '../theme';
import { useBlacklistStore } from '../data/blacklistStore';
import { useTimerStore } from '../data/timerStore';
import { useSettingsStore } from '../data/settingsStore';
import { AppBlocker } from '../native/AppBlocker';
import { DurationPicker } from '../components/DurationPicker';
import { formatDurationHuman, formatTime } from '../utils/time';

export function TimerSetupScreen() {
  const navigation = useNavigation();
  const blacklist = useBlacklistStore();
  const timer = useTimerStore();
  const settings = useSettingsStore();
  const [duration, setDuration] = useState(settings.defaultDurationMin);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!settings.loaded) settings.hydrate();
    if (!blacklist.loaded) blacklist.hydrate();
    AppBlocker.isAccessibilityEnabled().then(setAccessibilityEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endTime = Date.now() + duration * 60 * 1000;

  const handleStart = useCallback(async () => {
    if (blacklist.entries.length === 0) {
      Alert.alert('No apps blacklisted', 'Add at least one app to your blacklist first.');
      return;
    }
    if (!accessibilityEnabled) {
      Alert.alert(
        'Enable Accessibility',
        'FocusGuard needs the Accessibility permission to block apps. Open settings now?',
        [
          { text: 'Cancel' },
          { text: 'Open settings', onPress: () => AppBlocker.openAccessibilitySettings() },
        ],
      );
      return;
    }
    setStarting(true);
    try {
      await timer.startSession(duration);
      // Navigate to ActiveTimer — replace current screen.
      navigation.reset({
        index: 0,
        routes: [{ name: 'ActiveTimer' }],
      });
    } catch (e: any) {
      Alert.alert('Failed to start session', e?.message ?? String(e));
    } finally {
      setStarting(false);
    }
  }, [blacklist.entries.length, accessibilityEnabled, duration, navigation, timer]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <Text style={styles.eyebrow}>New session</Text>
          <Text style={styles.title}>Start a focus session</Text>
          <Text style={styles.description}>
            During this session, you won't be able to open blacklisted apps. The
            blacklist will be locked — you can't remove apps until the timer ends.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Duration</Text>
          <DurationPicker value={duration} onChange={setDuration} />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Duration</Text>
            <Text style={styles.summaryVal}>{formatDurationHuman(duration * 60 * 1000)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Apps blocked</Text>
            <Text style={styles.summaryVal}>{blacklist.entries.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Start time</Text>
            <Text style={styles.summaryVal}>{formatTime(Date.now())}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>End time</Text>
            <Text style={styles.summaryVal}>{formatTime(endTime)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Lock</Text>
            <Text style={[styles.summaryVal, { color: colors.danger }]}>
              Hard (no stop / no edit)
            </Text>
          </View>
        </View>

        <View style={styles.calloutCard}>
          <Text style={styles.calloutIcon}>📞</Text>
          <Text style={styles.calloutText}>
            Incoming calls (Phone, WhatsApp, imo, Messenger) will still come
            through and you'll be able to answer them.
          </Text>
        </View>

        <Pressable
          style={[styles.ctaButton, starting && styles.ctaButtonDisabled]}
          onPress={handleStart}
          disabled={starting || blacklist.entries.length === 0}
        >
          <Text style={styles.ctaButtonText}>
            {starting ? 'Starting…' : 'Start session'}
          </Text>
        </Pressable>

        {blacklist.entries.length === 0 && (
          <Text style={styles.errorText}>
            You need to add at least one app to your blacklist before starting.
          </Text>
        )}
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
  backBtn: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 11,
    marginBottom: 4,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryKey: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  summaryVal: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  calloutIcon: {
    fontSize: 20,
  },
  calloutText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    ...typography.button,
    color: colors.textInverse,
    fontSize: 17,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
  },
});
