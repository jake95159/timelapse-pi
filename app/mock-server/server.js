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
  // Return a sample image or 1x1 JPEG placeholder
  const sampleDir = path.join(__dirname, 'sample-images');
  const files = fs.existsSync(sampleDir) ? fs.readdirSync(sampleDir).filter(f => f.endsWith('.jpg')) : [];
  if (files.length > 0) {
    return res.sendFile(path.join(sampleDir, files[0]));
  }
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
  const sampleDir = path.join(__dirname, 'sample-images');
  const files = fs.existsSync(sampleDir) ? fs.readdirSync(sampleDir).filter(f => f.endsWith('.jpg')) : [];
  if (files.length > 0) {
    const idx = Math.abs(req.params.imageId.hashCode?.() || 0) % files.length || 0;
    return res.sendFile(path.join(sampleDir, files[idx] || files[0]));
  }
  const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=', 'base64');
  res.set('Content-Type', 'image/jpeg');
  res.send(buf);
});

app.get('/api/batches/:batchId/images/:imageId/thumb', (req, res) => {
  const sampleDir = path.join(__dirname, 'sample-images');
  const files = fs.existsSync(sampleDir) ? fs.readdirSync(sampleDir).filter(f => f.endsWith('.jpg')) : [];
  if (files.length > 0) {
    return res.sendFile(path.join(sampleDir, files[0]));
  }
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
