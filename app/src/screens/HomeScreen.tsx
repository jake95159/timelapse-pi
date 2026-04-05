import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, PIXEL_FONT } from '../theme';

export function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.placeholder}>Home Screen — Coming Soon</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  placeholder: { color: colors.text, fontSize: 16, textAlign: 'center', marginTop: 100, fontFamily: PIXEL_FONT },
});
