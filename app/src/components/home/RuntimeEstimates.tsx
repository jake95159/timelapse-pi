import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  bypassHours: number | null;
  bypassFrames: number | null;
  autoHours: number | null;
  autoFrames: number | null;
  bypassStorageLimited: boolean;
  autoStorageLimited: boolean;
}

export function RuntimeEstimates({
  bypassHours, bypassFrames,
  autoHours, autoFrames,
  bypassStorageLimited, autoStorageLimited,
}: Props) {
  const bypassColor = bypassStorageLimited ? colors.danger : colors.textSecondary;
  const autoColor = autoStorageLimited ? colors.danger : colors.textSecondary;

  const formatHours = (h: number | null) => h != null ? `${Math.round(h)}h` : '--';
  const formatFrames = (f: number | null) => {
    if (f == null) return '--';
    return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : String(f);
  };

  return (
    <View style={styles.container}>
      <View style={styles.column}>
        <Text style={styles.modeLabel}>BYPASS</Text>
        <Text style={[styles.value, { color: bypassColor }, glowStyle]}>
          {formatHours(bypassHours)} · {formatFrames(bypassFrames)} frames
        </Text>
      </View>
      <View style={styles.column}>
        <Text style={[styles.modeLabel, { textAlign: 'right' }]}>AUTO</Text>
        <Text style={[styles.value, { color: autoColor, textAlign: 'right' }, glowStyle]}>
          {formatHours(autoHours)} · {formatFrames(autoFrames)} frames
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  column: { flex: 1 },
  modeLabel: {
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    color: colors.textDim,
    letterSpacing: 1,
  },
  value: {
    fontFamily: PIXEL_FONT,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
