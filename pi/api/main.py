from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.dependencies import ServiceContainer


@asynccontextmanager
async def lifespan(app: FastAPI):
    services: ServiceContainer = app.state.services
    try:
        config = services.config.load()
        tuning = config.get("camera", {}).get("tuning", "standard")
        services.camera.start(tuning=tuning)

        # Apply all saved camera settings so AWB/exposure work from boot
        cam = config.get("camera", {})
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
    except Exception:
        pass
    yield
    try:
        services.capture_loop.stop()
    except Exception:
        pass
    try:
        services.camera.stop()
    except Exception:
        pass


def create_app(
    config_path: str,
    images_dir: str,
    sequence_file: str,
    camera=None,
    wifi=None,
    power=None,
) -> FastAPI:
    from api.routers import batches, capture, network, preview, preview_stream, settings, status

    app = FastAPI(title="TimelapsePi API", lifespan=lifespan)

    app.state.services = ServiceContainer(
        config_path=config_path,
        images_dir=images_dir,
        sequence_file=sequence_file,
        camera=camera,
        wifi=wifi,
        power=power,
    )

    app.include_router(status.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    app.include_router(capture.router, prefix="/api")
    app.include_router(preview.router, prefix="/api")
    app.include_router(preview_stream.router, prefix="/api")
    app.include_router(batches.router, prefix="/api")
    app.include_router(network.router, prefix="/api")

    return app
