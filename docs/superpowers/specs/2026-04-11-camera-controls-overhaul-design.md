# Camera Controls Overhaul

## Problem

The live preview shows a blue tint because the IMX477 tuning file's AWB calibration assumes the official Raspberry Pi HQ Camera lens, but we're using an ArduCam variant with different IR-cut filter characteristics. Additionally, the UI labels sensor gain as "ISO" which is technically incorrect, and doesn't expose the full analogue gain range.

## Solution

1. Replace ISO with honest GAIN control (continuous slider, full sensor range)
2. Add manual white balance via ColourGains (red/blue gain sliders)
3. Expand AWB presets to include all libcamera-native modes
4. Add tuning file selector (Standard vs Scientific) on Settings page

## Design Decisions

- **GAIN label** over ISO — shows actual sensor multiplier (1.0×–22.0×)
- **Continuous slider** for gain instead of discrete ISO stops
- **Persistent R/B sliders** when WB=MANUAL — visible while watching live preview for iterative tuning
- **Tuning file on Settings page**, not Home — infrequent change, requires camera restart (~2s)
- **Keep imx477.json as default** — manual ColourGains fix the blue tint; uncalibrated.json strips too much
- **Scientific tuning** as alternative — Rec.709 gamma, no ALSC, frame-to-frame consistency for timelapse

## Changes by Layer

### Pi Service: `pi/services/camera.py`

- `update_settings()`: add `analogue_gain`, `red_gain`, `blue_gain` params
  - `analogue_gain` → `AnalogueGain` control (replaces `iso / 100.0`)
  - When `awb_mode == "manual"`: set `AwbEnable=False`, `ColourGains=(red_gain, blue_gain)`
  - When `awb_mode` is any preset: set `AwbEnable=True`, `AwbMode=<enum>`
- `__init__` / `start()`: accept optional `tuning` param (filename string)
  - Load via `Picamera2.load_tuning_file()` and pass dict to constructor
- Add `restart_with_tuning(tuning_file)` method: stop → re-init with new tuning → start
- Remove `iso` parameter

### Pi API: `pi/api/routers/settings.py`

- Pass `analogue_gain`, `red_gain`, `blue_gain` to `camera.update_settings()`
- Remove `iso` passthrough
- Handle `tuning` field: if changed, call `camera.restart_with_tuning()`

### Config: `tl_config.json`

New camera fields:
```json
{
  "camera": {
    "analogue_gain": 1.0,
    "exposure_mode": "auto",
    "shutter_speed": null,
    "awb_mode": "auto",
    "red_gain": 2.0,
    "blue_gain": 1.3,
    "ev_compensation": 0,
    "metering_mode": "centre",
    "brightness": 0.0,
    "contrast": 1.0,
    "saturation": 1.0,
    "sharpness": 1.0,
    "noise_reduction": "off",
    "tuning": "standard"
  }
}
```

- `iso` removed, replaced by `analogue_gain`
- `red_gain` / `blue_gain` added (defaults: 2.0 / 1.3 — reasonable ArduCam daylight)
- `tuning` added: "standard" | "scientific"

### App UI: `app/src/components/home/CameraSettings.tsx`

- Rename ISO chip → GAIN chip, display as `{gain}×`
- GAIN expands to continuous slider (min=1.0, max=22.0, step=0.1)
- Add "manual" and "indoor" to AWB_MODES
- When `awb_mode === "manual"`: render persistent R/B gain sliders below chip row
  - R slider: red-tinted label, range 0.5–4.0, step 0.05
  - B slider: blue-tinted label, range 0.5–4.0, step 0.05
  - Contained in a subtle bordered box
  - Hidden when any preset AWB mode is active
- Interface update: `iso: number` → `analogue_gain: number`, add `red_gain`, `blue_gain`

### App UI: `app/src/screens/HomeScreen.tsx`

- Update DEFAULT_CAMERA: remove `iso`, add `analogue_gain: 1.0`, `red_gain: 2.0`, `blue_gain: 1.3`

### App UI: Settings page

- Add "CAMERA TUNING" section with Standard / Scientific toggle
- Show brief description of each
- Warning: "Changing tuning restarts camera (~2 sec)"
- Sends `{ camera: { tuning: "standard" | "scientific" } }` via PATCH /api/settings

## AWB Mode Mapping

| UI Label     | libcamera AwbMode | Notes |
|-------------|-------------------|-------|
| AUTO        | 0 (Auto)          | Uses tuning file ct_curve |
| DAYLIGHT    | 1 (Daylight)      | |
| CLOUDY      | 2 (Cloudy)        | |
| TUNGSTEN    | 3 (Tungsten)      | |
| FLUORESCENT | 4 (Fluorescent)   | |
| INDOOR      | 5 (Indoor)        | New — was in libcamera but not exposed |
| MANUAL      | N/A               | AwbEnable=False + ColourGains tuple |

## picamera2 Control Details

- `AnalogueGain`: float, sensor amplification multiplier (1.0–22.26 for IMX477)
- `ColourGains`: tuple (red_gain, blue_gain), relative to green channel
- `AwbEnable`: bool, enables/disables automatic white balance
- `AwbMode`: int enum, selects preset AWB algorithm
- `ExposureValue`: float, EV compensation bias on AEC (only works with AeEnable=True)
- Tuning file: loaded at Picamera2 init only; switching requires close + re-open
