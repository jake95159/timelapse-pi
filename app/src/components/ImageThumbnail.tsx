import React from 'react';
import { Image, TouchableOpacity, View, StyleSheet } from 'react-native';
import { colors, spacing, PIXEL_FONT } from '../theme';

interface Props {
  uri: string;
  selected?: boolean;
  selectionMode?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ImageThumbnail({ uri, selected, selectionMode, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.selected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <Image source={{ uri }} style={styles.image} />
      {selectionMode && (
        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
          {selected && <View style={styles.checkmark} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', marginBottom: spacing.xs },
  selected: { borderWidth: 2, borderColor: colors.text },
  image: { width: '100%', height: '100%' },
  checkbox: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.3)' },
  checkboxChecked: { backgroundColor: colors.text, borderColor: colors.text },
  checkmark: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', alignSelf: 'center', marginTop: 4 },
});
