import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';

interface TimeRangePickerProps {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  onChange: (range: {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }) => void;
}

/** Format an hour:minute as "9:30 AM", "11:00 PM", etc. */
export function formatTimeLabel(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  let displayHour = hour % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

interface TimePickerModalProps {
  visible: boolean;
  title: string;
  initialHour: number;
  initialMinute: number;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  title,
  initialHour,
  initialMinute,
  onClose,
  onConfirm,
}) => {
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{title}</Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {Array.from({ length: 24 }, (_, h) => (
                  <Pressable
                    key={h}
                    style={[styles.pickerItem, h === hour && styles.pickerItemSelected]}
                    onPress={() => setHour(h)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        h === hour && styles.pickerItemTextSelected,
                      ]}
                    >
                      {h.toString().padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Minute</Text>
              <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                {[0, 15, 30, 45].map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.pickerItem, m === minute && styles.pickerItemSelected]}
                    onPress={() => setMinute(m)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        m === minute && styles.pickerItemTextSelected,
                      ]}
                    >
                      {m.toString().padStart(2, '0')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.previewColumn}>
              <Text style={styles.pickerLabel}>Preview</Text>
              <Text style={styles.previewTime}>
                {formatTimeLabel(hour, minute)}
              </Text>
            </View>
          </View>

          <View style={styles.dialogActions}>
            <Pressable style={styles.dialogBtn} onPress={onClose}>
              <Text style={styles.dialogBtnTextSecondary}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.dialogBtn, styles.dialogBtnPrimary]}
              onPress={() => {
                onConfirm(hour, minute);
                onClose();
              }}
            >
              <Text style={styles.dialogBtnTextPrimary}>Set</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  startHour,
  startMinute,
  endHour,
  endMinute,
  onChange,
}) => {
  const [modal, setModal] = useState<null | 'start' | 'end'>(null);

  const isOvernight =
    endHour < startHour || (endHour === startHour && endMinute <= startMinute);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.timeBtn}
        onPress={() => setModal('start')}
      >
        <Text style={styles.timeBtnLabel}>Start</Text>
        <Text style={styles.timeBtnValue}>
          {formatTimeLabel(startHour, startMinute)}
        </Text>
      </Pressable>

      <Text style={styles.arrow}>→</Text>

      <Pressable
        style={styles.timeBtn}
        onPress={() => setModal('end')}
      >
        <Text style={styles.timeBtnLabel}>End</Text>
        <Text style={styles.timeBtnValue}>
          {formatTimeLabel(endHour, endMinute)}
        </Text>
      </Pressable>

      {isOvernight && (
        <View style={styles.overnightPill}>
          <Text style={styles.overnightPillText}>Next day</Text>
        </View>
      )}

      <TimePickerModal
        visible={modal === 'start'}
        title="Start time"
        initialHour={startHour}
        initialMinute={startMinute}
        onClose={() => setModal(null)}
        onConfirm={(h, m) => onChange({
          startHour: h,
          startMinute: m,
          endHour,
          endMinute,
        })}
      />

      <TimePickerModal
        visible={modal === 'end'}
        title="End time"
        initialHour={endHour}
        initialMinute={endMinute}
        onClose={() => setModal(null)}
        onConfirm={(h, m) => onChange({
          startHour,
          startMinute,
          endHour: h,
          endMinute: m,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  timeBtn: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeBtnLabel: {
    ...typography.label,
    color: colors.textTertiary,
    fontSize: 10,
    marginBottom: 2,
  },
  timeBtnValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  arrow: {
    fontSize: 20,
    color: colors.textTertiary,
  },
  overnightPill: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  overnightPillText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    ...shadows.lg,
  },
  dialogTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pickerColumn: {
    flex: 1,
  },
  previewColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerLabel: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 10,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  pickerScroll: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  pickerItem: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: colors.accent,
  },
  pickerItemText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  pickerItemTextSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  previewTime: {
    ...typography.h2,
    color: colors.accent,
    fontSize: 22,
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dialogBtnPrimary: {
    backgroundColor: colors.accent,
  },
  dialogBtnTextSecondary: {
    ...typography.button,
    color: colors.textSecondary,
  },
  dialogBtnTextPrimary: {
    ...typography.button,
    color: colors.textInverse,
  },
});
