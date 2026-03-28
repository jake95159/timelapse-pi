import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { BatchSummary } from '../api/client';
import { api } from '../api/client';
import { colors, spacing, typography } from '../theme';

interface Props {
  batch: BatchSummary;
  onPress: () => void;
}

export function BatchCard({ batch, onPress }: Props) {
  const thumbUri = batch.image_count > 0 && batch.first_capture
    ? api.thumbUrl(batch.id, batch.first_capture.replace('.jpg', ''))
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.thumbContainer}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbPlaceholderText}>No images</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{batch.name}</Text>
        <Text style={styles.count}>{batch.image_count} images</Text>
        {batch.created && (
          <Text style={styles.date}>{new Date(batch.created).toLocaleDateString()}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden', marginBottom: spacing.md },
  thumbContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  thumbPlaceholderText: { color: colors.textMuted, fontSize: 13 },
  info: { padding: spacing.md },
  name: { ...typography.subtitle, marginBottom: spacing.xs },
  count: { ...typography.caption },
  date: { ...typography.caption, marginTop: 2 },
});
