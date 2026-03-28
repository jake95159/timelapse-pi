import * as FileSystem from 'expo-file-system';
import { api } from '../api/client';

const BASE_DIR = `${FileSystem.documentDirectory}TimelapsePi/`;

export async function ensureBatchDir(batchName: string): Promise<string> {
  const safeName = batchName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/ /g, '_');
  const dir = `${BASE_DIR}${safeName}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export interface DownloadProgress {
  completed: number;
  total: number;
  currentFile: string;
}

export async function downloadBatchImages(
  batchId: string,
  batchName: string,
  imageIds: string[],
  onProgress: (progress: DownloadProgress) => void,
): Promise<string> {
  const dir = await ensureBatchDir(batchName);

  for (let i = 0; i < imageIds.length; i++) {
    const imageId = imageIds[i];
    const destUri = `${dir}${imageId}.jpg`;

    // Skip if already downloaded
    const info = await FileSystem.getInfoAsync(destUri);
    if (info.exists) {
      onProgress({ completed: i + 1, total: imageIds.length, currentFile: imageId });
      continue;
    }

    const url = api.imageUrl(batchId, imageId);
    await FileSystem.downloadAsync(url, destUri);
    onProgress({ completed: i + 1, total: imageIds.length, currentFile: imageId });
  }

  return dir;
}

export async function getLocalBatches(): Promise<Array<{ name: string; path: string; imageCount: number }>> {
  const info = await FileSystem.getInfoAsync(BASE_DIR);
  if (!info.exists) return [];

  const dirs = await FileSystem.readDirectoryAsync(BASE_DIR);
  const batches = [];

  for (const dir of dirs.sort()) {
    const dirPath = `${BASE_DIR}${dir}/`;
    const files = await FileSystem.readDirectoryAsync(dirPath);
    const images = files.filter(f => f.endsWith('.jpg'));
    batches.push({ name: dir, path: dirPath, imageCount: images.length });
  }

  return batches;
}

export async function getLocalBatchImages(batchPath: string): Promise<string[]> {
  const files = await FileSystem.readDirectoryAsync(batchPath);
  return files.filter(f => f.endsWith('.jpg')).sort().map(f => `${batchPath}${f}`);
}
