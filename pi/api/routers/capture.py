from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import ServiceContainer, get_services
from api.models import CaptureLoopStart

router = APIRouter()


@router.post("/capture")
async def capture_single(services: ServiceContainer = Depends(get_services)):
    result = services.capture_loop.capture_single()
    return result


@router.post("/capture/loop/start")
async def start_capture_loop(
    body: CaptureLoopStart, services: ServiceContainer = Depends(get_services)
):
    try:
        batch_id = services.capture_loop.start(body.interval_sec)
    except RuntimeError:
        raise HTTPException(status_code=409, detail="Capture loop already running")
    return {"status": "started", "batch_id": batch_id}


@router.post("/capture/loop/stop")
async def stop_capture_loop(
    services: ServiceContainer = Depends(get_services),
):
    count = services.capture_loop.stop()
    return {"status": "stopped", "capture_count": count}
