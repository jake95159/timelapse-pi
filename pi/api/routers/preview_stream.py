import asyncio
import logging
import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from api.dependencies import ServiceContainer, get_services

router = APIRouter()
logger = logging.getLogger(__name__)

BOUNDARY = "frame"

# Adaptive presets by network mode
_PRESETS = {
    "ap":     {"fps": 4,  "quality": 50},
    "client": {"fps": 10, "quality": 70},
}
_DEFAULT = _PRESETS["client"]


@router.get("/preview/stream")
async def preview_stream(request: Request):
    services: ServiceContainer = request.app.state.services

    # Pick FPS/quality based on network mode
    try:
        net = services.wifi.get_status()
        preset = _PRESETS.get(net.get("mode"), _DEFAULT)
    except Exception:
        preset = _DEFAULT

    fps = preset["fps"]
    quality = preset["quality"]
    loop = asyncio.get_event_loop()

    async def generate():
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            t0 = time.monotonic()
            try:
                jpeg = await loop.run_in_executor(
                    None, services.camera.capture_preview, quality
                )
            except Exception:
                await asyncio.sleep(0.1)
                continue

            # MJPEG multipart frame
            yield (
                f"--{BOUNDARY}\r\n"
                f"Content-Type: image/jpeg\r\n"
                f"Content-Length: {len(jpeg)}\r\n"
                f"\r\n"
            ).encode() + jpeg + b"\r\n"

            # Sleep for remainder of frame interval
            elapsed = time.monotonic() - t0
            frame_time = 1.0 / max(fps, 1)
            sleep_time = max(0, frame_time - elapsed)
            await asyncio.sleep(sleep_time)

    return StreamingResponse(
        generate(),
        media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}",
    )
