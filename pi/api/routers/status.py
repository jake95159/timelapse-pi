import shutil
import time

from fastapi import APIRouter, Depends

from api.dependencies import ServiceContainer, get_services
from services.mode import detect_mode

router = APIRouter()

_start_time = time.time()


@router.get("/status")
async def get_status(services: ServiceContainer = Depends(get_services)):
    config = services.config.load()
    mode = detect_mode()

    # Storage
    try:
        usage = shutil.disk_usage(services.batch_manager._images_dir)
        storage_used_pct = round((usage.used / usage.total) * 100, 1)
        storage_free_mb = round(usage.free / (1024 * 1024))
    except Exception:
        storage_used_pct = 0.0
        storage_free_mb = 0

    # Last capture from most recent batch
    last_capture = None
    batches = services.batch_manager.list_batches()
    if batches:
        last_batch = batches[-1]
        detail = services.batch_manager.get_batch(last_batch["id"])
        if detail.get("images"):
            last_img = detail["images"][-1]
            last_capture = {
                "image_id": last_img["id"],
                "batch_id": last_batch["id"],
            }

    # Battery estimate
    battery_mah = config.get("battery_mah", 5000)
    if mode == "bypass":
        runtime_hours = round(battery_mah / 180, 1)
    else:
        interval = config.get("hardware_interval_sec", 3600)
        duty = 25 / max(interval, 1)
        avg_ma = 180 * duty + 0.1 * (1 - duty)
        runtime_hours = round(battery_mah / max(avg_ma, 0.01), 1)

    return {
        "mode": mode,
        "capture_state": "running" if services.capture_loop.is_running else "idle",
        "capture_count": services.capture_loop.capture_count,
        "last_capture": last_capture,
        "storage_used_pct": storage_used_pct,
        "storage_free_mb": storage_free_mb,
        "battery_mah": battery_mah,
        "runtime_estimate_hours": runtime_hours,
        "software_interval_sec": config.get("software_interval_sec"),
        "hardware_interval_sec": config.get("hardware_interval_sec"),
        "uptime_sec": round(time.time() - _start_time),
    }
