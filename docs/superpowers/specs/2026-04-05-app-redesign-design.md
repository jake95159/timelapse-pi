# Mobile App Redesign — Retro Camcorder UI

**Date:** 2026-04-05
**Status:** Approved

## Overview

Complete redesign of the Timelapse-Pi React Native (Expo) mobile app. Consolidates Dashboard and Preview into a single Home screen, introduces a retro 90s camcorder aesthetic (Hi8/VHS viewfinder), replaces all emoji icons with Phosphor Icons (duotone weight), adds new camera controls to both the app and Pi backend, and slims down the Settings screen.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual direction | Hi8 viewfinder — cool gray/silver dark mode | User preference; clean, functional, retro without being gimmicky |
| Icon set | Phosphor Icons, duotone weight | Duotone fill adds "backlit LCD" depth; 7000+ icons, `phosphor-react-native` package |
| Font strategy | VT323 (pixel font) for labels/OSD, system font for values | Matches camcorder OSD overlay language; system font keeps data readable |
| Camera settings interaction | Inline horizontal scroll strip | Stays in viewfinder context; feels like scrubbing camcorder menu options |
| Page structure | 3 tabs: Home, Gallery, Settings | Dashboard+Preview merged; Settings slimmed |

---

## 1. App Structure & Navigation

### Tabs

| Tab | Icon | Screen(s) |
|-----|------|-----------|
| **Home** | Phosphor `VideoCamera` (duotone) | Viewfinder, camera settings, capture settings, capture controls |
| **Gallery** | Phosphor `SquaresFour` (duotone) | BatchList → BatchDetail → ImageViewer (existing stack, restyled) |
| **Settings** | Phosphor `GearSix` (duotone) | Location, battery capacity, network management |

### Navigation Bar
- Bottom tabs
- Background: `#0d0d14`
- Active tab: `#ccc` with text glow
- Inactive tab: `#555`
- Labels: VT323, uppercase, 8px, letter-spaced

### Connection Screen
- Unchanged functionality — shown when disconnected, before tabs appear
- Restyled to match Hi8 theme

### Render Modal
- Triggered from Gallery BatchDetail — no structural changes, restyled

---

## 2. Home Screen Layout

Top-to-bottom flow, single scrollable screen:

### 2.1 Status Bar
- Full width, compact row
- Left: Storage icon + `14.2GB 58%`
- Right: Voltage `12.1V` + Battery icon + `72%`
- Font: VT323, ~10px, subtle text glow

### 2.2 Runtime Estimates Row
- Two columns side by side
- Left column: `BYPASS` label + estimated runtime + frame count (e.g., `53h · 6,384 frames`)
- Right column: `AUTO` label + estimated runtime + frame count (e.g., `412h · 412 frames`)
- Calculated from: current interval settings + battery SoC + storage remaining
- **Red indicator rule:** If storage is estimated to run out before battery in either mode, that mode's text AND the storage icon in the status bar turn red (`#cc3333`)
- BYPASS estimate updates live during an active BYPASS capture
- Font: VT323, labels in `#666` at 9px, values in `#aaa` at 10px

### 2.3 Viewfinder
- 4:3 aspect ratio container — the focal point of the screen
- Visual elements:
  - Corner brackets (VHS-style focus frame) in `#555`
  - Center crosshair in `#444`
  - Top-left overlay: mode indicator — `STBY ▷` (idle) / `REC ●` (recording, red) / `LIVE ▷` (live preview active)
  - Bottom-left overlay: date stamp `2026.04.05  14:32` in `#777`
  - Bottom-right overlay: resolution `800×600` in `#777`
- Preview image fills the frame when active
- During BYPASS capture: shows most recent captured frame; preview controls disabled

### 2.4 Preview Controls
- Centered below viewfinder, two circular buttons
- **Snap** (Phosphor `Camera` duotone) — captures a single ephemeral preview frame for framing/testing
- **Live** toggle (Phosphor `VideoCamera` duotone) — enables/disables continuous ~1fps preview polling
- Both disabled during active BYPASS capture
- Labels: VT323, 8px, `SNAP` / `LIVE`

### 2.5 Camera Settings
- Section header: `CAMERA` in VT323, `#444`, letter-spaced

#### Tier 1 — Primary Controls (always visible)
Horizontal row of chips:

| Chip | Label | Values | Notes |
|------|-------|--------|-------|
| ISO | `ISO` | 100, 200, 400, 800, 1600, 3200 | Discrete steps |
| Exposure | `EXP` | Auto, Manual | Toggle |
| White Balance | `WB` | Auto, Daylight, Cloudy, Tungsten, Fluorescent | Presets |
| EV Compensation | `EV` | -4 to +4 (0.5 steps) | Slider or strip |
| Shutter Speed | `SHTR` | 1/1000, 1/500, 1/250, 1/125, 1/60, 1/30, 1/15, 1/8, 1/4, 1/2, 1s, 2s, 5s, 10s | Only visible when EXP = Manual |

#### Tier 2 — Image Adjustments (collapsible, label `IMAGE`)
Second row, collapsed by default, tap section header to expand:

| Chip | Label | Range | Default | Input |
|------|-------|-------|---------|-------|
| Sharpness | `SHRP` | 0.0–16.0 | 1.0 | Horizontal slider strip |
| Contrast | `CNTR` | 0.0–32.0 | 1.0 | Horizontal slider strip |
| Saturation | `SAT` | 0.0–32.0 | 1.0 | Horizontal slider strip |
| Brightness | `BRT` | -1.0–1.0 | 0.0 | Horizontal slider strip |
| Metering | `MTR` | Centre, Spot, Matrix | Centre | Discrete strip |
| Noise Reduction | `NR` | Off, Fast, HQ, Minimal | Off | Discrete strip |

#### Chip Interaction
- Each chip displays: `LABEL value ▾`
- Tap → inline horizontal scroll strip appears directly below the chip row
- For discrete values: tappable options in a row
- For continuous values (EV, Sharpness, Contrast, Saturation, Brightness): horizontal slider
- Select/adjust → strip collapses
- Chip styling: background `#1a1a24`, border `#2a2a34`, label in `#666`, value in `#ccc` with glow

### 2.6 Capture Settings
- Section header: `CAPTURE` in VT323, `#444`, letter-spaced
- All values are editable — tap to modify

| Setting | Icon | Display | Editable | Notes |
|---------|------|---------|----------|-------|
| Software interval | Phosphor `Clock` | `30s` | Yes, numeric input | Interval for BYPASS mode captures |
| Hardware interval | Phosphor `Clock` + `HW` label | `60m` | Yes, numeric input | Displayed in minutes, minimum 1 minute |
| Daylight toggle | Phosphor `Sun` | `DAYLIGHT` + toggle | Yes | Replaces start/end times when ON |
| Sunrise offset | Phosphor `SunHorizon` | e.g., `-15m` | Yes, numeric +/- input | Only visible when daylight ON |
| Sunset offset | Phosphor `SunHorizon` | e.g., `+30m` | Yes, numeric +/- input | Only visible when daylight ON |
| Start time | Phosphor `Clock` | e.g., `06:00` | Yes, time input | Only visible when daylight OFF |
| End time | Phosphor `Clock` | e.g., `20:00` | Yes, time input | Only visible when daylight OFF |

### 2.7 BYPASS Capture Controls
- Centered, prominent, at bottom of Home screen
- Two circular buttons:

| Button | Icon | Label | Behavior |
|--------|------|-------|----------|
| **Capture Still** | Phosphor `Camera` duotone | `CAPTURE` | Single frame to current batch |
| **Record** | Red filled circle with glow | `● REC` | Starts BYPASS timelapse loop |

#### Recording State
- Record button becomes **Stop** button (Phosphor `Stop` icon)
- Capture Still button is disabled
- Preview Snap and Live buttons are disabled
- Viewfinder overlay changes to `REC ●` (red, with glow)
- Viewfinder shows most recently captured frame (auto-updates)
- BYPASS runtime estimate updates live

---

## 3. Gallery

No structural changes. Same screen stack:
- **BatchListScreen** — list of batch cards with thumbnails
- **BatchDetailScreen** — image grid, download, render, rename, delete
- **ImageViewerScreen** — full-screen image viewer
- **RenderModal** — FPS slider, render progress, save to Photos

**Changes:**
- Restyle all components to Hi8 palette
- Replace emoji tab icon with Phosphor `SquaresFour` duotone
- VT323 for section headers and labels
- System font for data (batch names, counts, dates)
- Batch cards, thumbnails, action buttons match retro theme

---

## 4. Settings

Three sections only. Everything else has been moved to Home or removed.

### 4.1 LOCATION
| Field | Type | Notes |
|-------|------|-------|
| Latitude | Decimal input | Editable |
| Longitude | Decimal input | Editable |
| **Use Current Location** | Button | Uses Expo Location API to get phone GPS and populate lat/lon |

### 4.2 DEVICE
| Field | Type | Notes |
|-------|------|-------|
| Battery capacity | Numeric input (mAh) | Editable |

### 4.3 NETWORK
| Element | Notes |
|---------|-------|
| Connection status | AP/Client mode, SSID, IP, signal strength |
| Saved networks | List with remove buttons |
| Scan & join | Existing scan + password entry flow |
| **Add Network** | New: manually type SSID + password (for hidden networks) |
| Switch to AP Mode | Button with confirmation alert |

### Removed from Settings
- ~~Software interval~~ → moved to Home capture settings
- ~~Hardware interval~~ → moved to Home capture settings
- ~~Camera defaults (ISO, exposure, AWB)~~ → replaced by live camera controls on Home
- ~~Daylight/timing window~~ → moved to Home capture settings

---

## 5. Theme & Styling

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0d0d14` | App background, nav bars |
| `surface` | `#111118` | Cards, viewfinder container |
| `surfaceLight` | `#16161e` | Elevated elements, chips, inputs |
| `border` | `#1e1e28` | Card borders, dividers |
| `borderLight` | `#2a2a34` | Subtle separators, chip borders |
| `text` | `#cccccc` | Primary text, active icons |
| `textSecondary` | `#999999` | Status values, secondary info |
| `textMuted` | `#666666` | Labels, chip labels, section headers |
| `textDim` | `#444444` | Inactive elements, deep muted text |
| `accent` | `#cccccc` | Active tab, selected state |
| `record` | `#cc3333` | Record button, REC indicator |
| `recordGlow` | `rgba(204,51,51,0.4)` | Record button shadow |
| `recordBg` | `#1e1218` | Record button background |
| `warning` | `#ff9900` | Low battery/storage warnings |
| `danger` | `#cc3333` | Storage-exhaustion-before-battery indicator |
| `success` | `#4a9968` | Toggle ON, connected state |
| `successBg` | `#2a5533` | Toggle track background (ON) |

### Typography

| Style | Font | Size | Usage |
|-------|------|------|-------|
| `osd` | VT323 | 10-11px | Viewfinder overlays, date stamps, mode indicators |
| `label` | VT323 | 8-9px | Section headers, nav labels, chip labels, button labels |
| `title` | VT323 | 18px | Screen titles |
| `value` | System font | 11px | Setting values, stats, editable fields |
| `body` | System font | 14px | Body text, descriptions, batch names |
| `caption` | System font | 12px | Secondary info, dates |

### Effects

| Effect | Implementation |
|--------|---------------|
| Text glow | `textShadowColor: rgba(200,200,200,0.3), textShadowRadius: 4` |
| Icon glow | Phosphor duotone opacity layer provides built-in depth |
| Record glow | `shadowColor: #cc3333, shadowRadius: 8, shadowOpacity: 0.4` |
| Viewfinder brackets | 2px solid `#555`, positioned absolutely in corners |

### Icons

- Library: **Phosphor Icons** — `phosphor-react-native` package
- Weight: **Duotone** throughout
- Sizes: 20-24px standalone, 14px inline with text
- Color: inherits from context (`#ccc` active, `#555` inactive, `#cc3333` record)

---

## 6. Backend Changes

### 6.1 Config Schema Additions

New fields in `camera` section of `tl_config.json`:

```json
{
  "camera": {
    "iso": 100,
    "exposure_mode": "auto",
    "shutter_speed": null,
    "awb_mode": "auto",
    "ev_compensation": 0.0,
    "metering_mode": "centre",
    "brightness": 0.0,
    "contrast": 1.0,
    "saturation": 1.0,
    "sharpness": 1.0,
    "noise_reduction": "off"
  }
}
```

### 6.2 Camera Service Changes

Add mappings in `camera.py` `update_settings()`:

| Config Key | libcamera Control | Type | Mapping |
|------------|-------------------|------|---------|
| `ev_compensation` | `ExposureValue` | float | Direct: -8.0 to 8.0 (UI limits to -4.0 to 4.0) |
| `metering_mode` | `AeMeteringMode` | int | `centre`=0, `spot`=1, `matrix`=2 |
| `brightness` | `Brightness` | float | Direct: -1.0 to 1.0 |
| `contrast` | `Contrast` | float | Direct: 0.0 to 32.0 |
| `saturation` | `Saturation` | float | Direct: 0.0 to 32.0 |
| `sharpness` | `Sharpness` | float | Direct: 0.0 to 16.0 |
| `noise_reduction` | `NoiseReductionMode` | int | `off`=0, `fast`=1, `high_quality`=2, `minimal`=3 |

### 6.3 Auto-Apply on Settings Change

Currently `PATCH /api/settings` saves config but does not apply camera controls until next capture. Add a call to `camera.update_settings()` after config save so that:
- Preview immediately reflects camera setting changes
- User gets real-time feedback when adjusting ISO, WB, etc.

### 6.4 No API Endpoint Changes

The existing `PATCH /api/settings` endpoint already deep-merges arbitrary keys into the config. No new endpoints needed — the app just sends the new camera fields via the same mechanism.

---

## 7. New Dependencies

### Mobile App
| Package | Purpose |
|---------|---------|
| `phosphor-react-native` | Duotone icon set |
| `react-native-svg` | Required peer dependency for Phosphor |
| `expo-font` | Load VT323 custom font (or `@expo-google-fonts/vt323`) |
| `expo-location` | "Use Current Location" button on Settings |

### Pi Backend
No new Python dependencies. All new controls use existing `picamera2.set_controls()` API.

---

## 8. What's NOT Changing

- Connection discovery flow (mDNS → AP gateway → manual IP)
- Batch management (create, rename, split, merge, delete)
- Image download and local storage
- Video rendering (ffmpeg-kit)
- API client architecture (React Query + fetch wrapper)
- AUTO mode capture flow (GPIO27 + TPL5110, no API server)
- Power monitoring (ADS1115 + SoC lookup)
