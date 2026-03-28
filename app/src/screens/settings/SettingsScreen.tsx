import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { colors, spacing, typography } from '../../theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function SettingsScreen({ navigation }: any) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [localSettings, setLocalSettings] = useState<any>(null);

  useEffect(() => {
    if (settings && !localSettings) setLocalSettings(settings);
  }, [settings, localSettings]);

  if (!localSettings) return null;

  const save = (path: string, value: unknown) => {
    const keys = path.split('.');
    const update: any = {};
    let current = update;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    updateSettings.mutate(update);

    // Update local state
    const newLocal = JSON.parse(JSON.stringify(localSettings));
    let ref = newLocal;
    for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]];
    ref[keys[keys.length - 1]] = value;
    setLocalSettings(newLocal);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <Section title="CAPTURE">
        <SettingRow label="Software Interval (sec)">
          <TextInput
            style={styles.input}
            value={String(localSettings.software_interval_sec)}
            onChangeText={v => save('software_interval_sec', parseInt(v, 10) || 0)}
            keyboardType="numeric"
          />
        </SettingRow>
        <SettingRow label="Hardware Interval (sec)">
          <Text style={styles.readOnly}>{localSettings.hardware_interval_sec}</Text>
        </SettingRow>
      </Section>

      <Section title="CAMERA DEFAULTS">
        <SettingRow label="ISO">
          <TextInput
            style={styles.input}
            value={String(localSettings.camera?.iso)}
            onChangeText={v => save('camera.iso', parseInt(v, 10) || 100)}
            keyboardType="numeric"
          />
        </SettingRow>
        <SettingRow label="Exposure Mode">
          <Text style={styles.readOnly}>{localSettings.camera?.exposure_mode}</Text>
        </SettingRow>
        <SettingRow label="AWB Mode">
          <Text style={styles.readOnly}>{localSettings.camera?.awb_mode}</Text>
        </SettingRow>
      </Section>

      <Section title="LOCATION & DAYLIGHT">
        <SettingRow label="Latitude">
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lat)}
            onChangeText={v => save('location.lat', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <SettingRow label="Longitude">
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lon)}
            onChangeText={v => save('location.lon', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <SettingRow label="Daylight Only">
          <Switch
            value={localSettings.daylight_only}
            onValueChange={v => save('daylight_only', v)}
            trackColor={{ true: colors.primary }}
          />
        </SettingRow>
        <SettingRow label="Window Start">
          <TextInput
            style={styles.input}
            value={localSettings.window_start}
            onChangeText={v => save('window_start', v)}
          />
        </SettingRow>
        <SettingRow label="Window End">
          <TextInput
            style={styles.input}
            value={localSettings.window_end}
            onChangeText={v => save('window_end', v)}
          />
        </SettingRow>
      </Section>

      <Section title="DEVICE">
        <SettingRow label="Battery (mAh)">
          <TextInput
            style={styles.input}
            value={String(localSettings.battery_mah)}
            onChangeText={v => save('battery_mah', parseInt(v, 10) || 0)}
            keyboardType="numeric"
          />
        </SettingRow>
      </Section>

      <Section title="NETWORK">
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Network')}
        >
          <Text style={styles.navButtonText}>WiFi Management →</Text>
        </TouchableOpacity>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.label, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceLight },
  rowLabel: { ...typography.body, flex: 1 },
  input: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, textAlign: 'right', width: 100 },
  readOnly: { color: colors.textSecondary, fontSize: 14 },
  navButton: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  navButtonText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
});
