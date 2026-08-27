import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

interface BarDatum {
  label: string;
  value: number;
  /** Optional secondary label below the bar (e.g. formatted duration). */
  sublabel?: string;
}

interface BarChartProps {
  data: BarDatum[];
  /** Maximum value for scaling. If not provided, computed from data. */
  max?: number;
  /** Format the value for the tooltip below the bar (e.g. ms → "2h"). */
  formatValue?: (v: number) => string;
  /** Bar color */
  color?: string;
  /** Height of the chart area in px (excluding labels). */
  height?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export const BarChart: React.FC<BarChartProps> = ({
  data,
  max,
  formatValue = (v) => v.toString(),
  color = colors.accent,
  height = 100,
}) => {
  const computedMax = max ?? Math.max(...data.map((d) => d.value), 1);
  const barCount = data.length;
  const barGap = spacing.xs;
  const containerPadding = spacing.md;
  const availableWidth = SCREEN_WIDTH - containerPadding * 2 - barGap * (barCount - 1);
  const barWidth = Math.max(8, Math.min(40, availableWidth / barCount));

  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height }]}>
        {data.map((d, i) => {
          const heightPct = computedMax > 0 ? (d.value / computedMax) * 100 : 0;
          const minVisible = d.value > 0 ? 4 : 0;
          return (
            <View key={i} style={styles.barWrap}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.max(minVisible, heightPct)}%`,
                      backgroundColor: color,
                      width: barWidth,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((d, i) => (
          <View key={i} style={styles.labelWrap}>
            <Text style={styles.label} numberOfLines={1}>
              {d.label}
            </Text>
            {d.sublabel && (
              <Text style={styles.sublabel} numberOfLines={1}>
                {d.value > 0 ? d.sublabel : ''}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barFill: {
    borderRadius: radius.sm,
    minHeight: 2,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  labelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 4,
  },
  sublabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '500',
  },
});
