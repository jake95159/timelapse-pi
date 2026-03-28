# Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished React Native (Expo) mobile app that connects to the Pi's FastAPI backend for timelapse camera control, image management, and phone-side video rendering.

**Architecture:** Expo custom dev client (required for ffmpeg-kit + zeroconf native modules). Connection layer discovers Pi via mDNS or fixed AP IP. React Query manages API data fetching with cached offline state. Images download to phone filesystem in named batch directories (USB-accessible). Video rendering happens on-phone via ffmpeg-kit, exports to Google Photos.

**Tech Stack:** Expo SDK 55, React Navigation 7, TanStack Query 5, expo-file-system, expo-media-library, ffmpeg-kit-react-native, react-native-zeroconf, @react-native-async-storage/async-storage

**Spec:** `docs/superpowers/specs/2026-03-28-sprint2-api-app-design.md`

**Pi API base URL (dev):** `http://localhost:8000/api` (mock server) or `http://<pi-ip>:8000/api` (real Pi)

---

## File Structure

```
app/
├── App.tsx                           # Root: providers (Query, Connection, Navigation)
├── app.json                          # Expo config (custom dev client, plugins)
├── package.json
├── tsconfig.json
├── eas.json                          # EAS Build config (dev client profile)
├── src/
│   ├── api/
│   │   └── client.ts                 # Typed fetch wrapper for Pi API
│   ├── providers/
│   │   └── ConnectionProvider.tsx     # Pi discovery, heartbeat, connection state
│   ├── hooks/
│   │   ├── useStatus.ts              # GET /api/status (React Query)
│   │   ├── useSettings.ts            # GET/PATCH /api/settings
│   │   ├── useBatches.ts             # GET /api/batches, batch detail, CRUD
│   │   ├── useCapture.ts             # POST capture, loop start/stop
│   │   ├── usePreview.ts             # GET /api/preview polling
│   │   └── useNetwork.ts             # Network status, scan, connect
│   ├── screens/
│   │   ├── ConnectionScreen.tsx      # "Looking for Pi" + join AP + manual IP
│   │   ├── DashboardScreen.tsx       # Status overview, capture controls
│   │   ├── PreviewScreen.tsx         # 1fps camera feed, exposure controls
│   │   ├── gallery/
│   │   │   ├── BatchListScreen.tsx   # Batch cards with thumbnails
│   │   │   ├── BatchDetailScreen.tsx # Image grid, multi-select, download
│   │   │   └── ImageViewerScreen.tsx # Full-screen image viewer
│   │   ├── settings/
│   │   │   ├── SettingsScreen.tsx    # Settings hub (sections)
│   │   │   └── NetworkScreen.tsx     # WiFi scan/connect/AP management
│   │   └── render/
│   │       └── RenderModal.tsx       # Configure, render, export flow
│   ├── components/
│   │   ├── ConnectionBar.tsx         # Green/red connection indicator
│   │   ├── BatchCard.tsx             # Batch summary card for list
│   │   └── ImageThumbnail.tsx        # Thumbnail with selection checkbox
│   ├── services/
│   │   ├── storage.ts               # Batch download, local file management
│   │   └── renderer.ts              # ffmpeg-kit video rendering
│   ├── navigation/
│   │   └── AppNavigator.tsx          # Tab + stack navigator setup
│   └── theme.ts                     # Colors, spacing, typography constants
├── mock-server/
│   ├── server.js                     # Express mock of Pi API (for development)
│   ├── sample-images/                # A few sample JPEGs for mock gallery
│   └── package.json                  # Express dependency
└── __tests__/
    ├── api/
    │   └── client.test.ts
    ├── providers/
    │   └── ConnectionProvider.test.tsx
    ├── hooks/
    │   └── useStatus.test.ts
    └── services/
        └── storage.test.ts
```

---

## Task 1: Expo Project Scaffolding + Mock API Server

**Files:**
- Create: `app/` directory with Expo project
- Create: `app/mock-server/server.js`
- Create: `app/mock-server/package.json`
- Modify: `app/app.json`
- Create: `app/eas.json`

- [ ] **Step 1: Create Expo project**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi
npx create-expo-app@latest app --template blank-typescript
cd app
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install @react-navigation/native @react-navigation/bottom-tabs \
  @react-navigation/native-stack react-native-screens react-native-safe-area-context \
  @tanstack/react-query @react-native-async-storage/async-storage \
  expo-file-system expo-media-library @react-native-community/slider

npm install react-native-zeroconf ffmpeg-kit-react-native
```

- [ ] **Step 3: Configure app.json for custom dev client**

Update `app/app.json`:

```json
{
  "expo": {
    "name": "TimelapsePi",
    "slug": "timelapse-pi",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "splash": {
      "backgroundColor": "#0f172a"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#0f172a"
      },
      "package": "com.timelapsePi.app",
      "permissions": [
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.CHANGE_WIFI_STATE",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.timelapsePi.app",
      "infoPlist": {
        "NSPhotoLibraryAddUsageDescription": "Save rendered timelapse videos to your photo library",
        "NSLocalNetworkUsageDescription": "Discover TimelapsePi camera on your local network"
      }
    },
    "plugins": [
      "expo-file-system",
      "expo-media-library"
    ]
  }
}
```

- [ ] **Step 4: Create EAS build config**

Create `app/eas.json`:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

- [ ] **Step 5: Create theme constants**

Create `app/src/theme.ts`:

```typescript
export const colors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceLight: '#334155',
  primary: '#60a5fa',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 14, color: colors.text },
  caption: { fontSize: 12, color: colors.textSecondary },
  label: { fontSize: 11, textTransform: 'uppercase' as const, color: colors.textMuted, letterSpacing: 1 },
};
```

- [ ] **Step 6: Create mock API server**

Create `app/mock-server/package.json`:

```json
{
  "name": "timelapse-pi-mock-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.0"
  }
}
```

Create `app/mock-server/server.js`:

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Mock state
let captureLoopRunning = false;
let captureCount = 0;

const defaultConfig = {
  location: { lat: 38.846, lon: -77.305 },
  daylight_only: false,
  window_start: '07:00',
  window_end: '20:00',
  hardware_interval_sec: 3600,
  software_interval_sec: 60,
  battery_mah: 9700,
  camera: { iso: 100, exposure_mode: 'auto', shutter_speed: null, awb_mode: 'auto' },
  ap: { ssid: 'TimelapsePi', password: 'timelapse' },
};

let config = { ...defaultConfig };

const mockBatches = [
  {
    id: 'batch_001_2026-03-20',
    name: 'Garden Test',
    image_count: 24,
    first_capture: 'capture_00001.jpg',
    last_capture: 'capture_00024.jpg',
    created: '2026-03-20T10:00:00',
  },
  {
    id: 'batch_002_2026-03-25',
    name: 'Sunset Deck',
    image_count: 48,
    first_capture: 'capture_00025.jpg',
    last_capture: 'capture_00072.jpg',
    created: '2026-03-25T17:00:00',
  },
  {
    id: 'auto',
    name: 'Auto Captures',
    image_count: 142,
    first_capture: 'capture_00001.jpg',
    last_capture: 'capture_00142.jpg',
    created: '2026-03-15T08:00:00',
  },
];

// --- Status ---
app.get('/api/status', (req, res) => {
  res.json({
    mode: 'bypass',
    capture_state: captureLoopRunning ? 'running' : 'idle',
    capture_count: captureCount,
    last_capture: { image_id: 'capture_00142', batch_id: 'auto' },
    storage_used_pct: 23.4,
    storage_free_mb: 14200,
    battery_mah: config.battery_mah,
    runtime_estimate_hours: 27.8,
    software_interval_sec: config.software_interval_sec,
    hardware_interval_sec: config.hardware_interval_sec,
    uptime_sec: Math.floor(process.uptime()),
  });
});

// --- Settings ---
app.get('/api/settings', (req, res) => res.json(config));

app.patch('/api/settings', (req, res) => {
  config = deepMerge(config, req.body);
  res.json(config);
});

// --- Capture ---
app.post('/api/capture', (req, res) => {
  captureCount++;
  res.json({ image_id: `capture_${String(captureCount).padStart(5, '0')}`, batch_id: 'batch_001_2026-03-20', sequence: captureCount });
});

app.post('/api/capture/loop/start', (req, res) => {
  if (captureLoopRunning) return res.status(409).json({ detail: 'Capture loop already running' });
  captureLoopRunning = true;
  captureCount = 0;
  res.json({ status: 'started', batch_id: 'batch_003_2026-03-28' });
});

app.post('/api/capture/loop/stop', (req, res) => {
  captureLoopRunning = false;
  res.json({ status: 'stopped', capture_count: captureCount });
});

// --- Preview ---
app.get('/api/preview', (req, res) => {
  // Return a 1x1 red JPEG placeholder
  const buf = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=',
    'base64'
  );
  res.set('Content-Type', 'image/jpeg');
  res.send(buf);
});

// --- Batches ---
app.get('/api/batches', (req, res) => res.json(mockBatches));

app.get('/api/batches/:id', (req, res) => {
  const batch = mockBatches.find(b => b.id === req.params.id);
  if (!batch) return res.status(404).json({ detail: 'Batch not found' });
  const images = [];
  for (let i = 1; i <= Math.min(batch.image_count, 10); i++) {
    images.push({ id: `capture_${String(i).padStart(5, '0')}`, filename: `capture_${String(i).padStart(5, '0')}.jpg`, size_bytes: 5000000 + Math.floor(Math.random() * 3000000) });
  }
  res.json({ ...batch, images });
});

app.patch('/api/batches/:id', (req, res) => {
  const batch = mockBatches.find(b => b.id === req.params.id);
  if (!batch) return res.status(404).json({ detail: 'Batch not found' });
  if (req.body.name) batch.name = req.body.name;
  res.json(batch);
});

app.post('/api/batches/:id/split', (req, res) => {
  res.json({ batch_a: mockBatches[0], batch_b: { id: 'batch_004_2026-03-28', name: 'Split Batch', image_count: 5 } });
});

app.post('/api/batches/merge', (req, res) => {
  res.json({ merged_batch: { ...mockBatches[0], image_count: mockBatches[0].image_count + 10 } });
});

app.delete('/api/batches/:id', (req, res) => {
  res.json({ deleted_count: 24 });
});

// --- Images ---
app.get('/api/batches/:batchId/images/:imageId', (req, res) => {
  // Return the preview placeholder as full-res stand-in
  const sampleDir = path.join(__dirname, 'sample-images');
  const files = fs.existsSync(sampleDir) ? fs.readdirSync(sampleDir).filter(f => f.endsWith('.jpg')) : [];
  if (files.length > 0) {
    return res.sendFile(path.join(sampleDir, files[0]));
  }
  // Fallback: 1x1 JPEG
  const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=', 'base64');
  res.set('Content-Type', 'image/jpeg');
  res.send(buf);
});

app.get('/api/batches/:batchId/images/:imageId/thumb', (req, res) => {
  // Same as full-res for mock
  const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=', 'base64');
  res.set('Content-Type', 'image/jpeg');
  res.send(buf);
});

// --- Network ---
app.get('/api/network/status', (req, res) => {
  res.json({ mode: 'client', ssid: 'Tomato', ip: '192.168.1.100', signal_strength: -42 });
});

app.get('/api/network/scan', (req, res) => {
  res.json([
    { ssid: 'Tomato', signal: -42, security: 'WPA2' },
    { ssid: 'Neighbor5G', signal: -68, security: 'WPA2' },
    { ssid: 'CoffeeShop', signal: -75, security: 'Open' },
  ]);
});

app.post('/api/network/connect', (req, res) => {
  res.json({ status: 'connecting' });
});

app.post('/api/network/ap', (req, res) => {
  res.json({ status: 'activating' });
});

app.get('/api/network/saved', (req, res) => {
  res.json([{ ssid: 'Tomato', priority: 1 }]);
});

app.delete('/api/network/saved/:ssid', (req, res) => {
  res.json({ status: 'removed' });
});

// --- Helpers ---
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock TimelapsePi API running on http://localhost:${PORT}`);
  console.log('Endpoints: /api/status, /api/settings, /api/capture, /api/preview, /api/batches, /api/network');
});
```

- [ ] **Step 7: Install mock server dependencies and test**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app/mock-server
npm install
node server.js &
curl -s http://localhost:8000/api/status | python3 -m json.tool
kill %1
```

Expected: JSON status response with `"mode": "bypass"`.

- [ ] **Step 8: Create sample images directory**

```bash
mkdir -p app/mock-server/sample-images
```

Use Python to generate a few test JPEGs:

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi
python3 -c "
from PIL import Image
import os
d = 'app/mock-server/sample-images'
for i in range(1, 6):
    img = Image.new('RGB', (800, 600), color=(i*40, 100, 200-i*30))
    img.save(os.path.join(d, f'sample_{i:03d}.jpg'), 'JPEG', quality=80)
print(f'Created {5} sample images')
"
```

- [ ] **Step 9: Commit**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi
git add app/
git commit -m "feat: scaffold Expo project with mock API server"
```

---

## Task 2: API Client + Connection Provider

**Files:**
- Create: `app/src/api/client.ts`
- Create: `app/src/providers/ConnectionProvider.tsx`
- Create: `app/src/components/ConnectionBar.tsx`

- [ ] **Step 1: Create typed API client**

Create `app/src/api/client.ts`:

```typescript
export type ConnectionState = 'searching' | 'connected' | 'disconnected';

export interface PiStatus {
  mode: 'auto' | 'bypass';
  capture_state: 'idle' | 'running' | 'stopped';
  capture_count: number;
  last_capture: { image_id: string; batch_id: string } | null;
  storage_used_pct: number;
  storage_free_mb: number;
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
}

export const api = new ApiClient();
```

- [ ] **Step 2: Create ConnectionProvider**

Create `app/src/providers/ConnectionProvider.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ConnectionState, PiStatus } from '../api/client';

const AP_GATEWAY = 'http://10.42.0.1:8000';
const MDNS_HOST = 'http://timelapse-pi.local:8000';
const HEARTBEAT_INTERVAL = 5000;
const MAX_FAILURES = 3;
const STORAGE_KEY_PI_ADDRESS = '@pi_address';
const STORAGE_KEY_LAST_STATUS = '@last_status';

interface ConnectionContextValue {
  state: ConnectionState;
  piAddress: string | null;
  lastStatus: PiStatus | null;
  connect: (address?: string) => Promise<void>;
  disconnect: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  state: 'searching',
  piAddress: null,
  lastStatus: null,
  connect: async () => {},
  disconnect: () => {},
});

export function useConnection() {
  return useContext(ConnectionContext);
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConnectionState>('searching');
  const [piAddress, setPiAddress] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<PiStatus | null>(null);
  const failureCount = useRef(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Try to reach the Pi at a given URL
  const tryConnect = useCallback(async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url}/api/status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const status: PiStatus = await res.json();
        api.setBaseUrl(url);
        setPiAddress(url);
        setLastStatus(status);
        setState('connected');
        failureCount.current = 0;
        await AsyncStorage.setItem(STORAGE_KEY_PI_ADDRESS, url);
        await AsyncStorage.setItem(STORAGE_KEY_LAST_STATUS, JSON.stringify(status));
        return true;
      }
    } catch {}
    return false;
  }, []);

  // Discovery: try last known address, then mDNS, then AP gateway
  const discover = useCallback(async () => {
    setState('searching');

    // Try last known address first
    const lastAddress = await AsyncStorage.getItem(STORAGE_KEY_PI_ADDRESS);
    if (lastAddress && await tryConnect(lastAddress)) return;

    // Try mDNS
    if (await tryConnect(MDNS_HOST)) return;

    // Try AP gateway
    if (await tryConnect(AP_GATEWAY)) return;

    // Load cached status for offline viewing
    const cached = await AsyncStorage.getItem(STORAGE_KEY_LAST_STATUS);
    if (cached) {
      setLastStatus(JSON.parse(cached));
    }

    setState('disconnected');
  }, [tryConnect]);

  // Connect to a specific address (or auto-discover)
  const connect = useCallback(async (address?: string) => {
    if (address) {
      const url = address.startsWith('http') ? address : `http://${address}:8000`;
      if (await tryConnect(url)) return;
      setState('disconnected');
    } else {
      await discover();
    }
  }, [tryConnect, discover]);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    setState('disconnected');
    setPiAddress(null);
  }, []);

  // Heartbeat polling
  useEffect(() => {
    if (state !== 'connected' || !piAddress) return;

    heartbeatRef.current = setInterval(async () => {
      try {
        const status = await api.get<PiStatus>('/api/status');
        setLastStatus(status);
        failureCount.current = 0;
        await AsyncStorage.setItem(STORAGE_KEY_LAST_STATUS, JSON.stringify(status));
      } catch {
        failureCount.current++;
        if (failureCount.current >= MAX_FAILURES) {
          setState('disconnected');
        }
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [state, piAddress]);

  // Auto-discover on mount
  useEffect(() => {
    discover();
  }, [discover]);

  return (
    <ConnectionContext.Provider value={{ state, piAddress, lastStatus, connect, disconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
}
```

- [ ] **Step 3: Create ConnectionBar component**

Create `app/src/components/ConnectionBar.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useConnection } from '../providers/ConnectionProvider';
import { colors, spacing } from '../theme';

export function ConnectionBar() {
  const { state, piAddress, connect } = useConnection();

  if (state === 'connected') {
    return (
      <View style={[styles.bar, styles.connected]}>
        <View style={styles.dot} />
        <Text style={styles.text}>Connected</Text>
        <Text style={styles.address}>{piAddress?.replace('http://', '').replace(':8000', '')}</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[styles.bar, styles.disconnected]} onPress={() => connect()}>
      <View style={[styles.dot, styles.dotRed]} />
      <Text style={styles.text}>
        {state === 'searching' ? 'Searching...' : 'Disconnected'}
      </Text>
      {state === 'disconnected' && <Text style={styles.tapHint}>Tap to reconnect</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  connected: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  disconnected: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  dotRed: { backgroundColor: colors.error },
  text: { color: colors.text, fontSize: 13 },
  address: { color: colors.textSecondary, fontSize: 12, marginLeft: 'auto' },
  tapHint: { color: colors.textSecondary, fontSize: 12, marginLeft: 'auto' },
});
```

- [ ] **Step 4: Commit**

```bash
git add app/src/api/ app/src/providers/ app/src/components/ConnectionBar.tsx
git commit -m "feat: add API client and connection provider with auto-discovery"
```

---

## Task 3: Navigation Shell

**Files:**
- Create: `app/src/navigation/AppNavigator.tsx`
- Create: `app/src/screens/ConnectionScreen.tsx`
- Modify: `app/App.tsx`
- Create placeholder screens: `DashboardScreen.tsx`, `PreviewScreen.tsx`, `BatchListScreen.tsx`, `SettingsScreen.tsx`

- [ ] **Step 1: Create placeholder screens**

Create `app/src/screens/DashboardScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dashboard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  text: { color: colors.text, fontSize: 18 },
});
```

Create `app/src/screens/PreviewScreen.tsx` (same pattern, text = "Preview").

Create `app/src/screens/gallery/BatchListScreen.tsx` (same pattern, text = "Gallery").

Create `app/src/screens/settings/SettingsScreen.tsx` (same pattern, text = "Settings").

- [ ] **Step 2: Create ConnectionScreen**

Create `app/src/screens/ConnectionScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useConnection } from '../providers/ConnectionProvider';
import { colors, spacing, typography } from '../theme';

export function ConnectionScreen() {
  const { state, lastStatus, connect } = useConnection();
  const [manualIp, setManualIp] = useState('');
  const [showManual, setShowManual] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TimelapsePi</Text>

      {state === 'searching' ? (
        <>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />
          <Text style={styles.subtitle}>Looking for TimelapsePi...</Text>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>Could not find TimelapsePi on this network</Text>

          <TouchableOpacity style={styles.button} onPress={() => connect()}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>

          {!showManual ? (
            <TouchableOpacity style={styles.linkButton} onPress={() => setShowManual(true)}>
              <Text style={styles.linkText}>Enter IP manually</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.manualRow}>
              <TextInput
                style={styles.input}
                placeholder="192.168.1.xxx"
                placeholderTextColor={colors.textMuted}
                value={manualIp}
                onChangeText={setManualIp}
                keyboardType="numeric"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.button, styles.goButton]}
                onPress={() => manualIp && connect(manualIp)}
              >
                <Text style={styles.buttonText}>Connect</Text>
              </TouchableOpacity>
            </View>
          )}

          {lastStatus && (
            <TouchableOpacity style={styles.cachedButton}>
              <Text style={styles.cachedText}>View cached status (last session)</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  title: { ...typography.title, fontSize: 28, marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, textAlign: 'center' },
  button: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 12, marginBottom: spacing.md },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  linkButton: { marginTop: spacing.md },
  linkText: { color: colors.primary, fontSize: 14 },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: 8, fontSize: 16, width: 180 },
  goButton: { paddingHorizontal: spacing.lg },
  cachedButton: { marginTop: spacing.xl, padding: spacing.md },
  cachedText: { color: colors.textMuted, fontSize: 13 },
});
```

- [ ] **Step 3: Create AppNavigator**

Create `app/src/navigation/AppNavigator.tsx`:

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useConnection } from '../providers/ConnectionProvider';
import { ConnectionBar } from '../components/ConnectionBar';
import { ConnectionScreen } from '../screens/ConnectionScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { BatchListScreen } from '../screens/gallery/BatchListScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { Dashboard: '📊', Preview: '📷', Gallery: '🖼️', Settings: '⚙️' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] || '•'}</Text>;
}

function MainTabs() {
  return (
    <>
      <ConnectionBar />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
          tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.surfaceLight },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Preview" component={PreviewScreen} />
        <Tab.Screen name="Gallery" component={BatchListScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </>
  );
}

export function AppNavigator() {
  const { state } = useConnection();

  if (state !== 'connected') {
    return <ConnectionScreen />;
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainTabs} />
    </RootStack.Navigator>
  );
}
```

- [ ] **Step 4: Wire up App.tsx**

Replace `app/App.tsx`:

```tsx
import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConnectionProvider } from './src/providers/ConnectionProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider>
          <NavigationContainer
            theme={{
              dark: true,
              colors: {
                primary: colors.primary,
                background: colors.background,
                card: colors.background,
                text: colors.text,
                border: colors.surfaceLight,
                notification: colors.primary,
              },
              fonts: {
                regular: { fontFamily: 'System', fontWeight: '400' },
                medium: { fontFamily: 'System', fontWeight: '500' },
                bold: { fontFamily: 'System', fontWeight: '700' },
                heavy: { fontFamily: 'System', fontWeight: '900' },
              },
            }}
          >
            <AppNavigator />
          </NavigationContainer>
        </ConnectionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 5: Verify app builds**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app
npx expo start
```

Verify no compilation errors. The app should show the ConnectionScreen (since no Pi is reachable). Press Ctrl+C to stop.

- [ ] **Step 6: Commit**

```bash
git add app/App.tsx app/src/
git commit -m "feat: add navigation shell with connection screen and tab layout"
```

---

## Task 4: React Query Hooks

**Files:**
- Create: `app/src/hooks/useStatus.ts`
- Create: `app/src/hooks/useSettings.ts`
- Create: `app/src/hooks/useBatches.ts`
- Create: `app/src/hooks/useCapture.ts`
- Create: `app/src/hooks/usePreview.ts`
- Create: `app/src/hooks/useNetwork.ts`

- [ ] **Step 1: Create status hook**

Create `app/src/hooks/useStatus.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api, PiStatus } from '../api/client';

export function useStatus() {
  return useQuery<PiStatus>({
    queryKey: ['status'],
    queryFn: () => api.get<PiStatus>('/api/status'),
    refetchInterval: 5000,
  });
}
```

- [ ] **Step 2: Create settings hook**

Create `app/src/hooks/useSettings.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/settings'),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Record<string, unknown>) => api.patch('/api/settings', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
    },
  });
}
```

- [ ] **Step 3: Create batches hook**

Create `app/src/hooks/useBatches.ts`:

```typescript
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
```

- [ ] **Step 4: Create capture hook**

Create `app/src/hooks/useCapture.ts`:

```typescript
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
```

- [ ] **Step 5: Create preview hook**

Create `app/src/hooks/usePreview.ts`:

```typescript
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
      // Append timestamp to bust cache
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
```

- [ ] **Step 6: Create network hook**

Create `app/src/hooks/useNetwork.ts`:

```typescript
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
    enabled: false, // Manual trigger only
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
```

- [ ] **Step 7: Commit**

```bash
git add app/src/hooks/
git commit -m "feat: add React Query hooks for all Pi API endpoints"
```

---

## Task 5: Dashboard Screen

**Files:**
- Modify: `app/src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Implement Dashboard**

Replace `app/src/screens/DashboardScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { useStatus } from '../hooks/useStatus';
import { useCaptureNow, useStartCaptureLoop, useStopCaptureLoop } from '../hooks/useCapture';
import { useConnection } from '../providers/ConnectionProvider';
import { colors, spacing, typography } from '../theme';

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        {unit && <Text style={styles.statUnit}> {unit}</Text>}
      </Text>
    </View>
  );
}

export function DashboardScreen() {
  const { lastStatus } = useConnection();
  const { data: status } = useStatus();
  const captureNow = useCaptureNow();
  const startLoop = useStartCaptureLoop();
  const stopLoop = useStopCaptureLoop();
  const [intervalInput, setIntervalInput] = useState('30');

  const s = status || lastStatus;
  if (!s) return null;

  const isRunning = s.capture_state === 'running';

  const handleStartLoop = () => {
    const sec = parseInt(intervalInput, 10);
    if (isNaN(sec) || sec < 1) {
      Alert.alert('Invalid interval', 'Enter a number of seconds (minimum 1)');
      return;
    }
    startLoop.mutate(sec);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>

      {/* Mode badge */}
      <View style={styles.modeBadge}>
        <Text style={styles.modeText}>{s.mode.toUpperCase()} MODE</Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard label="Capture State" value={isRunning ? `Running (${s.capture_count})` : 'Idle'} />
        <StatCard label="Storage Used" value={s.storage_used_pct} unit="%" />
        <StatCard label="Storage Free" value={Math.round(s.storage_free_mb / 1024 * 10) / 10} unit="GB" />
        <StatCard label="Battery" value={s.battery_mah} unit="mAh" />
        <StatCard label="Est. Runtime" value={s.runtime_estimate_hours ?? '—'} unit="hrs" />
        <StatCard label="Interval" value={s.mode === 'bypass' ? s.software_interval_sec : s.hardware_interval_sec} unit="sec" />
      </View>

      {/* Last capture */}
      {s.last_capture && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LAST CAPTURE</Text>
          <Text style={styles.body}>{s.last_capture.image_id} in {s.last_capture.batch_id}</Text>
        </View>
      )}

      {/* Capture controls */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CAPTURE CONTROLS</Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.captureButton]}
          onPress={() => captureNow.mutate()}
          disabled={captureNow.isPending}
        >
          <Text style={styles.actionButtonText}>
            {captureNow.isPending ? 'Capturing...' : 'Capture Now'}
          </Text>
        </TouchableOpacity>

        {!isRunning ? (
          <View style={styles.loopRow}>
            <TextInput
              style={styles.intervalInput}
              value={intervalInput}
              onChangeText={setIntervalInput}
              keyboardType="numeric"
              placeholder="sec"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartLoop}
              disabled={startLoop.isPending}
            >
              <Text style={styles.actionButtonText}>Start Capture Loop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={() => stopLoop.mutate()}
            disabled={stopLoop.isPending}
          >
            <Text style={styles.actionButtonText}>Stop Capture Loop</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Uptime */}
      <Text style={styles.uptime}>Uptime: {Math.floor(s.uptime_sec / 60)}m {s.uptime_sec % 60}s</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, marginBottom: spacing.md },
  modeBadge: { backgroundColor: colors.surface, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 8, marginBottom: spacing.lg },
  modeText: { ...typography.label, color: colors.primary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, width: '48%', flexGrow: 1 },
  statLabel: { ...typography.label, marginBottom: spacing.xs },
  statValue: { ...typography.subtitle, fontSize: 20 },
  statUnit: { ...typography.caption, fontSize: 14 },
  section: { marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm },
  body: { ...typography.body },
  actionButton: { paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', marginBottom: spacing.sm },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  captureButton: { backgroundColor: colors.primary },
  startButton: { backgroundColor: colors.success, flex: 1 },
  stopButton: { backgroundColor: colors.error },
  loopRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  intervalInput: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: 8, fontSize: 16, width: 80, textAlign: 'center' },
  uptime: { ...typography.caption, textAlign: 'center', marginTop: spacing.md },
});
```

- [ ] **Step 2: Verify with mock server**

Start the mock server in one terminal, then run the app:

```bash
# Terminal 1
cd /mnt/c/Users/jake9/repos/timelapse-pi/app/mock-server && node server.js

# Terminal 2
cd /mnt/c/Users/jake9/repos/timelapse-pi/app && npx expo start
```

The ConnectionProvider should discover the mock server at localhost:8000 and show the Dashboard.

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/DashboardScreen.tsx
git commit -m "feat: implement dashboard screen with status display and capture controls"
```

---

## Task 6: Preview Screen

**Files:**
- Modify: `app/src/screens/PreviewScreen.tsx`

- [ ] **Step 1: Implement Preview screen**

Replace `app/src/screens/PreviewScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePreview } from '../hooks/usePreview';
import { useCaptureNow } from '../hooks/useCapture';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { colors, spacing, typography } from '../theme';

const ISO_VALUES = [100, 200, 400, 800, 1600];
const AWB_MODES = ['auto', 'daylight', 'cloudy', 'tungsten', 'fluorescent'];
const EXPOSURE_MODES = ['auto', 'manual'];

export function PreviewScreen() {
  const isFocused = useIsFocused();
  const imageUri = usePreview(isFocused);
  const captureNow = useCaptureNow();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const camera = (settings as any)?.camera || { iso: 100, exposure_mode: 'auto', awb_mode: 'auto' };

  const updateCamera = (key: string, value: unknown) => {
    updateSettings.mutate({ camera: { [key]: value } });
  };

  return (
    <View style={styles.container}>
      {/* Preview image */}
      <View style={styles.previewContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.placeholderText}>Starting preview...</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        {/* ISO */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>ISO</Text>
          <View style={styles.chipRow}>
            {ISO_VALUES.map(iso => (
              <TouchableOpacity
                key={iso}
                style={[styles.chip, camera.iso === iso && styles.chipActive]}
                onPress={() => updateCamera('iso', iso)}
              >
                <Text style={[styles.chipText, camera.iso === iso && styles.chipTextActive]}>{iso}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exposure Mode */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Exposure</Text>
          <View style={styles.chipRow}>
            {EXPOSURE_MODES.map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, camera.exposure_mode === mode && styles.chipActive]}
                onPress={() => updateCamera('exposure_mode', mode)}
              >
                <Text style={[styles.chipText, camera.exposure_mode === mode && styles.chipTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* White Balance */}
        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>White Balance</Text>
          <View style={styles.chipRow}>
            {AWB_MODES.map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, camera.awb_mode === mode && styles.chipActive]}
                onPress={() => updateCamera('awb_mode', mode)}
              >
                <Text style={[styles.chipText, camera.awb_mode === mode && styles.chipTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Capture button */}
        <TouchableOpacity
          style={styles.captureButton}
          onPress={() => captureNow.mutate()}
          disabled={captureNow.isPending}
        >
          <Text style={styles.captureButtonText}>
            {captureNow.isPending ? 'Capturing...' : 'Capture Still'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  previewContainer: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#000' },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: colors.textMuted },
  controls: { flex: 1 },
  controlsContent: { padding: spacing.lg },
  controlRow: { marginBottom: spacing.lg },
  controlLabel: { ...typography.label, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  captureButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center', marginTop: spacing.md },
  captureButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/PreviewScreen.tsx
git commit -m "feat: implement preview screen with 1fps polling and camera controls"
```

---

## Task 7: Gallery — Batch List + Batch Detail + Image Viewer

**Files:**
- Modify: `app/src/screens/gallery/BatchListScreen.tsx`
- Create: `app/src/screens/gallery/BatchDetailScreen.tsx`
- Create: `app/src/screens/gallery/ImageViewerScreen.tsx`
- Create: `app/src/components/BatchCard.tsx`
- Create: `app/src/components/ImageThumbnail.tsx`
- Create: `app/src/services/storage.ts`
- Modify: `app/src/navigation/AppNavigator.tsx` (add gallery stack)

- [ ] **Step 1: Create storage service for batch downloads**

Create `app/src/services/storage.ts`:

```typescript
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
```

- [ ] **Step 2: Create BatchCard component**

Create `app/src/components/BatchCard.tsx`:

```tsx
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { BatchSummary } from '../api/client';
import { api } from '../api/client';
import { colors, spacing, typography } from '../theme';

interface Props {
  batch: BatchSummary;
  onPress: () => void;
}

export function BatchCard({ batch, onPress }: Props) {
  const thumbUri = batch.image_count > 0 && batch.first_capture
    ? api.thumbUrl(batch.id, batch.first_capture.replace('.jpg', ''))
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.thumbContainer}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbPlaceholderText}>No images</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{batch.name}</Text>
        <Text style={styles.count}>{batch.image_count} images</Text>
        {batch.created && (
          <Text style={styles.date}>{new Date(batch.created).toLocaleDateString()}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden', marginBottom: spacing.md },
  thumbContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  thumbPlaceholderText: { color: colors.textMuted, fontSize: 13 },
  info: { padding: spacing.md },
  name: { ...typography.subtitle, marginBottom: spacing.xs },
  count: { ...typography.caption },
  date: { ...typography.caption, marginTop: 2 },
});
```

- [ ] **Step 3: Create ImageThumbnail component**

Create `app/src/components/ImageThumbnail.tsx`:

```tsx
import React from 'react';
import { Image, TouchableOpacity, View, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

interface Props {
  uri: string;
  selected?: boolean;
  selectionMode?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ImageThumbnail({ uri, selected, selectionMode, onPress, onLongPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.selected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <Image source={{ uri }} style={styles.image} />
      {selectionMode && (
        <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
          {selected && <View style={styles.checkmark} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', marginBottom: spacing.xs },
  selected: { borderWidth: 2, borderColor: colors.primary },
  image: { width: '100%', height: '100%' },
  checkbox: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.3)' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', alignSelf: 'center', marginTop: 4 },
});
```

- [ ] **Step 4: Implement BatchListScreen**

Replace `app/src/screens/gallery/BatchListScreen.tsx`:

```tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useBatches } from '../../hooks/useBatches';
import { BatchCard } from '../../components/BatchCard';
import { colors, spacing, typography } from '../../theme';

export function BatchListScreen({ navigation }: any) {
  const { data: batches, isPending, refetch } = useBatches();

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={batches || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <BatchCard
            batch={item}
            onPress={() => navigation.navigate('BatchDetail', { batchId: item.id, batchName: item.name })}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.title}>Gallery</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No batches yet</Text>}
        onRefresh={refetch}
        refreshing={isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, marginBottom: spacing.lg },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
```

- [ ] **Step 5: Implement BatchDetailScreen**

Create `app/src/screens/gallery/BatchDetailScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useBatchDetail, useRenameBatch, useDeleteBatch } from '../../hooks/useBatches';
import { ImageThumbnail } from '../../components/ImageThumbnail';
import { downloadBatchImages, DownloadProgress } from '../../services/storage';
import { api } from '../../api/client';
import { colors, spacing, typography } from '../../theme';

export function BatchDetailScreen({ route, navigation }: any) {
  const { batchId, batchName } = route.params;
  const { data: batch, isPending } = useBatchDetail(batchId);
  const renameBatch = useRenameBatch();
  const deleteBatch = useDeleteBatch();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = (imageId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  const handleDownload = async () => {
    if (!batch) return;
    const ids = selectedIds.size > 0
      ? Array.from(selectedIds)
      : batch.images.map(img => img.id);

    setDownloading(true);
    try {
      await downloadBatchImages(batchId, batch.name, ids, setDownloadProgress);
      Alert.alert('Download Complete', `${ids.length} images saved to phone`);
      setSelectedIds(new Set());
    } catch (e: any) {
      Alert.alert('Download Failed', e.message);
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Batch', `Delete "${batchName}" and all ${batch?.image_count} images?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteBatch.mutate(batchId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleRename = () => {
    Alert.prompt('Rename Batch', 'Enter new name:', (name: string) => {
      if (name.trim()) renameBatch.mutate({ batchId, name: name.trim() });
    }, 'plain-text', batchName);
  };

  if (isPending || !batch) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{batch.name}</Text>
        <Text style={styles.count}>{batch.image_count} images</Text>
      </View>

      {/* Action bar */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRename}>
          <Text style={styles.actionText}>Rename</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.downloadBtn]}
          onPress={handleDownload}
          disabled={downloading}
        >
          <Text style={styles.actionText}>
            {downloading
              ? `${downloadProgress?.completed}/${downloadProgress?.total}`
              : selectedIds.size > 0
                ? `Download (${selectedIds.size})`
                : 'Download All'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Image grid */}
      <FlatList
        data={batch.images}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <ImageThumbnail
            uri={api.thumbUrl(batchId, item.id)}
            selected={selectedIds.has(item.id)}
            selectionMode={selectionMode}
            onPress={() => {
              if (selectionMode) {
                toggleSelect(item.id);
              } else {
                navigation.navigate('ImageViewer', { batchId, imageId: item.id });
              }
            }}
            onLongPress={() => toggleSelect(item.id)}
          />
        )}
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  back: { color: colors.primary, fontSize: 16, marginBottom: spacing.sm },
  title: { ...typography.title, fontSize: 22 },
  count: { ...typography.caption, marginTop: spacing.xs },
  actions: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  downloadBtn: { backgroundColor: colors.primary, flex: 1, alignItems: 'center' },
  deleteBtn: { backgroundColor: colors.error },
  actionText: { color: '#fff', fontWeight: '500', fontSize: 13 },
  grid: { paddingHorizontal: spacing.lg },
  row: { justifyContent: 'space-between' },
});
```

- [ ] **Step 6: Implement ImageViewerScreen**

Create `app/src/screens/gallery/ImageViewerScreen.tsx`:

```tsx
import React from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { api } from '../../api/client';
import { colors, spacing } from '../../theme';

const { width, height } = Dimensions.get('window');

export function ImageViewerScreen({ route, navigation }: any) {
  const { batchId, imageId } = route.params;
  const imageUri = api.imageUrl(batchId, imageId);

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
      <View style={styles.footer}>
        <Text style={styles.imageId}>{imageId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  image: { width, height: height * 0.8 },
  closeButton: { position: 'absolute', top: 50, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#fff', fontSize: 18 },
  footer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  imageId: { color: colors.textSecondary, fontSize: 14 },
});
```

- [ ] **Step 7: Update AppNavigator with gallery stack**

Replace `app/src/navigation/AppNavigator.tsx`:

```tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useConnection } from '../providers/ConnectionProvider';
import { ConnectionBar } from '../components/ConnectionBar';
import { ConnectionScreen } from '../screens/ConnectionScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { BatchListScreen } from '../screens/gallery/BatchListScreen';
import { BatchDetailScreen } from '../screens/gallery/BatchDetailScreen';
import { ImageViewerScreen } from '../screens/gallery/ImageViewerScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const GalleryStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { Dashboard: '📊', Preview: '📷', Gallery: '🖼️', Settings: '⚙️' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] || '•'}</Text>;
}

function GalleryStackScreen() {
  return (
    <GalleryStack.Navigator screenOptions={{ headerShown: false }}>
      <GalleryStack.Screen name="BatchList" component={BatchListScreen} />
      <GalleryStack.Screen name="BatchDetail" component={BatchDetailScreen} />
      <GalleryStack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
    </GalleryStack.Navigator>
  );
}

function MainTabs() {
  return (
    <>
      <ConnectionBar />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
          tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.surfaceLight },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Preview" component={PreviewScreen} />
        <Tab.Screen name="Gallery" component={GalleryStackScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </>
  );
}

export function AppNavigator() {
  const { state } = useConnection();

  if (state !== 'connected') {
    return <ConnectionScreen />;
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainTabs} />
    </RootStack.Navigator>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add app/src/screens/gallery/ app/src/components/ app/src/services/storage.ts app/src/navigation/
git commit -m "feat: implement gallery with batch list, detail, image viewer, and download"
```

---

## Task 8: Settings Screen

**Files:**
- Modify: `app/src/screens/settings/SettingsScreen.tsx`
- Create: `app/src/screens/settings/NetworkScreen.tsx`
- Modify: `app/src/navigation/AppNavigator.tsx` (add settings stack)

- [ ] **Step 1: Implement SettingsScreen**

Replace `app/src/screens/settings/SettingsScreen.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Switch, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { colors, spacing, typography } from '../../theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function SettingsScreen({ navigation }: any) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [localSettings, setLocalSettings] = useState<any>(null);

  useEffect(() => {
    if (settings && !localSettings) setLocalSettings(settings);
  }, [settings, localSettings]);

  if (!localSettings) return null;

  const save = (path: string, value: unknown) => {
    const keys = path.split('.');
    const update: any = {};
    let current = update;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    updateSettings.mutate(update);

    // Update local state
    const newLocal = JSON.parse(JSON.stringify(localSettings));
    let ref = newLocal;
    for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]];
    ref[keys[keys.length - 1]] = value;
    setLocalSettings(newLocal);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <Section title="CAPTURE">
        <SettingRow label="Software Interval (sec)">
          <TextInput
            style={styles.input}
            value={String(localSettings.software_interval_sec)}
            onChangeText={v => save('software_interval_sec', parseInt(v, 10) || 0)}
            keyboardType="numeric"
          />
        </SettingRow>
        <SettingRow label="Hardware Interval (sec)">
          <Text style={styles.readOnly}>{localSettings.hardware_interval_sec}</Text>
        </SettingRow>
      </Section>

      <Section title="CAMERA DEFAULTS">
        <SettingRow label="ISO">
          <TextInput
            style={styles.input}
            value={String(localSettings.camera?.iso)}
            onChangeText={v => save('camera.iso', parseInt(v, 10) || 100)}
            keyboardType="numeric"
          />
        </SettingRow>
        <SettingRow label="Exposure Mode">
          <Text style={styles.readOnly}>{localSettings.camera?.exposure_mode}</Text>
        </SettingRow>
        <SettingRow label="AWB Mode">
          <Text style={styles.readOnly}>{localSettings.camera?.awb_mode}</Text>
        </SettingRow>
      </Section>

      <Section title="LOCATION & DAYLIGHT">
        <SettingRow label="Latitude">
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lat)}
            onChangeText={v => save('location.lat', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <SettingRow label="Longitude">
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lon)}
            onChangeText={v => save('location.lon', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <SettingRow label="Daylight Only">
          <Switch
            value={localSettings.daylight_only}
            onValueChange={v => save('daylight_only', v)}
            trackColor={{ true: colors.primary }}
          />
        </SettingRow>
        <SettingRow label="Window Start">
          <TextInput
            style={styles.input}
            value={localSettings.window_start}
            onChangeText={v => save('window_start', v)}
          />
        </SettingRow>
        <SettingRow label="Window End">
          <TextInput
            style={styles.input}
            value={localSettings.window_end}
            onChangeText={v => save('window_end', v)}
          />
        </SettingRow>
      </Section>

      <Section title="DEVICE">
        <SettingRow label="Battery (mAh)">
          <TextInput
            style={styles.input}
            value={String(localSettings.battery_mah)}
            onChangeText={v => save('battery_mah', parseInt(v, 10) || 0)}
            keyboardType="numeric"
          />
        </SettingRow>
      </Section>

      <Section title="NETWORK">
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('Network')}
        >
          <Text style={styles.navButtonText}>WiFi Management →</Text>
        </TouchableOpacity>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.label, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceLight },
  rowLabel: { ...typography.body, flex: 1 },
  input: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, textAlign: 'right', width: 100 },
  readOnly: { color: colors.textSecondary, fontSize: 14 },
  navButton: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  navButtonText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 2: Implement NetworkScreen**

Create `app/src/screens/settings/NetworkScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNetworkStatus, useWifiScan, useWifiConnect, useStartAP, useSavedNetworks, useRemoveSavedNetwork } from '../../hooks/useNetwork';
import { colors, spacing, typography } from '../../theme';

export function NetworkScreen({ navigation }: any) {
  const { data: netStatus } = useNetworkStatus();
  const { data: networks, refetch: scan, isFetching: scanning } = useWifiScan();
  const { data: saved } = useSavedNetworks();
  const wifiConnect = useWifiConnect();
  const startAP = useStartAP();
  const removeSaved = useRemoveSavedNetwork();
  const [password, setPassword] = useState('');
  const [selectedSsid, setSelectedSsid] = useState<string | null>(null);

  const handleConnect = () => {
    if (!selectedSsid) return;
    wifiConnect.mutate({ ssid: selectedSsid, password });
    Alert.alert('Connecting', `Connecting to ${selectedSsid}...\nThe app will reconnect shortly.`);
    setSelectedSsid(null);
    setPassword('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Network</Text>
      </View>

      {/* Current status */}
      {netStatus && (
        <View style={styles.statusCard}>
          <Text style={styles.label}>CURRENT CONNECTION</Text>
          <Text style={styles.statusText}>
            {netStatus.mode === 'ap' ? `AP Mode: ${netStatus.ssid}` : `Connected: ${netStatus.ssid}`}
          </Text>
          <Text style={styles.statusIp}>IP: {netStatus.ip}</Text>
          {netStatus.signal_strength && (
            <Text style={styles.statusIp}>Signal: {netStatus.signal_strength} dBm</Text>
          )}
        </View>
      )}

      {/* Scan */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>AVAILABLE NETWORKS</Text>
          <TouchableOpacity onPress={() => scan()} disabled={scanning}>
            <Text style={styles.scanBtn}>{scanning ? 'Scanning...' : 'Scan'}</Text>
          </TouchableOpacity>
        </View>
        {networks && networks.map(net => (
          <TouchableOpacity
            key={net.ssid}
            style={[styles.networkRow, selectedSsid === net.ssid && styles.networkSelected]}
            onPress={() => setSelectedSsid(net.ssid === selectedSsid ? null : net.ssid)}
          >
            <Text style={styles.networkSsid}>{net.ssid}</Text>
            <Text style={styles.networkSignal}>{net.signal} dBm</Text>
            <Text style={styles.networkSec}>{net.security}</Text>
          </TouchableOpacity>
        ))}

        {selectedSsid && (
          <View style={styles.connectForm}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity style={styles.connectBtn} onPress={handleConnect}>
              <Text style={styles.connectBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Saved networks */}
      <View style={styles.section}>
        <Text style={styles.label}>SAVED NETWORKS</Text>
        {saved && saved.map((net: any) => (
          <View key={net.ssid} style={styles.savedRow}>
            <Text style={styles.networkSsid}>{net.ssid}</Text>
            <TouchableOpacity onPress={() => removeSaved.mutate(net.ssid)}>
              <Text style={styles.removeBtn}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* AP Mode */}
      <TouchableOpacity
        style={styles.apButton}
        onPress={() => {
          Alert.alert('Start AP Mode', 'This will disconnect from WiFi and start the Pi hotspot.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Start AP', onPress: () => startAP.mutate({}) },
          ]);
        }}
      >
        <Text style={styles.apButtonText}>Switch to AP Mode</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  back: { color: colors.primary, fontSize: 16, marginBottom: spacing.sm },
  title: { ...typography.title, fontSize: 24 },
  statusCard: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  statusText: { ...typography.subtitle, marginTop: spacing.xs },
  statusIp: { ...typography.caption, marginTop: 2 },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  label: { ...typography.label },
  scanBtn: { color: colors.primary, fontSize: 14, fontWeight: '500' },
  networkRow: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  networkSelected: { borderWidth: 1, borderColor: colors.primary },
  networkSsid: { ...typography.body, flex: 1 },
  networkSignal: { ...typography.caption, marginRight: spacing.md },
  networkSec: { ...typography.caption, width: 50 },
  connectForm: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  input: { flex: 1, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  connectBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, borderRadius: 8, justifyContent: 'center' },
  connectBtnText: { color: '#fff', fontWeight: '600' },
  savedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.surfaceLight },
  removeBtn: { color: colors.error, fontSize: 13 },
  apButton: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.warning },
  apButtonText: { color: colors.warning, fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 3: Add Network to navigation stack**

In `app/src/navigation/AppNavigator.tsx`, add after the existing imports:

```tsx
import { NetworkScreen } from '../screens/settings/NetworkScreen';
```

Add a SettingsStack navigator (same pattern as GalleryStack):

```tsx
const SettingsStack = createNativeStackNavigator();

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
      <SettingsStack.Screen name="Network" component={NetworkScreen} />
    </SettingsStack.Navigator>
  );
}
```

In MainTabs, replace the Settings Tab.Screen:

```tsx
<Tab.Screen name="Settings" component={SettingsStackScreen} />
```

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/settings/ app/src/navigation/
git commit -m "feat: implement settings screen with network management"
```

---

## Task 9: Render Modal (Video Encoding + Export)

**Files:**
- Create: `app/src/screens/render/RenderModal.tsx`
- Create: `app/src/services/renderer.ts`
- Modify: `app/src/navigation/AppNavigator.tsx` (add render modal)
- Modify: `app/src/screens/gallery/BatchDetailScreen.tsx` (add render button)

- [ ] **Step 1: Create renderer service**

Create `app/src/services/renderer.ts`:

```typescript
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
```

- [ ] **Step 2: Create RenderModal**

Create `app/src/screens/render/RenderModal.tsx`:

```tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { renderTimelapse, saveToPhotos, RenderProgress } from '../../services/renderer';
import { getLocalBatchImages } from '../../services/storage';
import { colors, spacing, typography } from '../../theme';

interface Props {
  batchPath: string;
  batchName: string;
  imageCount: number;
  onClose: () => void;
}

export function RenderModal({ batchPath, batchName, imageCount, onClose }: Props) {
  const [fps, setFps] = useState(24);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  const estimatedDuration = imageCount / fps;
  const resolution = { width: 1920, height: 1440 }; // 4:3 aspect

  const handleRender = async () => {
    setRendering(true);
    try {
      const images = await getLocalBatchImages(batchPath);
      if (images.length === 0) {
        Alert.alert('No Images', 'Download images to your phone first');
        setRendering(false);
        return;
      }
      const path = await renderTimelapse(images, { fps, ...resolution }, setProgress);
      setOutputPath(path);
    } catch (e: any) {
      Alert.alert('Render Failed', e.message);
    } finally {
      setRendering(false);
    }
  };

  const handleSave = async () => {
    if (!outputPath) return;
    try {
      await saveToPhotos(outputPath);
      Alert.alert('Saved', 'Timelapse video saved to Photos');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Render Timelapse</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.batchName}>{batchName}</Text>
        <Text style={styles.info}>{imageCount} frames</Text>

        {!outputPath ? (
          <>
            {/* FPS slider */}
            <View style={styles.control}>
              <Text style={styles.label}>FPS: {fps}</Text>
              <Slider
                minimumValue={12}
                maximumValue={60}
                step={1}
                value={fps}
                onValueChange={setFps}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.surfaceLight}
                thumbTintColor={colors.primary}
              />
              <Text style={styles.estimate}>
                Duration: {estimatedDuration.toFixed(1)}s at {fps}fps
              </Text>
            </View>

            {/* Resolution */}
            <View style={styles.control}>
              <Text style={styles.label}>Resolution: {resolution.width}×{resolution.height}</Text>
            </View>

            {/* Render button */}
            {rendering ? (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.progressText}>
                  {progress?.stage === 'preparing' ? 'Preparing frames...' :
                   progress?.stage === 'rendering' ? 'Rendering video...' :
                   'Saving...'}
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress?.percent || 0}%` }]} />
                </View>
                <Text style={styles.progressPercent}>{progress?.percent || 0}%</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.renderButton} onPress={handleRender}>
                <Text style={styles.renderButtonText}>Render Timelapse</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.doneText}>Render complete!</Text>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save to Google Photos</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.background, borderRadius: 16, padding: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.title },
  close: { color: colors.textMuted, fontSize: 22 },
  batchName: { ...typography.subtitle, marginBottom: spacing.xs },
  info: { ...typography.caption, marginBottom: spacing.lg },
  control: { marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm },
  estimate: { ...typography.caption, marginTop: spacing.xs },
  progressContainer: { alignItems: 'center', paddingVertical: spacing.lg },
  progressText: { color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  progressBar: { width: '100%', height: 4, backgroundColor: colors.surfaceLight, borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  progressPercent: { ...typography.caption, marginTop: spacing.xs },
  renderButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  renderButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  doneText: { ...typography.subtitle, color: colors.success, textAlign: 'center', marginBottom: spacing.lg },
  saveButton: { backgroundColor: colors.success, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
```

- [ ] **Step 3: Add render button to BatchDetailScreen**

In `app/src/screens/gallery/BatchDetailScreen.tsx`, add a "Render" button to the action bar. Add state:

```typescript
const [showRender, setShowRender] = useState(false);
```

Add import at top:

```typescript
import { RenderModal } from '../render/RenderModal';
import { ensureBatchDir } from '../../services/storage';
```

Add the render button in the actions View (after the download button):

```tsx
<TouchableOpacity
  style={[styles.actionBtn, { backgroundColor: colors.warning }]}
  onPress={() => setShowRender(true)}
>
  <Text style={styles.actionText}>Render</Text>
</TouchableOpacity>
```

Add the modal at the end of the component return (before the closing `</View>`):

```tsx
{showRender && (
  <View style={StyleSheet.absoluteFill}>
    <RenderModal
      batchPath={`${FileSystem.documentDirectory}TimelapsePi/${batch.name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/ /g, '_')}/`}
      batchName={batch.name}
      imageCount={batch.image_count}
      onClose={() => setShowRender(false)}
    />
  </View>
)}
```

Add to imports:

```typescript
import * as FileSystem from 'expo-file-system';
```

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/render/ app/src/services/renderer.ts app/src/screens/gallery/BatchDetailScreen.tsx
git commit -m "feat: implement timelapse rendering with ffmpeg-kit and export to Photos"
```

---

## Task 10: Build Custom Dev Client + Final Integration

**Files:**
- Modify: `app/.gitignore`

- [ ] **Step 1: Update .gitignore**

Ensure `app/.gitignore` includes:

```
node_modules/
.expo/
dist/
*.apk
*.aab
*.ipa
android/
ios/
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 3: Test with mock server**

```bash
# Terminal 1: start mock server
cd /mnt/c/Users/jake9/repos/timelapse-pi/app/mock-server && node server.js

# Terminal 2: start Expo
cd /mnt/c/Users/jake9/repos/timelapse-pi/app && npx expo start
```

Verify:
- Connection screen appears briefly, then connects to mock server
- Dashboard shows mock status data
- Preview tab shows image (even if tiny — mock returns 1x1 JPEG)
- Gallery tab shows 3 mock batches
- Settings tab shows all config fields
- Network page shows mock network data

Note: ffmpeg-kit and zeroconf features will NOT work until a custom dev client is built. The rest of the app works in Expo Go.

- [ ] **Step 4: Build custom dev client (requires EAS account)**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app
npx eas-cli login
npx eas build --profile development --platform android
```

This builds an APK with the native modules (ffmpeg-kit, zeroconf) included. Install it on your Android phone and test.

- [ ] **Step 5: Final commit**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi
git add app/
git commit -m "feat: finalize app with custom dev client config and integration test"
```

---

## Development Workflow Reference

**Day-to-day development (no Pi needed):**
```bash
# Terminal 1: mock API server
cd app/mock-server && node server.js

# Terminal 2: Expo dev server
cd app && npx expo start
```

**Testing with real Pi (when available):**
1. Ensure Pi is on same network (BYPASS mode)
2. Start API: `ssh timelapse-pi "cd ~/timelapse && venv/bin/uvicorn api.run:app --host 0.0.0.0 --port 8000"`
3. The app's ConnectionProvider will auto-discover the Pi via mDNS or last-known IP

**Building for device:**
```bash
cd app && npx eas build --profile development --platform android
# Install the APK on your phone
# Then: npx expo start --dev-client
```
