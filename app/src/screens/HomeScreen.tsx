import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useStatus } from '../hooks/useStatus';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { usePreview } from '../hooks/usePreview';
import { usePreviewStream } from '../hooks/usePreviewStream';
import { useCaptureNow, useStartCaptureLoop, useStopCaptureLoop } from '../hooks/useCapture';
import { useConnection } from '../providers/ConnectionProvider';
import { api } from '../api/client';
import { StatusStrip } from '../components/home/StatusStrip';
import { RuntimeEstimates } from '../components/home/RuntimeEstimates';
import { Viewfinder, TapMode } from '../components/home/Viewfinder';
import { PreviewControls } from '../components/home/PreviewControls';
import { CameraSettings } from '../components/home/CameraSettings';
import { CaptureSettings } from '../components/home/CaptureSettings';
import { CaptureControls } from '../components/home/CaptureControls';
import { colors, spacing } from '../theme';

const DEFAULT_CAMERA = {
  analogue_gain: 1.0, exposure_mode: 'auto', awb_mode: 'auto',
  red_gain: 2.0, blue_gain: 1.3, shutter_speed: null,
  ev_compensation: 0, metering_mode: 'centre', brightness: 0, contrast: 1,
  saturation: 1, sharpness: 1, noise_reduction: 'off',
};

export function HomeScreen() {
  const isFocused = useIsFocused();
  const { lastStatus } = useConnection();
  const { data: status } = useStatus();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const captureNow = useCaptureNow();
  const startLoop = useStartCaptureLoop();
  const stopLoop = useStopCaptureLoop();

  const [livePreview, setLivePreview] = useState(false);
  const [tapMode, setTapMode] = useState<TapMode>('none');
  const s = status || lastStatus;
  const isRecording = s?.capture_state === 'running';

  // Preview: MJPEG stream for live, HTTP snapshot for snap
  const previewActive = isFocused && livePreview && !isRecording;
  const { streamUrl } = usePreviewStream(previewActive);
  const { imageUri: snapUri, snapOnce } = usePreview();

  // Camera config with defaults
  const camera = { ...DEFAULT_CAMERA, ...(settings as any)?.camera };

  const updateCamera = useCallback((key: string, value: unknown) => {
    updateSettings.mutate({ camera: { [key]: value } });
  }, [updateSettings]);

  const updateSetting = useCallback((key: string, value: unknown) => {
    const keys = key.split('.');
    if (keys.length === 1) {
      updateSettings.mutate({ [key]: value });
    } else {
      const update: any = {};
      let current = update;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      updateSettings.mutate(update);
    }
  }, [updateSettings]);

  const handleSampleTap = useCallback(async (normX: number, normY: number) => {
    if (tapMode === 'none') return;
    try {
      const { r, g, b } = await api.samplePreview(normX, normY);
      if (tapMode === 'wb') {
        // Adjust colour gains so the tapped pixel becomes neutral
        const newRed = Math.min(4.0, Math.max(0.5, camera.red_gain * (g / Math.max(r, 1))));
        const newBlue = Math.min(4.0, Math.max(0.5, camera.blue_gain * (g / Math.max(b, 1))));
        updateSettings.mutate({
          camera: {
            red_gain: Math.round(newRed * 100) / 100,
            blue_gain: Math.round(newBlue * 100) / 100,
          },
        });
      } else if (tapMode === 'meter') {
        // Adjust EV so the tapped area reaches mid-tone exposure
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const evOffset = Math.log2(128 / Math.max(lum, 1));
        const newEv = Math.round(Math.min(4, Math.max(-4, camera.ev_compensation + evOffset)) * 2) / 2;
        updateSettings.mutate({ camera: { ev_compensation: newEv } });
      }
    } catch {
      // Keep current values on network error
    }
    setTapMode('none');
  }, [tapMode, camera.red_gain, camera.blue_gain, camera.ev_compensation, updateSettings]);

  if (!s) return null;

  // Compute runtime estimates
  const storageFreeGb = s.storage_free_mb / 1024;
  const swInterval = (settings as any)?.software_interval_sec ?? s.software_interval_sec;
  const hwInterval = (settings as any)?.hardware_interval_sec ?? s.hardware_interval_sec;

  // Rough estimates: frames = hours * 3600 / interval
  const bypassHours = s.runtime_estimate_hours;
  const bypassFrames = bypassHours != null ? Math.round(bypassHours * 3600 / Math.max(swInterval, 1)) : null;

  // AUTO estimate: much longer runtime due to duty cycling
  const autoHours = bypassHours != null ? Math.round(bypassHours * hwInterval / 25) : null;
  const autoFrames = autoHours != null ? Math.round(autoHours * 3600 / Math.max(hwInterval, 1)) : null;

  // Rough storage limit: assume ~4MB per image
  const avgImageMb = 4;
  const framesUntilFull = Math.round(s.storage_free_mb / avgImageMb);
  const bypassStorageLimited = bypassFrames != null && bypassFrames > framesUntilFull;
  const autoStorageLimited = autoFrames != null && autoFrames > framesUntilFull;

  const viewfinderMode = isRecording ? 'recording' : livePreview ? 'live' : 'standby';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <StatusStrip
        storageFreeGb={storageFreeGb}
        storagePct={s.storage_used_pct}
        batteryVoltage={s.battery_voltage}
        batterySoc={s.battery_soc_pct}
        storageWarning={bypassStorageLimited || autoStorageLimited}
      />

      <RuntimeEstimates
        bypassHours={bypassHours}
        bypassFrames={bypassFrames}
        autoHours={autoHours}
        autoFrames={autoFrames}
        bypassStorageLimited={bypassStorageLimited}
        autoStorageLimited={autoStorageLimited}
      />

      <Viewfinder
        streamUrl={streamUrl}
        snapUri={snapUri}
        mode={viewfinderMode}
        captureCount={s.capture_count}
        tapMode={tapMode}
        onSampleTap={handleSampleTap}
      />

      <PreviewControls
        livePreview={livePreview}
        onToggleLive={() => setLivePreview(!livePreview)}
        onSnap={snapOnce}
        disabled={isRecording}
      />

      <View style={styles.divider} />

      <CameraSettings
        camera={camera}
        onUpdate={updateCamera}
        tapMode={tapMode}
        onEyedropper={() => setTapMode(tapMode === 'wb' ? 'none' : 'wb')}
        onMeterPick={() => setTapMode(tapMode === 'meter' ? 'none' : 'meter')}
      />

      <View style={styles.divider} />

      <CaptureSettings
        softwareInterval={swInterval}
        hardwareInterval={hwInterval}
        daylightOnly={(settings as any)?.daylight_only ?? false}
        sunriseOffset={(settings as any)?.sunrise_offset_min ?? 0}
        sunsetOffset={(settings as any)?.sunset_offset_min ?? 0}
        windowStart={(settings as any)?.window_start ?? '06:00'}
        windowEnd={(settings as any)?.window_end ?? '20:00'}
        onUpdate={updateSetting}
      />

      <View style={styles.divider} />

      <CaptureControls
        isRecording={isRecording}
        onCapture={() => captureNow.mutate()}
        onRecord={() => startLoop.mutate(swInterval)}
        onStop={() => stopLoop.mutate()}
        captureDisabled={captureNow.isPending}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md, marginVertical: spacing.xs },
});
