import React, { useRef, useCallback } from 'react';
import { View, Text, Image, StyleSheet, Platform, Pressable, GestureResponderEvent, LayoutRectangle } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

export type TapMode = 'none' | 'wb' | 'meter';

interface Props {
  streamUrl: string | null;
  snapUri: string | null;
  mode: 'standby' | 'live' | 'recording';
  captureCount?: number;
  tapMode?: TapMode;
  onSampleTap?: (normX: number, normY: number) => void;
}

// Minimal HTML page that displays an MJPEG stream via <img>.
// Includes a click listener that posts normalised coordinates back to RN
// via postMessage — this is the only reliable way to capture taps over a
// native WebView on Android (Pressable overlays can't intercept them).
function mjpegHtml(url: string): string {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0}body{background:#0a0a10;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
img{max-width:100%;max-height:100%;object-fit:contain}</style></head>
<body><img src="${url}">
<script>
document.addEventListener('click',function(e){
  window.ReactNativeWebView.postMessage(JSON.stringify({
    x:e.clientX/window.innerWidth,
    y:e.clientY/window.innerHeight
  }));
});
</script>
</body></html>`;
}

export function Viewfinder({ streamUrl, snapUri, mode, captureCount, tapMode = 'none', onSampleTap }: Props) {
  const webviewRef = useRef<WebView>(null);
  const layoutRef = useRef<LayoutRectangle>({ x: 0, y: 0, width: 0, height: 0 });

  const isTapActive = tapMode !== 'none';

  // Handle tap coordinates posted from WebView JavaScript (MJPEG stream)
  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    if (!onSampleTap || !isTapActive) return;
    try {
      const { x, y } = JSON.parse(event.nativeEvent.data);
      onSampleTap(x, y);
    } catch { /* ignore malformed messages */ }
  }, [onSampleTap, isTapActive]);

  // Handle tap on Pressable overlay (static image / empty frame — no WebView)
  const handleOverlayTap = useCallback((e: GestureResponderEvent) => {
    const { width, height } = layoutRef.current;
    if (!onSampleTap || width === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    onSampleTap(
      Math.max(0, Math.min(1, locationX / width)),
      Math.max(0, Math.min(1, locationY / height)),
    );
  }, [onSampleTap]);

  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const fadeProps = Platform.OS === 'android' ? { fadeDuration: 0 } : {};

  return (
    <View
      style={styles.container}
      onLayout={e => { layoutRef.current = e.nativeEvent.layout; }}
    >
      {/* Live MJPEG stream via WebView — JS click listener handles taps */}
      {streamUrl ? (
        <WebView
          ref={webviewRef}
          source={{ html: mjpegHtml(streamUrl) }}
          style={styles.frame}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          javaScriptEnabled
          onMessage={handleWebViewMessage}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          androidLayerType="hardware"
        />
      ) : snapUri ? (
        <Image source={{ uri: snapUri }} style={styles.frame} resizeMode="contain" {...fadeProps} />
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

      {/* Tap overlay for static image / empty frame (WebView uses JS bridge instead) */}
      {isTapActive && !streamUrl && (
        <Pressable style={styles.tapOverlay} onPress={handleOverlayTap} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 4 / 3,
    backgroundColor: '#0a0a10',
    alignSelf: 'center',
    width: '98%',
    marginVertical: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  frame: { width: '100%', height: '100%' },
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
  tapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    zIndex: 10,
  },
});
