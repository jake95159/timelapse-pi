## 1. Project Overview

This project is a **battery-powered, weatherproof, long-duration timelapse camera** built around a **Raspberry Pi Zero 2 W**, a **Raspberry Pi HQ Camera (M12)** with **6 mm lens**, and a **SparkFun Nano Power Timer (TPL5110)** for ultra–low power operation.

The Pi will:

- Run in two primary modes:
    
    - **AUTO (hardware-timed, low-power)** via TPL5110
        
    - **BYPASS (software-timed, always on)** via direct 5V from buck
        
- Host a **web app** (served from the Pi) reachable from:
    
    - A phone or tablet in the field (Pi in AP mode)
        
    - A laptop/desktop at home (Pi on home Wi-Fi)
        

The web app will be used to:

- Configure timelapse settings
    
- Adjust camera parameters
    
- Set location and daylight/time windows
    
- View status and live preview
    
- Browse and download captured images
    
- Trigger timelapse video rendering
    
- Manage Wi-Fi mode and basic OTA-style updates
    

This document is written for **AI tools and developers** to implement the full software stack against a fixed hardware configuration.

---

## 2. System Goals

### 2.1 Primary Goals

1. **Long-duration timelapse capture**
    
    - Multi-week/month runtime in AUTO mode
        
    - Configurable intervals via hardware DIP and software settings
        
2. **Flexible capture behavior**
    
    - Slow, battery-efficient captures via **AUTO** (e.g., 1 shot/hour during daylight)
        
    - Faster sequences via **BYPASS** (e.g., sunset every few seconds)
        
3. **Web-based control**
    
    - Pi-hosted web UI
        
    - Accessible from both mobile and desktop browsers
        
    - No native app required
          
    - Real-time video feed for lining up shots and testing camera settings? Or, just a button to take a pic and view it right away for the purpose of lining up the shot and evaluating settings. 
	    
4. **Time & light awareness**
    
    - User-provided **location (lat/lon)**, enter ZIP or pick on map
        
    - Sunrise/sunset calculation
        
    - Time-of-day shooting windows
        
    - Daylight-only / night-only / always options
        
5. **Media handling**
    
    - Store images on Pi SD card
        
    - Browse images in browser
        
    - Download single images or bulk selections
        
    - Generate a timelapse video from a set of frames with user-configurable options (total video duration, other typical timelapse settings)
        
6. **Connectivity**
    
    - **AP mode** for field use (Pi as Wi-Fi hotspot)
        
    - **Client mode** to join home network for development
        
7. **Battery-aware operation**
    
    - User inputs battery capacity
        
    - Rough runtime estimate based on mode and interval
        

---

## 3. Hardware Configuration

### 3.1 Core Electronics

- **Compute:** Raspberry Pi Zero 2 W
    
- **Camera:** Raspberry Pi HQ Camera (M12 version)
    
- **Lens:** M12 6 mm wide-angle lens (Adafruit #4563)
    
- **Timer:** SparkFun Nano Power Timer (TPL5110-based)
    
- **Battery:** 3S LiPo (exact capacity entered as a parameter)
    
- **Regulator:** 3S LiPo → 5V buck converter
    
- **Capacitor:** 1000 µF 25 V across buck 5V and GND
    
- **Mode Switch:** DPDT rocker switch (AUTO / BYPASS)
    
- **Manual Wake:** SparkFun on-board pushbutton (no external wake button)
    
- **Enclosure:** Weatherproof Pelican-style case
    
- **Optical Window:** Acrylic mounted/sealed in front of lens
    
- **Mounting:** 3D printed bracket for Pi + camera aligned to window
    

### 3.2 Power & Wiring Summary

**Battery Path:**

- 3S LiPo → Buck converter → 5V rail
    
- 5V rail → DPDT switch
    
- DPDT switch routes 5V either:
    
    - Through SparkFun timer to Pi (**AUTO**)
        
    - Directly to Pi (**BYPASS**)
        

**Timer Wiring (SparkFun Nano Power Timer):**

- **VDD**: Timer power input (5V from buck via DPDT switch)
    
- **VOUT**: Switched 5V output to Pi (in AUTO mode)
    
- **DONE**: Connected to Pi GPIO17 (Pi signals safe to power off)
    - **Note**: GPIO17 used instead of GPIO4 to avoid kernel boot conflicts
    - 47kΩ pull-down resistor to GND (prevents spurious triggers during boot)
    - Boot config: `gpio=17=pd` in `/boot/firmware/config.txt`
    
- **GND**: Common ground with Pi and buck
    
- **DRV**: Unused (internal)
    

**Pi Power Source:**

- In **AUTO**: Pi powered from **SparkFun VOUT**
    
- In **BYPASS**: Pi powered directly from **buck 5V**
    

**DPDT Switch (pins 1–6 as per wiring diagram you provided):**

- Top pole: pins **1, 3, 5** → controls **SparkFun VDD**
    
    - Pin **3** (common) → SparkFun VDD
        
    - Pin **1** → Buck 5V (AUTO)
        
    - Pin **5** → NC (BYPASS = timer off)
        
- Bottom pole: pins **2, 4, 6** → controls **Pi 5V**
    
    - Pin **4** (common) → Pi 5V
        
    - Pin **2** → SparkFun VOUT (AUTO)
        
    - Pin **6** → Buck 5V (BYPASS)
        

**Ground:**

- Buck GND, SparkFun GND, Pi GND all tied together.
    

**Capacitor:**

- 1000 µF:
    
    - `+` → buck 5V rail
        
    - `–` → common GND
        

**Camera Connection:**

- HQ Camera → Pi CSI port via ribbon cable.
    

---

## 4. Operating Modes (Behavioral)

### 4.1 AUTO Mode (Hardware-Timed Low-Power)

**Physical state:**

- DPDT switch set to **AUTO** (lever toward pins 1 & 2)
    
- SparkFun VDD is connected to buck 5V
    
- Pi gets 5V from SparkFun VOUT
    

**Timing:**

- SparkFun Nano Power Timer DIP switches define the wake interval (e.g., 1 hour).
    
- User may change DIP switches depending on scenario.
    
- Software does **not** auto-read DIP; instead, user informs system of DIP interval via web UI so estimates can be correct.

**⚠️ Important Constraint: Minimum Timer Interval**

- **Minimum reliable interval: 1 minute** (DIP switch B = ON)
- Pi Zero 2 W boot time (~20s) + script execution (~5s) = ~25s total
- Timer intervals **shorter than 1 minute are not reliable** for AUTO mode
- **For sub-minute intervals**: Use BYPASS mode with software-controlled capture loop
- DIP switch options:
    - 30 seconds: Too short for reliable AUTO operation ❌
    - 1 minute: Minimum reliable AUTO interval ✅
    - 1 hour: Recommended for long-duration timelapse ✅
    - 2 hours: Maximum standard interval ✅
    - Custom (F position): Requires external resistor (see TPL5110 datasheet)

**Cycle (each wake):**

1. Timer asserts VOUT → Pi gets 5V → boots.
    
2. On boot, a **capture service** runs:
    
    - Loads `tl_config.json`
        
    - Determines current mode (`auto`)
        
    - Calculates current local time (RTC/network time assumed)
        
    - Computes sunrise/sunset from stored latitude/longitude.
        
3. Checks **shooting conditions**:
    
    - If `daylight_only = true`, only shoot between sunrise and sunset.
        
    - Applies user windows: `window_start` / `window_end` (e.g., 07:00–20:00).
        
4. If conditions are satisfied:
    
    - Captures an image
        
    - Saves it with timestamp-based filename
        
    - Writes metadata entry to an index file (for gallery)
        
5. Regardless of whether a photo was taken:

    - The service sets GPIO17 → HIGH (DONE signal).

    - Timer sees DONE and cuts VOUT (Pi loses power).
        
6. System is fully off until next SparkFun interval.
    

**Special cases:**

- Allow user to disable daylight-only or windows, so AUTO can shoot 24/7.
    
- In AUTO mode, web UI is only reachable during the brief window while Pi is up (if at all); heavy configuration is intended to be done in BYPASS mode.
    

---

### 4.2 BYPASS Mode (Software-Timed, Always-On)

**Physical state:**

- DPDT switch set to **BYPASS** (lever toward pins 5 & 6)
    
- SparkFun VDD disconnected (timer off)
    
- Pi powered directly from buck 5V (always on)
    

**Behavior:**

- Pi runs continuously.
    
- Web server (FastAPI + frontend) always available (when on the same network or AP).
    
- Capture intervals controlled by software config:
    
    - `software_interval_sec` (e.g. 5, 10, 60 seconds).
        
- User can:
    
    - Run faster timelapses (e.g., sunset every 3 seconds).
        
    - Use live preview.
        
    - Configure all settings.
        
    - Render timelapse videos.
        
    - Perform OTA-like updates.
        
- DONE line is unused in this mode; script does **not** assert DONE for shutdown.
    

---

### 4.3 Manual Wake (Using On-Board Button)

- When in AUTO mode and timer is powered:
    
    - Pressing the **on-board SparkFun button** forces an immediate wake (VOUT ON).
        
    - Pi boots and runs AUTO capture service.
        
- This can be used for:
    
    - Quick tests
        
    - Forcing an on-demand capture cycle without waiting for the next interval
        

For full configuration sessions, the recommended flow is to flip to **BYPASS** so the Pi stays on.

---

## 5. Software Architecture (Pi)

### 5.1 Stack

- **OS:** Raspberry Pi OS Lite (Bookworm 32-bit)

- **Language:** Python 3

- **Pi Backend:**

    - `fastapi` (REST API server)

    - `uvicorn` (ASGI server)

    - `picamera2` (camera control)

    - `astral` (sunrise/sunset from lat/lon)

    - `ffmpeg` (external) via `subprocess` for video rendering

- **Mobile App (Sprint 2):**

    - **React Native** (Expo) — cross-platform iOS/Android app

    - Connects to Pi's FastAPI backend over local Wi-Fi or AP

    - Polished, production-quality UI (not a quick web page)

    - Features: dashboard, live preview, gallery, settings, timelapse rendering

- **Service manager:** `systemd`
    

### 5.2 Processes / Services

1. **REST API Server**

    - FastAPI app:

        - Exposes REST endpoints for control/status/gallery/rendering

        - Consumed by the React Native mobile app over Wi-Fi

    - Runs in both AUTO and BYPASS modes when Pi is up (AUTO windows will be brief).
        
2. **AUTO Mode Capture Service**
    
    - Triggered at boot (via systemd)
        
    - Detects mode = `auto`
        
    - Executes single capture cycle + DONE, then exits.
        
3. **BYPASS Mode Capture Loop**
    
    - Long-running service
        
    - Reads interval from config
        
    - Sleeps, wakes, captures, repeats.
        
4. **Wi-Fi Mode Management**
    
    - Scripts to:
        
        - Start/stop AP mode (hostapd + dnsmasq)
            
        - Join configured home network (wpa_supplicant/NetworkManager)
            
5. **OTA Update Script**
    
    - Accepts URL or package path.
        
    - Download/unpack/apply updated code.
        

---

## 6. Mobile App (UI) Requirements

### 6.1 General

- **React Native (Expo)** mobile app — native iOS/Android experience

- Communicates with Pi's FastAPI REST API over local network

- Must work in two network contexts:

    - **Field:** Phone connects to Pi's AP mode Wi-Fi hotspot

    - **Home:** Phone and Pi both on home network

- Production-quality, polished UI — not a minimal web page

- Designed for mobile-first (primary use is phone in the field), desktop/tablet secondary
    

### 6.2 Views

#### 6.2.1 Dashboard

Elements:

- Current mode: `AUTO` or `BYPASS`
    
- Interval info:
    
    - AUTO: display "Hardware interval (DIP): X" (user-provided)
        
    - BYPASS: display `software_interval_sec`
        
- Daylight-only status
    
- Current time + next expected capture
    
- Last capture timestamp + quick thumbnail
    
- Storage usage (percent of SD used)
    
- Estimated remaining runtime (very rough, based on:
    
    - Battery capacity (mAh)
        
    - Average Pi-on duration per cycle
        
    - Interval)
        

Actions:

- Button: “Capture now”
    
- Button: “Render timelapse” (opens render view)
    
- Button: “Switch to BYPASS / AUTO” is informational only (real mode is physical switch) — maybe show a warning if software mode and hardware switch disagree.
    

#### 6.2.2 Live Preview

- Displays current camera frame at low resolution (e.g. JPEG snapshots every X seconds).
    
- Controls:
    
    - Start/Stop preview
        
    - ISO slider or presets
        
    - Exposure mode dropdown
        
    - Shutter speed (optional, advanced)
        
    - White balance mode
        
- Button: “Capture still” (saves image to timelapse directory or a “manual captures” directory).
    

#### 6.2.3 Timelapse Settings

Configurable parameters:

- **Mode label:** show read-only (AUTO/BYPASS) with note that actual switching is physical.
    
- **Location:**
    
    - Latitude / Longitude numeric inputs
        
- **Daylight-only:** true/false
    
- **Time window:**
    
    - `window_start` (HH:MM)
        
    - `window_end` (HH:MM)
        
- **Hardware interval** (for AUTO mode):
    
    - Dropdown with typical values (30s, 1m, 5m, 30m, 1h, 2h, etc.)
        
    - This is informational for battery estimates; does **not** change DIP.
        
- **Software interval** (for BYPASS mode):
    
    - `software_interval_sec` numeric or slider
        
- **Camera defaults:**
    
    - ISO
        
    - Exposure mode
        
    - AWB mode
        
    - Optional advanced settings
        

All changes saved to `tl_config.json` via API.

#### 6.2.4 Gallery

- Paginated grid of thumbnails.
    
- Each image has:
    
    - Timestamp
        
    - Checkbox for selection
        
    - “View / Download” button
        

Functions:

- Download single image (as full-res JPEG).
    
- Download multiple as a ZIP.
    
- Filter by time range (e.g., last day, week, custom range).
    
- Mark subset as a “stack” for timelapse rendering.
    

#### 6.2.5 Timelapse Rendering

- Choose:
    
    - Folder or filtered set of images
        
    - FPS
        
    - Output resolution
        
    - Output filename
        
- Start render:
    
    - Backend runs ffmpeg job
        
    - UI shows progress
        
- After completion:
    
    - List generated video in a table with download link.
        

#### 6.2.6 Device / Network Settings

Options:

- **Battery capacity (mAh)** input.
    
- **Wi-Fi mode:**
    
    - AP mode:
        
        - SSID / password
            
    - Client mode:
        
        - Available networks
            
        - Stored credentials
            
- **Time sync:** (optionally display NTP status)
    
- **OTA update:**
    
    - Input: URL of update package
        
    - Button: “Apply update”
        
- Logs view:
    
    - Tail of application logs.
        

---

## 7. REST API Specification (Sketch)

Base: `http://<pi-address>/api`

### 7.1 Status

`GET /api/status`

Returns JSON:

`{   "mode": "auto" | "bypass",   "hardware_interval_sec": 3600,   "software_interval_sec": 60,   "daylight_only": true,   "window_start": "07:00",   "window_end": "20:00",   "location": { "lat": 38.846, "lon": -77.305 },   "last_capture": "2025-04-20T12:34:56Z",   "storage_used_pct": 23.4,   "battery_mah": 9700,   "runtime_estimate_hours": 150.0 }`

### 7.2 Settings

`GET /api/settings` → returns full `tl_config.json`  
`POST /api/settings` → accepts updated config fields; merges & writes back JSON

### 7.3 Capture

`POST /api/capture` → forces a single capture (if Pi is up)

Response:

`{   "status": "ok",   "image_id": "2025-04-20_12-34-56",   "path": "/home/pi/tl_images/2025-04-20_12-34-56.jpg" }`

### 7.4 Gallery

- `GET /api/images` → list images (filter params by time, page)
    
- `GET /api/images/{id}` → return image file
    
- `GET /api/images/{id}/thumb` → smaller thumbnail
    

### 7.5 Timelapse

- `POST /api/timelapse/render`  
    Body includes:
    
    - List of image IDs or folder pattern
        
    - FPS
        
    - Output name
        
- `GET /api/timelapse` → list rendered videos
    
- `GET /api/timelapse/{id}` → download video
    

### 7.6 Network

- `GET /api/network/status`
    
- `POST /api/network/config` (switch AP/client, set credentials)
    

### 7.7 OTA

- `POST /api/ota/update`
    
    - Body: `{ "url": "https://..." }`
        
    - Pi downloads package and applies update.
        

---

## 8. Configuration File

Path: `/boot/tl_config.json` (or another fixed path under `/home/pi/timelapse/` – but consistent)

### Example:

`{   "mode": "auto",   "location": { "lat": 38.846, "lon": -77.305 },   "daylight_only": true,   "window_start": "07:00",   "window_end": "20:00",   "hardware_interval_sec": 3600,   "software_interval_sec": 60,   "battery_mah": 9700,   "camera": {     "iso": 100,     "exposure_mode": "auto",     "shutter_speed": null,     "awb_mode": "auto"   } }`

---

## 9. Timelapse Rendering

- Use `ffmpeg` to render an MP4 (H.264) from ordered JPEGs.
    
- Images sorted by timestamp-based filename.
    
- Output directory: `/home/pi/tl_videos/`
    
- Metadata stored in a simple JSON index for the web UI.
    

---

## 10. Completed vs Outstanding

### Completed (Hardware) ✅

- Enclosure prepared and sealed.

- Acrylic window installed and sealed.

- Pi Zero 2 W mounted.

- HQ Camera (M12) + 6 mm lens installed.

- Buck converter (Castle BEC, 14A @ 5V) wired to 3S LiPo (9700 mAh).

- 1000 µF capacitor installed across 5V rail.

- SparkFun Nano Power Timer wired:

    - VDD from DPDT switch

    - VOUT to DPDT switch

    - DONE to Pi GPIO17 (with 10kΩ pull-down to GND)

    - GND common.

- DPDT switch wired for AUTO/BYPASS as defined.

- Timer DIP switches configured (1-minute interval, switch B ON).

- System fully powered and tested.


### Completed (Software - Sprint 1) ✅ COMPLETE

**Completed 2026-03-28.** Pi was found reflashed with fresh Bookworm. Re-provisioned from scratch with improved capture script (v3). AUTO mode now **100% reliable** (20/20 test cycles).

- ✅ Raspberry Pi OS Lite (Bookworm 32-bit, Python 3.11.2) installed
- ✅ Dependencies installed: git, ffmpeg, picamera2, lgpio, libcamera-apps
- ✅ Project directory structure: `~/timelapse/{images,videos,logs}`
- ✅ Capture script v3 (`capture_auto.py`) with:
    - Sequence-numbered filenames (Pi has no RTC, clock doesn't advance between boots)
    - All logging/syncing before DONE signal (TPL5110 cuts power instantly on DONE)
    - 2s camera warm-up, 1s post-sync delay
    - Atomic lock file (`/tmp`) prevents duplicate captures from triple boot execution
- ✅ Triple boot execution: systemd service + rc.local + cron @reboot (with lock dedup)
- ✅ Boot optimizations: Bluetooth off, HDMI off, splash disabled, GPIO17 pull-down
- ✅ BYPASS mode: 100% reliable
- ✅ **AUTO mode: 100% reliable (20/20 cycles tested)**

### Outstanding (Software)

**Sprint 2 (App + API)**:
- FastAPI REST API on Pi (endpoints for status, settings, capture, gallery, rendering, network)
- **React Native (Expo) mobile app** — polished, production-quality UI
    - Dashboard (status, battery estimate, storage, next capture)
    - Live camera preview with exposure/ISO/AWB controls
    - Image gallery (browse, download, bulk select, delete)
    - Timelapse settings (interval, daylight windows, location)
    - Video rendering (ffmpeg) with progress
    - Network management (AP/client switching)
- Wi-Fi AP/client switching logic on Pi
- OTA update mechanism

**Sprint 3 (Advanced Features)**:
- Sunrise/sunset calculation (astral library)
- Time-of-day window logic
- Daylight-only mode
- JSON config file system
- Battery monitoring (if hardware added)
- Storage management
    

---

## 11. Next Steps (for AI / Dev Tools)

### Sprint 1: COMPLETE ✅

**AUTO mode 100% reliable** (20/20 cycles, 2026-03-28). Ready for Sprint 2.

---

### Sprint 2: App + API Development (After Sprint 1 Complete)

**Pi Backend (FastAPI)**:

1. Scaffold FastAPI project on Pi with `uvicorn`
2. Implement REST API endpoints (status, settings, capture, gallery, rendering, network)
3. Implement BYPASS capture loop service (software-timed)
4. Enhance AUTO capture script with window/daylight logic
5. Add ffmpeg-based rendering endpoint
6. Add Wi-Fi AP/client switching scripts
7. Add OTA update mechanism

**Mobile App (React Native / Expo)**:

1. Scaffold React Native (Expo) project
2. Implement Pi discovery / connection (AP mode + home network)
3. Dashboard screen (status, battery estimate, storage, next capture)
4. Live preview screen (camera feed with ISO/exposure/AWB controls)
5. Gallery screen (browse, download, bulk select, delete)
6. Settings screen (timelapse config, location, daylight windows)
7. Rendering screen (trigger ffmpeg jobs, show progress, download)
8. Network management screen (AP/client switching)

---

**End of Spec**