import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HardDrives, Battery } from 'phosphor-react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  storageFreeGb: number;
  storagePct: number;
  batteryVoltage: number | null;
  batterySoc: number | null;
  storageWarning?: boolean;
}

export function StatusStrip({ storageFreeGb, storagePct, batteryVoltage, batterySoc, storageWarning }: Props) {
  const storageColor = storageWarning ? colors.danger : colors.textSecondary;
  const storageRemaining = Math.round(100 - storagePct);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <HardDrives size={14} color={storageColor} weight="duotone" />
        <Text style={[styles.text, { color: storageColor }, glowStyle]}>
          {storageFreeGb.toFixed(1)}GB {storageRemaining}%
        </Text>
      </View>
      <View style={styles.right}>
        {batteryVoltage != null && (
          <Text style={[styles.text, glowStyle]}>{batteryVoltage.toFixed(1)}V</Text>
        )}
        <Battery size={14} color={colors.textSecondary} weight="duotone" />
        <Text style={[styles.text, glowStyle]}>
          {batterySoc != null ? `${Math.round(batterySoc)}%` : '--'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: {
    fontFamily: PIXEL_FONT,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});
