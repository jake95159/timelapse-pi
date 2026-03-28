from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.dependencies import ServiceContainer


@asynccontextmanager
async def lifespan(app: FastAPI):
    services: ServiceContainer = app.state.services
    try:
        services.camera.start()
    except Exception:
        pass  # Camera unavailable (testing or AUTO mode)
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
) -> FastAPI:
    from api.routers import batches, capture, network, preview, settings, status

    app = FastAPI(title="TimelapsePi API", lifespan=lifespan)

    app.state.services = ServiceContainer(
        config_path=config_path,
        images_dir=images_dir,
        sequence_file=sequence_file,
        camera=camera,
        wifi=wifi,
    )

    app.include_router(status.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    app.include_router(capture.router, prefix="/api")
    app.include_router(preview.router, prefix="/api")
    app.include_router(batches.router, prefix="/api")
    app.include_router(network.router, prefix="/api")

    return app
