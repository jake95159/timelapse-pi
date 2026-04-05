import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useBatchDetail, useRenameBatch, useDeleteBatch } from '../../hooks/useBatches';
import { ImageThumbnail } from '../../components/ImageThumbnail';
import { downloadBatchImages, DownloadProgress } from '../../services/storage';
import { api } from '../../api/client';
import { colors, spacing, typography, PIXEL_FONT } from '../../theme';
import * as FileSystem from 'expo-file-system';
import { RenderModal } from '../render/RenderModal';

export function BatchDetailScreen({ route, navigation }: any) {
  const { batchId, batchName } = route.params;
  const { data: batch, isPending } = useBatchDetail(batchId);
  const renameBatch = useRenameBatch();
  const deleteBatch = useDeleteBatch();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [showRender, setShowRender] = useState(false);

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = (imageId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const handleDownload = async () => {
    if (!batch) return;
    const ids = selectedIds.size > 0
      ? Array.from(selectedIds)
      : batch.images.map(img => img.id);

    setDownloading(true);
    try {
      await downloadBatchImages(batchId, batch.name, ids, setDownloadProgress);
      Alert.alert('Download Complete', `${ids.length} images saved to phone`);
      setSelectedIds(new Set());
    } catch (e: any) {
      Alert.alert('Download Failed', e.message);
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Batch', `Delete "${batchName}" and all ${batch?.image_count} images?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteBatch.mutate(batchId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleRename = () => {
    Alert.prompt('Rename Batch', 'Enter new name:', (name: string) => {
      if (name.trim()) renameBatch.mutate({ batchId, name: name.trim() });
    }, 'plain-text', batchName);
  };

  if (isPending || !batch) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{batch.name}</Text>
        <Text style={styles.count}>{batch.image_count} images</Text>
      </View>

      {/* Action bar */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRename}>
          <Text style={styles.actionText}>Rename</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.downloadBtn]}
          onPress={handleDownload}
          disabled={downloading}
        >
          <Text style={styles.actionText}>
            {downloading
              ? `${downloadProgress?.completed}/${downloadProgress?.total}`
              : selectedIds.size > 0
                ? `Download (${selectedIds.size})`
                : 'Download All'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.warning }]}
          onPress={() => setShowRender(true)}
        >
          <Text style={styles.actionText}>Render</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Image grid */}
      <FlatList
        data={batch.images}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <ImageThumbnail
            uri={api.thumbUrl(batchId, item.id)}
            selected={selectedIds.has(item.id)}
            selectionMode={selectionMode}
            onPress={() => {
              if (selectionMode) {
                toggleSelect(item.id);
              } else {
                navigation.navigate('ImageViewer', { batchId, imageId: item.id });
              }
            }}
            onLongPress={() => toggleSelect(item.id)}
          />
        )}
        contentContainerStyle={styles.grid}
      />
      {showRender && (
        <View style={StyleSheet.absoluteFill}>
          <RenderModal
            batchPath={`${FileSystem.documentDirectory}TimelapsePi/${batch.name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/ /g, '_')}/`}
            batchName={batch.name}
            imageCount={batch.image_count}
            onClose={() => setShowRender(false)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.textMuted, fontSize: 16, marginBottom: spacing.sm, fontFamily: PIXEL_FONT },
  title: { ...typography.title, fontFamily: PIXEL_FONT, fontSize: 22 },
  count: { ...typography.caption, marginTop: spacing.xs },
  actions: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  downloadBtn: { backgroundColor: colors.primary, flex: 1, alignItems: 'center' },
  deleteBtn: { backgroundColor: colors.error },
  actionText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  grid: { paddingHorizontal: spacing.lg },
  row: { justifyContent: 'space-between' },
});
