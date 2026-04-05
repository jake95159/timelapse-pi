import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MapPin, Crosshair, BatteryHigh as BatteryIcon, WifiHigh } from 'phosphor-react-native';
import * as Location from 'expo-location';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelWrap}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
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

    const newLocal = JSON.parse(JSON.stringify(localSettings));
    let ref = newLocal;
    for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]];
    ref[keys[keys.length - 1]] = value;
    setLocalSettings(newLocal);
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      save('location.lat', Math.round(loc.coords.latitude * 10000) / 10000);
      save('location.lon', Math.round(loc.coords.longitude * 10000) / 10000);
    } catch (e: any) {
      Alert.alert('Location Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SETTINGS</Text>

      <Section title="LOCATION">
        <SettingRow label="Latitude" icon={<MapPin size={16} color={colors.textMuted} weight="duotone" />}>
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lat ?? 0)}
            onChangeText={v => save('location.lat', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <SettingRow label="Longitude" icon={<MapPin size={16} color={colors.textMuted} weight="duotone" />}>
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lon ?? 0)}
            onChangeText={v => save('location.lon', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <TouchableOpacity style={styles.gpsButton} onPress={useCurrentLocation}>
          <Crosshair size={16} color={colors.text} weight="duotone" />
          <Text style={styles.gpsButtonText}>Use Current Location</Text>
        </TouchableOpacity>
      </Section>

      <Section title="DEVICE">
        <SettingRow label="Battery (mAh)" icon={<BatteryIcon size={16} color={colors.textMuted} weight="duotone" />}>
          <TextInput
            style={styles.input}
            value={String(localSettings.power?.battery_mah ?? localSettings.battery_mah ?? 9700)}
            onChangeText={v => save('power.battery_mah', parseInt(v, 10) || 0)}
            keyboardType="numeric"
          />
        </SettingRow>
      </Section>

      <Section title="NETWORK">
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Network')}>
          <WifiHigh size={18} color={colors.text} weight="duotone" />
          <Text style={styles.navButtonText}>WiFi Management</Text>
        </TouchableOpacity>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontFamily: PIXEL_FONT, fontSize: 18, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  rowLabel: { fontSize: 14, color: colors.text },
  input: { backgroundColor: colors.surfaceLight, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 4, textAlign: 'right', width: 100, borderWidth: 1, borderColor: colors.border },
  gpsButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLight, padding: spacing.md, borderRadius: 4, marginTop: spacing.md, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  gpsButtonText: { color: colors.text, fontSize: 14 },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLight, padding: spacing.md, borderRadius: 4, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  navButtonText: { color: colors.text, fontWeight: '500', fontSize: 15 },
});
