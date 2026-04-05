import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useStatus } from '../hooks/useStatus';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { usePreview } from '../hooks/usePreview';
import { useCaptureNow, useStartCaptureLoop, useStopCaptureLoop } from '../hooks/useCapture';
import { useConnection } from '../providers/ConnectionProvider';
import { StatusStrip } from '../components/home/StatusStrip';
import { RuntimeEstimates } from '../components/home/RuntimeEstimates';
import { Viewfinder } from '../components/home/Viewfinder';
import { PreviewControls } from '../components/home/PreviewControls';
import { CameraSettings } from '../components/home/CameraSettings';
import { CaptureSettings } from '../components/home/CaptureSettings';
import { CaptureControls } from '../components/home/CaptureControls';
import { colors, spacing } from '../theme';

const DEFAULT_CAMERA = {
  iso: 100, exposure_mode: 'auto', awb_mode: 'auto', shutter_speed: null,
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
  const s = status || lastStatus;
  const isRecording = s?.capture_state === 'running';

  // Preview: live polling when toggled on, disabled when recording
  const previewActive = isFocused && livePreview && !isRecording;
  const imageUri = usePreview(previewActive);

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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
        imageUri={imageUri}
        mode={viewfinderMode}
        captureCount={s.capture_count}
      />

      <PreviewControls
        livePreview={livePreview}
        onToggleLive={() => setLivePreview(!livePreview)}
        onSnap={() => {
          setLivePreview(true);
          setTimeout(() => setLivePreview(false), 1500);
        }}
        disabled={isRecording}
      />

      <View style={styles.divider} />

      <CameraSettings camera={camera} onUpdate={updateCamera} />

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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md, marginVertical: spacing.xs },
});
