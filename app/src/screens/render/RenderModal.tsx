import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { renderTimelapse, saveToPhotos, RenderProgress } from '../../services/renderer';
import { getLocalBatchImages } from '../../services/storage';
import { colors, spacing, typography, PIXEL_FONT } from '../../theme';

interface Props {
  batchPath: string;
  batchName: string;
  imageCount: number;
  onClose: () => void;
}

export function RenderModal({ batchPath, batchName, imageCount, onClose }: Props) {
  const [fps, setFps] = useState(24);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  const estimatedDuration = imageCount / fps;
  const resolution = { width: 1920, height: 1440 }; // 4:3 aspect

  const handleRender = async () => {
    setRendering(true);
    try {
      const images = await getLocalBatchImages(batchPath);
      if (images.length === 0) {
        Alert.alert('No Images', 'Download images to your phone first');
        setRendering(false);
        return;
      }
      const path = await renderTimelapse(images, { fps, ...resolution }, setProgress);
      setOutputPath(path);
    } catch (e: any) {
      Alert.alert('Render Failed', e.message);
    } finally {
      setRendering(false);
    }
  };

  const handleSave = async () => {
    if (!outputPath) return;
    try {
      await saveToPhotos(outputPath);
      Alert.alert('Saved', 'Timelapse video saved to Photos');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Render Timelapse</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.batchName}>{batchName}</Text>
        <Text style={styles.info}>{imageCount} frames</Text>

        {!outputPath ? (
          <>
            {/* FPS slider */}
            <View style={styles.control}>
              <Text style={styles.label}>FPS: {fps}</Text>
              <Slider
                minimumValue={12}
                maximumValue={60}
                step={1}
                value={fps}
                onValueChange={setFps}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.surfaceLight}
                thumbTintColor={colors.primary}
              />
              <Text style={styles.estimate}>
                Duration: {estimatedDuration.toFixed(1)}s at {fps}fps
              </Text>
            </View>

            {/* Resolution */}
            <View style={styles.control}>
              <Text style={styles.label}>Resolution: {resolution.width}×{resolution.height}</Text>
            </View>

            {/* Render button */}
            {rendering ? (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.progressText}>
                  {progress?.stage === 'preparing' ? 'Preparing frames...' :
                   progress?.stage === 'rendering' ? 'Rendering video...' :
                   'Saving...'}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress?.percent || 0}%` }]} />
                </View>
                <Text style={styles.progressPercent}>{progress?.percent || 0}%</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.renderButton} onPress={handleRender}>
                <Text style={styles.renderButtonText}>Render Timelapse</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.doneText}>Render complete!</Text>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save to Google Photos</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.background, borderRadius: 16, padding: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.title, fontFamily: PIXEL_FONT },
  close: { color: colors.textMuted, fontSize: 22 },
  batchName: { ...typography.subtitle, marginBottom: spacing.xs },
  info: { ...typography.caption, marginBottom: spacing.lg },
  control: { marginBottom: spacing.lg },
  label: { ...typography.label, fontFamily: PIXEL_FONT, marginBottom: spacing.sm },
  estimate: { ...typography.caption, marginTop: spacing.xs },
  progressContainer: { alignItems: 'center', paddingVertical: spacing.lg },
  progressText: { color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  progressBar: { width: '100%', height: 4, backgroundColor: colors.surfaceLight, borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  progressPercent: { ...typography.caption, marginTop: spacing.xs },
  renderButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  renderButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  doneText: { ...typography.subtitle, color: colors.success, textAlign: 'center', marginBottom: spacing.lg },
  saveButton: { backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
