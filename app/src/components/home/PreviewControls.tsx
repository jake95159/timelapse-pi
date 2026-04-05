import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, VideoCamera } from 'phosphor-react-native';
import { colors, spacing, PIXEL_FONT } from '../../theme';

interface Props {
  livePreview: boolean;
  onToggleLive: () => void;
  onSnap: () => void;
  disabled?: boolean;
}

export function PreviewControls({ livePreview, onToggleLive, onSnap, disabled }: Props) {
  const disabledOpacity = disabled ? 0.3 : 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, { opacity: disabledOpacity }]}
        onPress={onSnap}
        disabled={disabled}
      >
        <View style={styles.circle}>
          <Camera size={20} color={colors.text} weight="duotone" />
        </View>
        <Text style={styles.label}>SNAP</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { opacity: disabledOpacity }]}
        onPress={onToggleLive}
        disabled={disabled}
      >
        <View style={[styles.circle, livePreview && styles.circleActive]}>
          <VideoCamera size={20} color={livePreview ? colors.success : colors.text} weight="duotone" />
        </View>
        <Text style={[styles.label, livePreview && { color: colors.success }]}>LIVE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: spacing.sm,
  },
  button: { alignItems: 'center', gap: 4 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActive: { borderColor: colors.success },
  label: {
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    color: colors.textDim,
    letterSpacing: 1,
  },
});
