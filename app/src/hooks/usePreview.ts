import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

export function usePreview(active: boolean) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const fetchFrame = () => {
      setImageUri(`${api.previewUrl()}?t=${Date.now()}`);
    };

    fetchFrame();
    intervalRef.current = setInterval(fetchFrame, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  return imageUri;
}
