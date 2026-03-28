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
    return services.config.merge(updates)
