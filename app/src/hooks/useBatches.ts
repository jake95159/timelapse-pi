import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, BatchSummary, BatchDetail } from '../api/client';

export function useBatches() {
  return useQuery<BatchSummary[]>({
    queryKey: ['batches'],
    queryFn: () => api.get<BatchSummary[]>('/api/batches'),
  });
}

export function useBatchDetail(batchId: string) {
  return useQuery<BatchDetail>({
    queryKey: ['batches', batchId],
    queryFn: () => api.get<BatchDetail>(`/api/batches/${batchId}`),
    enabled: !!batchId,
  });
}

export function useRenameBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, name }: { batchId: string; name: string }) =>
      api.patch(`/api/batches/${batchId}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
}

export function useSplitBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, afterImageId }: { batchId: string; afterImageId: string }) =>
      api.post(`/api/batches/${batchId}/split`, { after_image_id: afterImageId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
}

export function useMergeBatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchIds: string[]) => api.post('/api/batches/merge', { batch_ids: batchIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => api.delete(`/api/batches/${batchId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
  });
}
