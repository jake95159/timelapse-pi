import React from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { api } from '../../api/client';
import { colors, spacing } from '../../theme';

const { width, height } = Dimensions.get('window');

export function ImageViewerScreen({ route, navigation }: any) {
  const { batchId, imageId } = route.params;
  const imageUri = api.imageUrl(batchId, imageId);

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <View style={styles.footer}>
        <Text style={styles.imageId}>{imageId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  image: { width, height: height * 0.8 },
  closeButton: { position: 'absolute', top: 50, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#fff', fontSize: 18 },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  imageId: { color: colors.textSecondary, fontSize: 14 },
});
