import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { spacing } from '../theme';

interface DurationPickerProps {
  value: number; // minutes
  onChange: (minutes: number) => void;
}

const PRESETS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: '6 hours', minutes: 360 },
  { label: '8 hours', minutes: 480 },
  { label: '10 hours', minutes: 600 },
];

export const DurationPicker: React.FC<DurationPickerProps> = ({ value, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customHours, setCustomHours] = useState('1');
  const [customMinutes, setCustomMinutes] = useState('0');

  const isPreset = PRESETS.some((p) => p.minutes === value);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {PRESETS.map((preset) => {
          const selected = preset.minutes === value;
          return (
            <Button
              key={preset.minutes}
              mode={selected ? 'contained' : 'outlined'}
              onPress={() => onChange(preset.minutes)}
              compact
            >
              {preset.label}
            </Button>
          );
        })}

        <Button
          mode={!isPreset ? 'contained' : 'outlined'}
          onPress={() => setShowCustom(true)}
          compact
        >
          Custom...
        </Button>
      </View>

      <Portal>
      <Dialog
        visible={showCustom}
        onDismiss={() => setShowCustom(false)}
      >
          <Dialog.Title>Custom duration</Dialog.Title>
          <Dialog.Content>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <TextInput
                  label="Hours"
                  value={customHours}
                  onChangeText={setCustomHours}
                  keyboardType="numeric"
                  mode="outlined"
                />
              </View>
              <View style={styles.inputGroup}>
                <TextInput
                  label="Minutes"
                  value={customMinutes}
                  onChangeText={setCustomMinutes}
                  keyboardType="numeric"
                  mode="outlined"
                />
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCustom(false)}>Cancel</Button>
            <Button onPress={() => {
              const h = parseInt(customHours || '0', 10) || 0;
              const m = parseInt(customMinutes || '0', 10) || 0;
              const total = h * 60 + m;
              if (total >= 1) onChange(total);
              setShowCustom(false);
            }}>Set</Button>
          </Dialog.Actions>
      </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    flex: 1,
  },
});
