import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

export interface RenderConfig {
  fps: number;
  width: number;
  height: number;
}

export interface RenderProgress {
  percent: number;
  stage: 'preparing' | 'rendering' | 'saving';
}

export async function renderTimelapse(
  imagePaths: string[],
  config: RenderConfig,
  onProgress: (progress: RenderProgress) => void,
): Promise<string> {
  // FFmpeg-kit is a native module — this will only work with a custom dev client
  const { FFmpegKit, FFmpegKitConfig } = await import('ffmpeg-kit-react-native');

  onProgress({ percent: 0, stage: 'preparing' });

  // Create a temporary directory for the frame sequence
  const tmpDir = `${FileSystem.cacheDirectory}render_${Date.now()}/`;
  await FileSystem.makeDirectoryAsync(tmpDir, { intermediates: true });

  // Symlink/copy images with sequential numbering for FFmpeg
  for (let i = 0; i < imagePaths.length; i++) {
    const dest = `${tmpDir}frame_${String(i + 1).padStart(5, '0')}.jpg`;
    await FileSystem.copyAsync({ from: imagePaths[i], to: dest });
    onProgress({ percent: Math.round((i / imagePaths.length) * 30), stage: 'preparing' });
  }

  // Output path
  const outputPath = `${FileSystem.cacheDirectory}timelapse_${Date.now()}.mp4`;

  // FFmpeg command
  const cmd = `-y -framerate ${config.fps} -i ${tmpDir}frame_%05d.jpg -vf scale=${config.width}:${config.height} -c:v libx264 -pix_fmt yuv420p -preset fast ${outputPath}`;

  onProgress({ percent: 30, stage: 'rendering' });

  // Enable progress callback
  FFmpegKitConfig.enableStatisticsCallback((stats: any) => {
    const frame = stats.getVideoFrameNumber?.() || 0;
    const pct = Math.min(30 + Math.round((frame / imagePaths.length) * 60), 90);
    onProgress({ percent: pct, stage: 'rendering' });
  });

  const session = await FFmpegKit.execute(cmd);
  const returnCode = await session.getReturnCode();

  // Clean up temp frames
  await FileSystem.deleteAsync(tmpDir, { idempotent: true });

  if (!returnCode.isValueSuccess()) {
    const logs = await session.getAllLogsAsString();
    throw new Error(`FFmpeg failed: ${logs?.substring(0, 200)}`);
  }

  onProgress({ percent: 95, stage: 'saving' });
  return outputPath;
}

export async function saveToPhotos(videoPath: string): Promise<void> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission denied: cannot save to Photos');
  }
  await MediaLibrary.saveToLibraryAsync(videoPath);
}
