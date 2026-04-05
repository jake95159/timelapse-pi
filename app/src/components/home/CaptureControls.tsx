import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, Stop } from 'phosphor-react-native';
import { colors, spacing, recordGlowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  isRecording: boolean;
  onCapture: () => void;
  onRecord: () => void;
  onStop: () => void;
  captureDisabled?: boolean;
}

export function CaptureControls({ isRecording, onCapture, onRecord, onStop, captureDisabled }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.buttonWrap, (isRecording || captureDisabled) && styles.disabled]}
        onPress={onCapture}
        disabled={isRecording || captureDisabled}
      >
        <View style={styles.captureCircle}>
          <Camera size={22} color={colors.text} weight="duotone" />
        </View>
        <Text style={styles.label}>CAPTURE</Text>
      </TouchableOpacity>

      {isRecording ? (
        <TouchableOpacity style={styles.buttonWrap} onPress={onStop}>
          <View style={styles.stopCircle}>
            <Stop size={22} color={colors.text} weight="duotone" />
          </View>
          <Text style={[styles.label, { color: colors.textMuted }]}>STOP</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.buttonWrap} onPress={onRecord}>
          <View style={[styles.recordCircle, recordGlowStyle]}>
            <View style={styles.recordDot} />
          </View>
          <Text style={[styles.label, { color: colors.record }]}>{'\u25CF'} REC</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  buttonWrap: { alignItems: 'center', gap: 4 },
  disabled: { opacity: 0.3 },
  captureCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.record,
    backgroundColor: colors.recordBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.record,
  },
  stopCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.textMuted,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
});
