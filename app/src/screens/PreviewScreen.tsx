import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePreview } from '../hooks/usePreview';
import { useCaptureNow } from '../hooks/useCapture';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { colors, spacing, typography } from '../theme';

const ISO_VALUES = [100, 200, 400, 800, 1600];
const AWB_MODES = ['auto', 'daylight', 'cloudy', 'tungsten', 'fluorescent'];
const EXPOSURE_MODES = ['auto', 'manual'];

export function PreviewScreen() {
  const isFocused = useIsFocused();
  const imageUri = usePreview(isFocused);
  const captureNow = useCaptureNow();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const camera = (settings as any)?.camera || { iso: 100, exposure_mode: 'auto', awb_mode: 'auto' };

  const updateCamera = (key: string, value: unknown) => {
    updateSettings.mutate({ camera: { [key]: value } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.previewContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.placeholderText}>Starting preview...</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>ISO</Text>
          <View style={styles.chipRow}>
            {ISO_VALUES.map(iso => (
              <TouchableOpacity
                key={iso}
                style={[styles.chip, camera.iso === iso && styles.chipActive]}
                onPress={() => updateCamera('iso', iso)}
              >
                <Text style={[styles.chipText, camera.iso === iso && styles.chipTextActive]}>{iso}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>EXPOSURE</Text>
          <View style={styles.chipRow}>
            {EXPOSURE_MODES.map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, camera.exposure_mode === mode && styles.chipActive]}
                onPress={() => updateCamera('exposure_mode', mode)}
              >
                <Text style={[styles.chipText, camera.exposure_mode === mode && styles.chipTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>WHITE BALANCE</Text>
          <View style={styles.chipRow}>
            {AWB_MODES.map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, camera.awb_mode === mode && styles.chipActive]}
                onPress={() => updateCamera('awb_mode', mode)}
              >
                <Text style={[styles.chipText, camera.awb_mode === mode && styles.chipTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.captureButton}
          onPress={() => captureNow.mutate()}
          disabled={captureNow.isPending}
        >
          <Text style={styles.captureButtonText}>
            {captureNow.isPending ? 'Capturing...' : 'Capture Still'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  previewContainer: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#000' },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: colors.textMuted },
  controls: { flex: 1 },
  controlsContent: { padding: spacing.lg },
  controlRow: { marginBottom: spacing.lg },
  controlLabel: { ...typography.label, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  captureButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', marginTop: spacing.md },
  captureButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
