import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  imageUri: string | null;
  mode: 'standby' | 'live' | 'recording';
  captureCount?: number;
}

export function Viewfinder({ imageUri, mode, captureCount }: Props) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.emptyFrame} />
      )}

      {/* Corner brackets */}
      <View style={[styles.bracket, styles.topLeft]} />
      <View style={[styles.bracket, styles.topRight]} />
      <View style={[styles.bracket, styles.bottomLeft]} />
      <View style={[styles.bracket, styles.bottomRight]} />

      {/* Center crosshair */}
      <View style={styles.crosshairH} />
      <View style={styles.crosshairV} />

      {/* Mode indicator */}
      <View style={styles.modeOverlay}>
        {mode === 'recording' ? (
          <Text style={[styles.modeText, { color: colors.record }, glowStyle]}>
            REC {'\u25CF'} {captureCount ?? 0}
          </Text>
        ) : mode === 'live' ? (
          <Text style={[styles.modeText, glowStyle]}>LIVE {'\u25B7'}</Text>
        ) : (
          <Text style={[styles.modeText, { color: colors.textMuted }, glowStyle]}>STBY {'\u25B7'}</Text>
        )}
      </View>

      {/* Date stamp */}
      <View style={styles.dateOverlay}>
        <Text style={[styles.overlayText, glowStyle]}>{dateStr}  {timeStr}</Text>
      </View>

      {/* Resolution */}
      <View style={styles.resOverlay}>
        <Text style={[styles.overlayText, glowStyle]}>800x600</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 4 / 3,
    backgroundColor: '#0a0a10',
    marginHorizontal: spacing.sm,
    marginVertical: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  emptyFrame: { flex: 1 },
  bracket: { position: 'absolute', width: 20, height: 20 },
  topLeft: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#555' },
  topRight: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#555' },
  bottomLeft: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#555' },
  bottomRight: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#555' },
  crosshairH: { position: 'absolute', top: '50%', left: '50%', width: 24, height: 1, marginLeft: -12, backgroundColor: '#444' },
  crosshairV: { position: 'absolute', top: '50%', left: '50%', width: 1, height: 24, marginTop: -12, backgroundColor: '#444' },
  modeOverlay: { position: 'absolute', top: 12, left: 14 },
  modeText: { fontFamily: PIXEL_FONT, fontSize: 12, color: colors.text, letterSpacing: 1 },
  dateOverlay: { position: 'absolute', bottom: 12, left: 14 },
  resOverlay: { position: 'absolute', bottom: 12, right: 14 },
  overlayText: { fontFamily: PIXEL_FONT, fontSize: 10, color: '#777' },
});
