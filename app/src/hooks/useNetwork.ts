import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, NetworkStatus, WifiNetwork } from '../api/client';

export function useNetworkStatus() {
  return useQuery<NetworkStatus>({
    queryKey: ['network', 'status'],
    queryFn: () => api.get<NetworkStatus>('/api/network/status'),
  });
}

export function useWifiScan() {
  return useQuery<WifiNetwork[]>({
    queryKey: ['network', 'scan'],
    queryFn: () => api.get<WifiNetwork[]>('/api/network/scan'),
    enabled: false,
  });
}

export function useWifiConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ssid, password }: { ssid: string; password: string }) =>
      api.post('/api/network/connect', { ssid, password }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network'] }),
  });
}

export function useStartAP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config?: { ssid?: string; password?: string }) =>
      api.post('/api/network/ap', config || {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network'] }),
  });
}

export function useSavedNetworks() {
  return useQuery({
    queryKey: ['network', 'saved'],
    queryFn: () => api.get<Array<{ ssid: string; priority: number }>>('/api/network/saved'),
  });
}

export function useRemoveSavedNetwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ssid: string) => api.delete(`/api/network/saved/${ssid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['network', 'saved'] }),
  });
}
