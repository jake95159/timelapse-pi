from fastapi import APIRouter, Depends

from api.dependencies import ServiceContainer, get_services

router = APIRouter()


@router.get("/settings")
async def get_settings(services: ServiceContainer = Depends(get_services)):
    return services.config.load()


@router.patch("/settings")
async def update_settings(
    updates: dict, services: ServiceContainer = Depends(get_services)
):
    config = services.config.merge(updates)

    # Auto-apply camera settings so preview reflects changes immediately
    if "camera" in updates and services.camera.is_started:
        cam = config.get("camera", {})
        services.camera.update_settings(
            iso=cam.get("iso"),
            exposure_mode=cam.get("exposure_mode"),
            awb_mode=cam.get("awb_mode"),
            shutter_speed=cam.get("shutter_speed"),
            ev_compensation=cam.get("ev_compensation"),
            metering_mode=cam.get("metering_mode"),
            brightness=cam.get("brightness"),
            contrast=cam.get("contrast"),
            saturation=cam.get("saturation"),
            sharpness=cam.get("sharpness"),
            noise_reduction=cam.get("noise_reduction"),
        )

    return config
