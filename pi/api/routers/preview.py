from fastapi import APIRouter, Depends
from fastapi.responses import Response

from api.dependencies import ServiceContainer, get_services

router = APIRouter()


@router.get("/preview")
async def get_preview(services: ServiceContainer = Depends(get_services)):
    jpeg_bytes = services.camera.capture_preview()
    return Response(content=jpeg_bytes, media_type="image/jpeg")


@router.get("/preview/sample")
async def sample_preview(
    x: float, y: float, services: ServiceContainer = Depends(get_services)
):
    """Sample RGB at normalised (0-1) coordinates from the current preview frame."""
    x = max(0.0, min(1.0, x))
    y = max(0.0, min(1.0, y))
    return services.camera.sample_pixel(x, y)
