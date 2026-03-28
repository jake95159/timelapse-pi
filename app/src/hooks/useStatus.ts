import { useQuery } from '@tanstack/react-query';
import { api, PiStatus } from '../api/client';

export function useStatus() {
  return useQuery<PiStatus>({
    queryKey: ['status'],
    queryFn: () => api.get<PiStatus>('/api/status'),
    refetchInterval: 5000,
  });
}
