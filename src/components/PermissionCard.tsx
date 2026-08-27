import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Avatar, Button, Card, useTheme } from 'react-native-paper';
import { spacing } from '../theme';

interface PermissionCardProps {
  onGrant: () => void;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({ onGrant }) => {
  const theme = useTheme();

  return (
    <Card mode="outlined" style={styles.container}>
      <Card.Content>
        <Avatar.Icon
          icon="shield-check-outline"
          size={48}
          color={theme.colors.onTertiaryContainer}
          style={{ backgroundColor: theme.colors.tertiaryContainer }}
        />
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>Enable app blocking</Text>
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          FocusGuard needs Accessibility permission to bring itself to the foreground when you
          open a blacklisted app during a focus session.
        </Text>
        <Button mode="contained" icon="open-in-new" onPress={onGrant} style={styles.button}>
          Grant permission
        </Button>
        <Text style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          Android Accessibility settings will open. Enable FocusGuard under Downloaded apps.
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 3,
    backgroundColor: '#FFF8E1',
    borderColor: '#806A00',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  button: {
    marginBottom: spacing.md,
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
  },
});
