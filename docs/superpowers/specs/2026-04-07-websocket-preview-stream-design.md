# WebSocket Live Preview Stream

**Date**: 2026-04-07
**Status**: Approved

## Problem

The live preview polls `GET /api/preview` at 1 FPS via HTTP. Each request is a full round-trip, and React Native's `Image` component flickers between frames even with prefetch + double-buffering workarounds. We want a smooth, higher-FPS preview that adapts to the network connection type.

## Decision

Replace HTTP polling with a persistent WebSocket connection for the live preview stream. Keep the existing HTTP endpoint for single-frame snap.

## Architecture

### Pi-side

**New endpoint**: `WS /api/preview/ws`

Implemented in a new router `pi/api/routers/preview_ws.py`. On client connect:

1. Query `wifi_manager.get_status()["mode"]` to determine AP vs client.
2. Select defaults based on mode:
   - **AP**: 4 FPS, JPEG quality 50
   - **WiFi/client**: 10 FPS, JPEG quality 70
3. Enter async loop:
   - `capture_preview(quality=N)` via `asyncio.loop.run_in_executor()` to avoid blocking the event loop.
   - Send JPEG bytes as a **binary** WebSocket message.
   - If the frame took >500ms (camera lock held during still capture), send a JSON text message `{"status": "capturing"}` before the frame.
   - Send `{"status": "streaming"}` after the delayed frame to clear the indicator.
   - `await asyncio.sleep(1.0 / target_fps)` between iterations.
4. Concurrently listen for incoming JSON text messages from the client:
   - `{"fps": N, "quality": N}` — override the stream parameters.
5. On disconnect or error, exit cleanly.

**Camera service change**: Add `quality` parameter to `capture_preview()`:

```python
def capture_preview(self, quality: int = 70) -> bytes:
```

No other changes to `camera.py`. The threading lock, preview/still mode switching, and all existing behavior stay the same.

**Registration**: Add `preview_ws.router` in `main.py` alongside the existing `preview.router`.

### App-side

**New hook**: `app/src/hooks/usePreviewStream.ts`

- Accepts `active: boolean`.
- When active, opens a WebSocket to `ws://{baseUrl}/api/preview/ws` (derives ws:// URL from the existing HTTP base URL).
- **Binary messages**: Convert JPEG bytes to a base64 data URI (`data:image/jpeg;base64,...`), set as `imageUri`.
- **Text messages**: Parse JSON. If `{"status": "capturing"}`, set `isCapturing = true`. If `{"status": "streaming"}`, set `isCapturing = false`.
- When `active` becomes false, close the WebSocket.
- Returns `{ imageUri: string | null, isCapturing: boolean }`.
- On WebSocket error/close while still active, attempt reconnect after 1 second.

**Modified hook**: `app/src/hooks/usePreview.ts`

- Keep `snapOnce` function using the existing HTTP `GET /api/preview` + `Image.prefetch()`.
- Remove the polling interval logic (no longer needed — live mode uses WebSocket).
- Returns `{ snapOnce }` only.

**Modified component**: `app/src/components/home/Viewfinder.tsx`

- Add `isCapturing?: boolean` prop.
- When `isCapturing` is true, show a brief overlay indicator in the viewfinder — a small pulsing dot or icon near the mode indicator, consistent with the Hi8 camcorder aesthetic (e.g., `"CAP"` text in the accent color, or a filled circle).
- Double-buffer logic stays as-is — it handles the WebSocket frames identically to HTTP frames (both are image URIs).

**Modified screen**: `app/src/screens/HomeScreen.tsx`

- Use `usePreviewStream(previewActive)` for live mode → provides `imageUri` and `isCapturing`.
- Use `usePreview()` for snap → provides `snapOnce`.
- Merge `imageUri` from both sources: prefer stream URI when live, fall back to snap URI.
- Pass `isCapturing` through to Viewfinder.

### Data flow

```
[Live mode ON]
  HomeScreen sets previewActive=true
    → usePreviewStream opens WebSocket
      → Pi sends binary JPEG frames at adaptive FPS
        → Hook converts to base64 data URI
          → Viewfinder double-buffer swaps on load

[Snap pressed]
  HomeScreen calls snapOnce()
    → HTTP GET /api/preview + Image.prefetch
      → Sets imageUri once
        → Viewfinder double-buffer swaps on load

[Still capture in progress on Pi]
  capture_preview() blocks on camera lock (~1-2s)
    → Frame takes >500ms → Pi sends {"status": "capturing"}
      → App shows capture indicator
    → Frame completes → Pi sends {"status": "streaming"}
      → App hides capture indicator
    → Normal frame flow resumes
```

### WebSocket protocol

| Direction | Type | Payload |
|-----------|------|---------|
| Server → Client | binary | Raw JPEG bytes (one complete frame) |
| Server → Client | text | `{"status": "capturing"}` or `{"status": "streaming"}` |
| Client → Server | text | `{"fps": N, "quality": N}` (both fields optional) |

### Error handling

- **WebSocket disconnect**: App reconnects after 1 second. Viewfinder holds last frame via double-buffer.
- **Camera not started**: WebSocket handler sends `{"error": "camera not available"}` and closes with 1011 (internal error).
- **Invalid client message**: Ignored (log warning server-side).

### Screen focus behavior

The WebSocket connects/disconnects based on `previewActive`, which is `isFocused && livePreview && !isRecording`. Navigating away from HomeScreen closes the socket. Returning reconnects.

## Files changed

| File | Change |
|------|--------|
| `pi/services/camera.py` | Add `quality` param to `capture_preview()` |
| `pi/api/routers/preview_ws.py` | **New** — WebSocket endpoint |
| `pi/api/main.py` | Register new router |
| `app/src/hooks/usePreviewStream.ts` | **New** — WebSocket preview hook |
| `app/src/hooks/usePreview.ts` | Strip polling, keep snapOnce only |
| `app/src/components/home/Viewfinder.tsx` | Add `isCapturing` prop + overlay indicator |
| `app/src/screens/HomeScreen.tsx` | Wire up both hooks, pass isCapturing |
| `app/src/api/client.ts` | Add `previewWsUrl()` helper |

## What stays the same

- `GET /api/preview` HTTP endpoint — unchanged, used by snap.
- `Viewfinder` double-buffer rendering — unchanged, receives URIs from either source.
- `PreviewControls` component — unchanged.
- Camera service internals (lock, preview/still mode switching) — unchanged except quality param.
- All other API endpoints — unchanged.
