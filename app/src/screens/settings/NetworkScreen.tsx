import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { ArrowLeft, WifiHigh, Plus } from 'phosphor-react-native';
import { useNetworkStatus, useWifiScan, useWifiConnect, useStartAP, useSavedNetworks, useRemoveSavedNetwork } from '../../hooks/useNetwork';
import { colors, spacing, typography, PIXEL_FONT } from '../../theme';

export function NetworkScreen({ navigation }: any) {
  const { data: netStatus } = useNetworkStatus();
  const { data: networks, refetch: scan, isFetching: scanning } = useWifiScan();
  const { data: saved } = useSavedNetworks();
  const wifiConnect = useWifiConnect();
  const startAP = useStartAP();
  const removeSaved = useRemoveSavedNetwork();
  const [password, setPassword] = useState('');
  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualSsid, setManualSsid] = useState('');
  const [manualPassword, setManualPassword] = useState('');

  const handleConnect = () => {
    if (!selectedSsid) return;
    wifiConnect.mutate({ ssid: selectedSsid, password });
    Alert.alert('Connecting', `Connecting to ${selectedSsid}...\nThe app will reconnect shortly.`);
    setSelectedSsid(null);
    setPassword('');
  };

  const handleManualConnect = () => {
    if (!manualSsid.trim()) return;
    wifiConnect.mutate({ ssid: manualSsid.trim(), password: manualPassword });
    Alert.alert('Connecting', `Connecting to ${manualSsid}...`);
    setShowAddManual(false);
    setManualSsid('');
    setManualPassword('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Network</Text>
      </View>

      {/* Current status */}
      {netStatus && (
        <View style={styles.statusCard}>
          <Text style={styles.label}>CURRENT CONNECTION</Text>
          <Text style={styles.statusText}>
            {netStatus.mode === 'ap' ? `AP Mode: ${netStatus.ssid}` : `Connected: ${netStatus.ssid}`}
          </Text>
          <Text style={styles.statusIp}>IP: {netStatus.ip}</Text>
          {netStatus.signal_strength && (
            <Text style={styles.statusIp}>Signal: {netStatus.signal_strength} dBm</Text>
          )}
        </View>
      )}

      {/* Scan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>AVAILABLE NETWORKS</Text>
          <TouchableOpacity onPress={() => scan()} disabled={scanning}>
            <Text style={styles.scanBtn}>{scanning ? 'Scanning...' : 'Scan'}</Text>
          </TouchableOpacity>
        </View>
        {networks && networks.map(net => (
          <TouchableOpacity
            key={net.ssid}
            style={[styles.networkRow, selectedSsid === net.ssid && styles.networkSelected]}
            onPress={() => setSelectedSsid(net.ssid === selectedSsid ? null : net.ssid)}
          >
            <Text style={styles.networkSsid}>{net.ssid}</Text>
            <Text style={styles.networkSignal}>{net.signal} dBm</Text>
            <Text style={styles.networkSec}>{net.security}</Text>
          </TouchableOpacity>
        ))}

        {selectedSsid && (
          <View style={styles.connectForm}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.connectBtn} onPress={handleConnect}>
              <Text style={styles.connectBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Saved networks */}
      <View style={styles.section}>
        <Text style={styles.label}>SAVED NETWORKS</Text>
        {saved && saved.map((net: any) => (
          <View key={net.ssid} style={styles.savedRow}>
            <Text style={styles.networkSsid}>{net.ssid}</Text>
            <TouchableOpacity onPress={() => removeSaved.mutate(net.ssid)}>
              <Text style={styles.removeBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Add network manually */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>ADD NETWORK</Text>
        </View>
        {!showAddManual ? (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddManual(true)}>
            <Plus size={16} color={colors.text} weight="duotone" />
            <Text style={styles.addButtonText}>Add Network Manually</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.manualForm}>
            <TextInput
              style={styles.input}
              placeholder="Network SSID"
              placeholderTextColor={colors.textMuted}
              value={manualSsid}
              onChangeText={setManualSsid}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={manualPassword}
              onChangeText={setManualPassword}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity style={[styles.connectBtn, { flex: 1 }]} onPress={handleManualConnect}>
                <Text style={styles.connectBtnText}>Connect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.connectBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAddManual(false)}>
                <Text style={[styles.connectBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* AP Mode */}
      <TouchableOpacity
        style={styles.apButton}
        onPress={() => {
          Alert.alert('Start AP Mode', 'This will disconnect from WiFi and start the Pi hotspot.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Start AP', onPress: () => startAP.mutate({}) },
          ]);
        }}
      >
        <Text style={styles.apButtonText}>Switch to AP Mode</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  back: { color: colors.textMuted, fontSize: 16, marginBottom: spacing.sm, fontFamily: PIXEL_FONT },
  title: { fontFamily: PIXEL_FONT, fontSize: 24, color: colors.text },
  statusCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  statusText: { ...typography.subtitle, marginTop: spacing.xs },
  statusIp: { ...typography.caption, marginTop: 2 },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  label: { fontFamily: PIXEL_FONT, fontSize: 9, textTransform: 'uppercase', color: colors.textDim, letterSpacing: 2 },
  scanBtn: { color: colors.text, fontSize: 14, fontWeight: '500' },
  networkRow: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  networkSelected: { borderWidth: 1, borderColor: colors.text },
  networkSsid: { ...typography.body, flex: 1 },
  networkSignal: { ...typography.caption, marginRight: spacing.md },
  networkSec: { ...typography.caption, width: 50 },
  connectForm: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  input: { flex: 1, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  connectBtn: { backgroundColor: colors.surfaceLight, paddingHorizontal: spacing.lg, borderRadius: 8, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  connectBtnText: { color: colors.text, fontWeight: '600' },
  savedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  removeBtn: { color: colors.danger, fontSize: 13 },
  apButton: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.warning },
  apButtonText: { color: colors.warning, fontWeight: '600', fontSize: 15 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLight, padding: spacing.md, borderRadius: 4, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  addButtonText: { color: colors.text, fontSize: 14 },
  manualForm: { gap: spacing.sm },
});
