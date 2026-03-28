import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

export function BatchListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Gallery</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  text: { color: colors.text, fontSize: 18 },
});
