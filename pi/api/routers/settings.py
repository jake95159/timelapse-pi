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

        # Tuning file change requires camera restart
        if "tuning" in updates.get("camera", {}):
            services.camera.restart_with_tuning(cam.get("tuning", "standard"))

        services.camera.update_settings(
            analogue_gain=cam.get("analogue_gain"),
            exposure_mode=cam.get("exposure_mode"),
            awb_mode=cam.get("awb_mode"),
            red_gain=cam.get("red_gain"),
            blue_gain=cam.get("blue_gain"),
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
