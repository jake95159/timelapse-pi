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
    power_config = config.get("power", {})

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

    # Battery
    power_status = services.power.get_status()
    battery_voltage = power_status["battery_voltage"]
    battery_soc_pct = power_status["battery_soc_pct"]

    # Runtime estimate
    interval = config.get("hardware_interval_sec", 3600)
    runtime_hours = services.power.estimate_runtime(
        battery_soc_pct, mode, power_config, interval_sec=interval,
    )

    # Fallback: capacity-based estimate when voltage unavailable
    if runtime_hours is None:
        battery_mah = power_config.get("battery_mah", 9700)
        if mode == "bypass":
            runtime_hours = round(battery_mah / power_config.get("bypass_draw_ma", 180), 1)
        else:
            duty = power_config.get("auto_on_time_sec", 25) / max(interval, 1)
            avg_ma = power_config.get("auto_draw_ma", 180) * duty + 0.035 * (1 - duty)
            runtime_hours = round(battery_mah / max(avg_ma, 0.01), 1)
    else:
        runtime_hours = round(runtime_hours, 1)

    return {
        "mode": mode,
        "capture_state": "running" if services.capture_loop.is_running else "idle",
        "capture_count": services.capture_loop.capture_count,
        "last_capture": last_capture,
        "storage_used_pct": storage_used_pct,
        "storage_free_mb": storage_free_mb,
        "battery_voltage": battery_voltage,
        "battery_soc_pct": battery_soc_pct,
        "battery_mah": power_config.get("battery_mah", 9700),
        "runtime_estimate_hours": runtime_hours,
        "software_interval_sec": config.get("software_interval_sec"),
        "hardware_interval_sec": config.get("hardware_interval_sec"),
        "uptime_sec": round(time.time() - _start_time),
    }
