import { useMemo } from 'react';
import { api } from '../api/client';

export function usePreviewStream(active: boolean) {
  const streamUrl = useMemo(
    () => (active ? api.previewStreamUrl() : null),
    [active],
  );

  return { streamUrl };
}
