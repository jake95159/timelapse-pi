import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnection } from '../providers/ConnectionProvider';
import { colors, spacing } from '../theme';

export function ConnectionBar() {
  const { state, piAddress, connect } = useConnection();
  const insets = useSafeAreaInsets();

  if (state === 'connected') {
    return (
      <View style={[styles.bar, styles.connected, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.dot} />
        <Text style={styles.text}>Connected</Text>
        <Text style={styles.address}>{piAddress?.replace('http://', '').replace(':8000', '')}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[styles.bar, styles.disconnected, { paddingTop: insets.top + spacing.xs }]} onPress={() => connect()}>
      <View style={[styles.dot, styles.dotRed]} />
      <Text style={styles.text}>
        {state === 'searching' ? 'Searching...' : 'Disconnected'}
      </Text>
      {state === 'disconnected' && <Text style={styles.tapHint}>Tap to reconnect</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  connected: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  disconnected: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  dotRed: { backgroundColor: colors.error },
  text: { color: colors.text, fontSize: 13 },
  address: { color: colors.textSecondary, fontSize: 12, marginLeft: 'auto' },
  tapHint: { color: colors.textSecondary, fontSize: 12, marginLeft: 'auto' },
});
