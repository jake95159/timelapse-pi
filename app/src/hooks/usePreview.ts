import { useState, useCallback } from 'react';
import { Image } from 'react-native';
import { api } from '../api/client';

export function usePreview() {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const snapOnce = useCallback(async () => {
    const url = `${api.previewUrl()}?t=${Date.now()}`;
    try {
      await Image.prefetch(url);
      setImageUri(url);
    } catch {
      // Keep showing previous frame on network error
    }
  }, []);

  return { imageUri, snapOnce };
}
