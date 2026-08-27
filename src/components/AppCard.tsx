import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Avatar, Card, Chip, Switch, useTheme } from 'react-native-paper';
import { colors, typography, spacing, radius } from '../theme';

interface AppCardProps {
  label: string;
  packageName: string;
  isBlacklisted: boolean;
  isLocked?: boolean;
  isCommunicationApp?: boolean;
  onToggle?: () => void;
  style?: ViewStyle;
}

export const AppCard: React.FC<AppCardProps> = ({
  label,
  packageName,
  isBlacklisted,
  isLocked = false,
  isCommunicationApp = false,
  onToggle,
  style,
}) => {
  const theme = useTheme();

  return (
    <Card
      mode="outlined"
      style={[styles.container, isBlacklisted && styles.containerActive, style]}
    >
      <Card.Content style={styles.content}>
        <Avatar.Text
          size={44}
          label={label.charAt(0).toUpperCase()}
          color={theme.colors.onPrimaryContainer}
          style={styles.appIcon}
        />

        <View style={styles.info}>
          <View style={styles.labelRow}>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
            {isCommunicationApp && <Chip compact style={styles.callBadge}>Calls</Chip>}
          </View>
          <Text style={styles.packageName} numberOfLines={1}>{packageName}</Text>
        </View>

        <Switch
          value={isBlacklisted}
          onValueChange={onToggle}
        disabled={isLocked}
          accessibilityLabel={`Block ${label}`}
        />
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  containerActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  appIcon: {
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
    marginRight: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },
  packageName: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  callBadge: {
    marginVertical: 0,
  },
});
