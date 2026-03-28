from fastapi import APIRouter, Depends
from fastapi.responses import Response

from api.dependencies import ServiceContainer, get_services

router = APIRouter()


@router.get("/preview")
async def get_preview(services: ServiceContainer = Depends(get_services)):
    jpeg_bytes = services.camera.capture_preview()
    return Response(content=jpeg_bytes, media_type="image/jpeg")
