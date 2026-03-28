# Sprint 2 Design: FastAPI Backend + React Native App

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Pi-side FastAPI REST API + Expo React Native mobile app for timelapse camera control

---

## 1. Overview

Sprint 2 adds two components to the timelapse-pi project:

1. **FastAPI REST API** on the Pi — serves status, settings, images, and controls capture/networking in BYPASS mode
2. **React Native (Expo) mobile app** — polished, consumer-grade UX for controlling the Pi from a phone

The Pi operates in two modes:
- **AUTO:** Boot → capture → DONE → power off. No networking, no API. Sprint 1 script unchanged.
- **BYPASS:** Always-on. API server + WiFi manager start. Capture loop controlled by the app.

---

## 2. Hardware Mod: Mode Detection (GPIO27)

The Pi detects AUTO vs BYPASS by reading the DPDT switch position via a new GPIO pin.

**Wiring:**
- Tap SparkFun VDD (DPDT Pin 3 or SparkFun board VDD pin — same wire)
- 10kΩ series resistor from tap → GPIO27 (Pi header physical pin 13)
- 10kΩ pull-down resistor from GPIO27 → GND (Pi header physical pin 14)

**How it works:**
- AUTO mode: SparkFun VDD = 5V → voltage divider → GPIO27 reads ~2.5V → **HIGH**
- BYPASS mode: SparkFun VDD = floating (Pin 3 → Pin 5 NC) → pull-down → GPIO27 reads 0V → **LOW**

**Boot config addition:**
```
gpio=27=pd
```

**Software read:**
```python
import lgpio
h = lgpio.gpiochip_open(0)
lgpio.gpio_claim_input(h, 27, lgpio.SET_PULL_DOWN)
mode = "auto" if lgpio.gpio_read(h, 27) == 1 else "bypass"
lgpio.gpiochip_close(h)
```

---

## 3. Pi-Side Architecture

### 3.1 Boot Sequence (systemd)

```
timelapse-mode.service (oneshot, early boot)
  │
  ├─ Read GPIO27
  │
  ├─ AUTO (HIGH) ──→ start timelapse-auto.service
  │                    └─ capture_auto.py → DONE → power off
  │
  └─ BYPASS (LOW) ─→ start timelapse-bypass.target
                       ├─ timelapse-wifi.service (WiFi manager)
                       └─ timelapse-api.service (FastAPI, after WiFi)
```

- AUTO path runs the existing Sprint 1 `capture_auto.py` unchanged
- BYPASS path starts networking first, then the API server
- The capture loop does NOT auto-start in BYPASS — user starts it from the app

### 3.2 Project Structure

```
pi/
  capture_auto.py              # Sprint 1 AUTO capture (unchanged)
  api/
    main.py                    # FastAPI app + Uvicorn entrypoint
    routers/
      status.py                # GET /api/status
      settings.py              # GET/PATCH /api/settings
      capture.py               # POST /api/capture, capture loop start/stop
      preview.py               # GET /api/preview
      batches.py               # Batch CRUD, split, merge, image serving
      network.py               # WiFi status, scan, connect, AP
    services/
      camera.py                # picamera2 wrapper with lock (shared by preview + capture)
      capture_loop.py          # BYPASS software-timed capture (start/stop)
      batch_manager.py         # Batch creation, naming, split/merge (filesystem ops)
      wifi_manager.py          # AP/client switching, network scanning
      config.py                # Read/write tl_config.json
    models.py                  # Pydantic request/response models
  systemd/
    timelapse-mode.service     # Boot mode detection (GPIO27)
    timelapse-auto.service     # AUTO capture (existing, updated)
    timelapse-api.service      # BYPASS: FastAPI server
    timelapse-wifi.service     # BYPASS: WiFi manager
    timelapse-bypass.target    # BYPASS: target grouping API + WiFi
  wifi/
    setup-ap.sh                # Start hostapd + dnsmasq
    setup-client.sh            # Connect to saved network
```

### 3.3 Camera Sharing

The picamera2 camera is a shared resource. `camera.py` wraps it with a threading lock:
- Preview endpoint acquires lock, grabs a frame, releases
- Capture (single shot or loop iteration) acquires lock, captures full-res, releases
- Preview is paused during capture — the app sees a brief freeze, then resumes

### 3.4 Batch Management (Filesystem-Based)

Batches are directories on disk — the filesystem IS the source of truth.

```
~/timelapse/images/
  batch_001_2026-03-28/
    capture_00001.jpg
    capture_00002.jpg
    ...
  batch_002_2026-04-05/
    capture_00045.jpg
    ...
```

- **New batch:** Created automatically when a capture loop starts, or on first AUTO capture after a settings change. Directory name: `batch_{seq}_{date}`
- **Rename:** Renames the directory on disk
- **Split:** Physically moves files after the split point into a new directory
- **Merge:** Physically moves files from the second batch into the first's directory
- **Delete:** Removes the directory and all images
- **Metadata sidecar:** Each batch directory contains a `batch.json` with display name, creation time, and notes. The batch list endpoint reads these.

Thumbnails are generated on capture (resized to ~300px wide) and stored alongside the originals as `capture_00001_thumb.jpg`.

---

## 4. REST API Specification

**Base URL:** `http://<pi-address>:8000/api`

### 4.1 Status

```
GET /api/status
→ {
    "mode": "auto" | "bypass",
    "capture_state": "idle" | "running" | "stopped",
    "capture_count": 142,
    "last_capture": { "image_id": "capture_00142", "batch_id": "batch_002_2026-04-05", "timestamp": "..." },
    "storage_used_pct": 23.4,
    "storage_free_mb": 14200,
    "battery_mah": 9700,
    "runtime_estimate_hours": 150.0,
    "software_interval_sec": 60,
    "hardware_interval_sec": 3600,
    "uptime_sec": 3421
  }
```

### 4.2 Settings

```
GET /api/settings
→ full tl_config.json contents

PATCH /api/settings
← { "software_interval_sec": 10 }  (partial update — only changed fields)
→ updated tl_config.json
```

### 4.3 Capture

```
POST /api/capture
→ { "image_id": "capture_00143", "batch_id": "batch_002_2026-04-05", "sequence": 143 }

POST /api/capture/loop/start
← { "interval_sec": 30 }
→ { "status": "started" }
(BYPASS only. Returns 409 if in AUTO mode.)

POST /api/capture/loop/stop
→ { "status": "stopped", "capture_count": 47 }
```

### 4.4 Preview

```
GET /api/preview
→ JPEG binary (current camera frame, reduced resolution)
(App polls at ~1fps. Camera settings from tl_config.json apply.)
```

### 4.5 Batches

```
GET /api/batches
→ [ { "id": "batch_001_2026-03-28", "name": "Garden Sprouting", "image_count": 44,
       "first_capture": "...", "last_capture": "...", "thumbnail_url": "/api/batches/batch_001_2026-03-28/images/capture_00001/thumb" } ]

GET /api/batches/{id}
→ { "id": "...", "name": "...", "images": [ { "id": "capture_00001", "sequence": 1, "timestamp": "...", "size_bytes": 8234567 } ] }

PATCH /api/batches/{id}
← { "name": "Garden Sprouting" }
→ { "id": "batch_001_2026-03-28", "name": "Garden Sprouting" }
(Renames directory on disk)

POST /api/batches/{id}/split
← { "after_image_id": "capture_00020" }
→ { "batch_a": { ... }, "batch_b": { ... } }
(Physically moves files after split point into new directory)

POST /api/batches/merge
← { "batch_ids": ["batch_001_2026-03-28", "batch_002_2026-04-05"] }
→ { "merged_batch": { ... } }
(Physically consolidates files into first batch's directory)

DELETE /api/batches/{id}
→ { "deleted_count": 44 }
(Removes directory and all images)
```

### 4.6 Images

Images are accessed within the context of their batch:

```
GET /api/batches/{batch_id}/images/{image_id}
→ full-resolution JPEG binary

GET /api/batches/{batch_id}/images/{image_id}/thumb
→ thumbnail JPEG binary (~300px wide)
```

This avoids a global image ID lookup across batch directories. The app always knows which batch it's browsing, so it naturally has both IDs.

### 4.7 Network

```
GET /api/network/status
→ { "mode": "ap" | "client", "ssid": "TimelapsePi", "ip": "10.42.0.1", "signal_strength": null }

GET /api/network/scan
→ [ { "ssid": "HomeNetwork", "signal": -45, "security": "WPA2" } ]

POST /api/network/connect
← { "ssid": "HomeNetwork", "password": "..." }
→ { "status": "connecting" }
(Pi switches to client mode. App loses connection briefly, rediscovers via mDNS.)

POST /api/network/ap
← { "ssid": "TimelapsePi", "password": "timelapse" }  (optional — uses defaults if omitted)
→ { "status": "activating" }

GET /api/network/saved
→ [ { "ssid": "HomeNetwork", "priority": 1 } ]

DELETE /api/network/saved/{ssid}
→ { "status": "removed" }
```

---

## 5. Mobile App Architecture

### 5.1 Tech Stack

- **Framework:** React Native with Expo (managed workflow)
- **Navigation:** React Navigation — bottom tab navigator (4 tabs) + stack navigators per tab
- **State management:** React Context for connection state + React Query for API data fetching/caching
- **Local storage:** Expo FileSystem (images/batches) + AsyncStorage (small state/preferences)
- **Video rendering:** ffmpeg-kit-react-native (phone-side H.264 encoding)
- **Photos export:** Expo MediaLibrary (save rendered videos to Google Photos)
- **Platform:** Android primary, iOS-compatible by default (Expo cross-platform)

### 5.2 Connection Layer

The app wraps all screens in a `ConnectionProvider` that manages Pi discovery:

1. **On launch:** Try mDNS (`timelapse-pi.local:8000`) → try AP gateway (`10.42.0.1:8000`) → show connection screen
2. **Heartbeat:** Poll `GET /api/status` every 5 seconds. If 3 consecutive failures → `disconnected`
3. **Connection bar:** Persistent bar at top of every screen. Green = connected. Red = disconnected (tap to reconnect)
4. **Network switch handling:** When `POST /network/connect` is called, app expects disconnection. Shows "Reconnecting on new network..." and retries mDNS discovery for up to 30 seconds before falling back to connection screen

### 5.3 Navigation Structure

```
Bottom Tabs
  ├─ Dashboard (📊)
  │    └─ Status overview, capture controls (Start/Stop loop, Capture Now)
  ├─ Preview (📷)
  │    └─ 1fps camera feed, ISO/exposure/AWB controls, Capture Still button
  ├─ Gallery (🖼️)
  │    ├─ Batches list (cards with name, date range, count, thumbnail)
  │    ├─ Batch detail → image thumbnail grid
  │    │    ├─ Image full-screen viewer
  │    │    └─ Multi-select → Download to phone
  │    └─ Render flow (modal)
  │         ├─ Configure: FPS, resolution, preview first/last frame
  │         ├─ Render: progress bar
  │         └─ Export: preview video, Save to Google Photos, Share
  └─ Settings (⚙️)
       ├─ Capture: software interval, hardware interval (display), camera defaults
       ├─ Location & Daylight: lat/lon, daylight-only toggle, time window
       ├─ Device: battery capacity, storage management
       └─ Network: WiFi mode, scan/join, AP config, saved networks
```

### 5.4 Offline Behavior

- **Disconnected from Pi:** App shows cached last-known status, downloaded batches are fully browsable, but all actions (capture, settings changes, network config) require a live connection
- **No Pi data cached yet (first launch):** Connection screen only — no cached state to show

### 5.5 Image Storage on Phone

Images are stored in Expo's `documentDirectory` in a structured hierarchy:

```
TimelapsePi/
  2026-03-28_garden-sprouting/
    capture_00001.jpg
    capture_00002.jpg
    ...
  2026-04-05_sunset-deck/
    capture_00145.jpg
    ...
```

- Directory names match batch names (renaming a batch renames the directory)
- USB-accessible on Android when phone is connected to a computer
- Rendered videos are NOT stored here — they go to Google Photos / camera roll via MediaLibrary

### 5.6 Download Flow

1. User selects images (or full batch) in Gallery
2. Taps "Download to phone"
3. App creates/reuses batch directory in `documentDirectory`
4. Downloads images sequentially from `GET /api/batches/{batch_id}/images/{id}` with progress bar
5. Files land in the named batch directory, immediately USB-accessible

### 5.7 Render Flow (Phone-Side)

1. User selects a downloaded batch (or sub-selection) in Gallery
2. Taps "Render Timelapse" → modal opens
3. Configure: FPS (slider 12–60), output resolution, estimated duration shown
4. Render: `ffmpeg-kit-react-native` encodes H.264 MP4 from local JPEGs, progress bar shown
5. Preview rendered video in-app
6. "Save to Photos" → Expo MediaLibrary → appears in Google Photos

---

## 6. WiFi Manager

### 6.1 Startup (BYPASS Mode Only)

1. Read saved networks from system network config
2. Attempt each saved network (15s timeout per network)
3. If any succeeds → client mode, advertise `timelapse-pi.local` via Avahi/mDNS
4. If all fail → AP mode

### 6.2 AP Mode Configuration

- **Implementation:** hostapd + dnsmasq
- **Default SSID:** "TimelapsePi" (configurable via `tl_config.json`)
- **Default password:** "timelapse" (configurable)
- **Gateway:** 10.42.0.1
- **DHCP range:** 10.42.0.10–10.42.0.50
- **DNS:** dnsmasq resolves all domains to 10.42.0.1 (captive portal behavior — keeps phone on WiFi instead of falling back to cellular)

### 6.3 Network Switching

When the app sends `POST /network/connect`:
1. Pi saves credentials to system network config
2. Pi stops hostapd/dnsmasq (if in AP mode)
3. Pi connects to new network
4. Pi advertises via mDNS on new network
5. If connection fails within 30 seconds → fall back to AP mode

The app handles the expected disconnection by showing a "Reconnecting..." state and retrying discovery.

---

## 7. Configuration File

**Path:** `/home/pi/timelapse/tl_config.json`

```json
{
  "location": { "lat": 38.846, "lon": -77.305 },
  "daylight_only": false,
  "window_start": "07:00",
  "window_end": "20:00",
  "hardware_interval_sec": 3600,
  "software_interval_sec": 60,
  "battery_mah": 9700,
  "camera": {
    "iso": 100,
    "exposure_mode": "auto",
    "shutter_speed": null,
    "awb_mode": "auto"
  },
  "ap": {
    "ssid": "TimelapsePi",
    "password": "timelapse"
  }
}
```

Note: `mode` is NOT in the config file — it's read from GPIO27 (hardware truth).

---

## 8. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pi discovery | Fixed AP IP + mDNS | Deterministic in AP mode, standard on home networks |
| Networking in AUTO | Disabled | AUTO boots are ~5s capture cycles — no time for WiFi |
| App visual quality | Consumer-grade UX, no heavy branding | Great in-hand experience without branding busywork |
| Offline behavior | Cached read-only state | Browse last-known data, actions require live connection |
| Image storage | App-managed directories, not camera roll | USB-accessible named batches; rendered videos go to Google Photos |
| Batch model | Auto-batch + manual split/merge/rename | Auto-create on capture start, full flexibility after the fact |
| Batch storage | Filesystem-based (dirs = batches) | Filesystem is truth — no metadata drift, USB view matches app |
| Rendering | Phone-side only | Pi Zero is too slow; phone has better hardware; saves battery |
| Live preview | 1fps snapshot polling | Good enough for framing; simple; low Pi overhead |
| Mode detection | GPIO27 hardware read | Instant, authoritative, no config sync needed |
| Repo structure | Monorepo (pi/ + app/) | Single PR for API+app changes, shared contracts, simple deploy |
| Settings updates | PATCH (partial) | No risk of overwriting unrelated fields |
| Platform target | Android primary, iOS-compatible | Expo gives cross-platform free; test on Android only |
