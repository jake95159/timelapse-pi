import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useCaptureNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/capture'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status'] });
      qc.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}

export function useStartCaptureLoop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (intervalSec: number) => api.post('/api/capture/loop/start', { interval_sec: intervalSec }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status'] }),
  });
}

export function useStopCaptureLoop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/capture/loop/stop'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status'] }),
  });
}
