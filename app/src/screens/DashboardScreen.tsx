import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { useStatus } from '../hooks/useStatus';
import { useCaptureNow, useStartCaptureLoop, useStopCaptureLoop } from '../hooks/useCapture';
import { useConnection } from '../providers/ConnectionProvider';
import { colors, spacing, typography } from '../theme';

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {unit && <Text style={styles.statUnit}> {unit}</Text>}
      </Text>
    </View>
  );
}

export function DashboardScreen() {
  const { lastStatus } = useConnection();
  const { data: status } = useStatus();
  const captureNow = useCaptureNow();
  const startLoop = useStartCaptureLoop();
  const stopLoop = useStopCaptureLoop();
  const [intervalInput, setIntervalInput] = useState('30');

  const s = status || lastStatus;
  if (!s) return null;

  const isRunning = s.capture_state === 'running';

  const handleStartLoop = () => {
    const sec = parseInt(intervalInput, 10);
    if (isNaN(sec) || sec < 1) {
      Alert.alert('Invalid interval', 'Enter a number of seconds (minimum 1)');
      return;
    }
    startLoop.mutate(sec);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.modeBadge}>
        <Text style={styles.modeText}>{s.mode.toUpperCase()} MODE</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Capture State" value={isRunning ? `Running (${s.capture_count})` : 'Idle'} />
        <StatCard label="Storage Used" value={s.storage_used_pct} unit="%" />
        <StatCard label="Storage Free" value={Math.round(s.storage_free_mb / 1024 * 10) / 10} unit="GB" />
        <StatCard label="Battery" value={s.battery_mah} unit="mAh" />
        <StatCard label="Est. Runtime" value={s.runtime_estimate_hours ?? '—'} unit="hrs" />
        <StatCard label="Interval" value={s.mode === 'bypass' ? s.software_interval_sec : s.hardware_interval_sec} unit="sec" />
      </View>

      {s.last_capture && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LAST CAPTURE</Text>
          <Text style={styles.body}>{s.last_capture.image_id} in {s.last_capture.batch_id}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CAPTURE CONTROLS</Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.captureButton]}
          onPress={() => captureNow.mutate()}
          disabled={captureNow.isPending}
        >
          <Text style={styles.actionButtonText}>
            {captureNow.isPending ? 'Capturing...' : 'Capture Now'}
          </Text>
        </TouchableOpacity>

        {!isRunning ? (
          <View style={styles.loopRow}>
            <TextInput
              style={styles.intervalInput}
              value={intervalInput}
              onChangeText={setIntervalInput}
              keyboardType="numeric"
              placeholder="sec"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartLoop}
              disabled={startLoop.isPending}
            >
              <Text style={styles.actionButtonText}>Start Capture Loop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={() => stopLoop.mutate()}
            disabled={stopLoop.isPending}
          >
            <Text style={styles.actionButtonText}>Stop Capture Loop</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.uptime}>Uptime: {Math.floor(s.uptime_sec / 60)}m {s.uptime_sec % 60}s</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, marginBottom: spacing.md },
  modeBadge: { backgroundColor: colors.surface, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 8, marginBottom: spacing.lg },
  modeText: { ...typography.label, color: colors.primary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, width: '48%', flexGrow: 1 },
  statLabel: { ...typography.label, marginBottom: spacing.xs },
  statValue: { ...typography.subtitle, fontSize: 20 },
  statUnit: { ...typography.caption, fontSize: 14 },
  section: { marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  body: { ...typography.body },
  actionButton: { paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', marginBottom: spacing.sm },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  captureButton: { backgroundColor: colors.primary },
  startButton: { backgroundColor: colors.success, flex: 1 },
  stopButton: { backgroundColor: colors.error },
  loopRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  intervalInput: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: 8, fontSize: 16, width: 80, textAlign: 'center' },
  uptime: { ...typography.caption, textAlign: 'center', marginTop: spacing.md },
});
