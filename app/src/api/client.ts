export type ConnectionState = 'searching' | 'connected' | 'disconnected';

export interface PiStatus {
  mode: 'auto' | 'bypass';
  capture_state: 'idle' | 'running' | 'stopped';
  capture_count: number;
  last_capture: { image_id: string; batch_id: string } | null;
  storage_used_pct: number;
  storage_free_mb: number;
  battery_voltage: number | null;
  battery_soc_pct: number | null;
  battery_mah: number;
  runtime_estimate_hours: number | null;
  software_interval_sec: number;
  hardware_interval_sec: number;
  uptime_sec: number;
}

export interface BatchSummary {
  id: string;
  name: string;
  image_count: number;
  first_capture: string | null;
  last_capture: string | null;
  created?: string;
}

export interface BatchDetail extends BatchSummary {
  images: Array<{
    id: string;
    filename: string;
    size_bytes: number;
  }>;
}

export interface NetworkStatus {
  mode: 'ap' | 'client' | 'unknown';
  ssid: string | null;
  ip: string | null;
  signal_strength: number | null;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
}

class ApiClient {
  private baseUrl: string = '';

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return res.json();
  }

  async getBlob(path: string): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return res.blob();
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path}: ${res.status}`);
    return res.json();
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path}: ${res.status}`);
    return res.json();
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${path}: ${res.status}`);
    return res.json();
  }

  imageUrl(batchId: string, imageId: string): string {
    return `${this.baseUrl}/api/batches/${batchId}/images/${imageId}`;
  }

  thumbUrl(batchId: string, imageId: string): string {
    return `${this.baseUrl}/api/batches/${batchId}/images/${imageId}/thumb`;
  }

  previewUrl(): string {
    return `${this.baseUrl}/api/preview`;
  }

  previewStreamUrl(): string {
    return `${this.baseUrl}/api/preview/stream`;
  }

  async samplePreview(x: number, y: number): Promise<{ r: number; g: number; b: number }> {
    return this.get(`/api/preview/sample?x=${x}&y=${y}`);
  }
}

export const api = new ApiClient();
