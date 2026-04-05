import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnection } from '../providers/ConnectionProvider';
import { colors, spacing, typography, PIXEL_FONT, glowStyle } from '../theme';

export function ConnectionScreen() {
  const { state, lastStatus, connect } = useConnection();
  const [manualIp, setManualIp] = useState('');
  const [showManual, setShowManual] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.title}>TimelapsePi</Text>

      {state === 'searching' ? (
        <>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
          <Text style={styles.subtitle}>Looking for TimelapsePi...</Text>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>Could not find TimelapsePi on this network</Text>

          <TouchableOpacity style={styles.button} onPress={() => connect()}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>

          {!showManual ? (
            <TouchableOpacity style={styles.linkButton} onPress={() => setShowManual(true)}>
              <Text style={styles.linkText}>Enter IP manually</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.manualRow}>
              <TextInput
                style={styles.input}
                placeholder="192.168.1.xxx"
                placeholderTextColor={colors.textMuted}
                value={manualIp}
                onChangeText={setManualIp}
                keyboardType="numeric"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, styles.goButton]}
                onPress={() => manualIp && connect(manualIp)}
              >
                <Text style={styles.buttonText}>Connect</Text>
              </TouchableOpacity>
            </View>
          )}

          {lastStatus && (
            <TouchableOpacity style={styles.cachedButton}>
              <Text style={styles.cachedText}>View cached status (last session)</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  title: { ...typography.title, fontFamily: PIXEL_FONT, fontSize: 28, marginBottom: spacing.md, ...glowStyle },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, textAlign: 'center' },
  button: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  buttonText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  linkButton: { marginTop: spacing.md },
  linkText: { color: colors.textSecondary, fontSize: 14 },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: 8, fontSize: 16, width: 180 },
  goButton: { paddingHorizontal: spacing.lg },
  cachedButton: { marginTop: spacing.xl, padding: spacing.md },
  cachedText: { color: colors.textMuted, fontSize: 13 },
});
