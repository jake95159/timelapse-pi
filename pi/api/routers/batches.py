import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from api.dependencies import ServiceContainer, get_services
from api.models import BatchMerge, BatchRename, BatchSplit

router = APIRouter()


@router.get("/batches")
async def list_batches(services: ServiceContainer = Depends(get_services)):
    return services.batch_manager.list_batches()


@router.get("/batches/{batch_id}")
async def get_batch(
    batch_id: str, services: ServiceContainer = Depends(get_services)
):
    try:
        return services.batch_manager.get_batch(batch_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Batch not found")


@router.patch("/batches/{batch_id}")
async def rename_batch(
    batch_id: str,
    body: BatchRename,
    services: ServiceContainer = Depends(get_services),
):
    try:
        return services.batch_manager.rename_batch(batch_id, body.name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Batch not found")


@router.post("/batches/{batch_id}/split")
async def split_batch(
    batch_id: str,
    body: BatchSplit,
    services: ServiceContainer = Depends(get_services),
):
    try:
        a, b = services.batch_manager.split_batch(batch_id, body.after_image_id)
        return {"batch_a": a, "batch_b": b}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Batch not found")


@router.post("/batches/merge")
async def merge_batches(
    body: BatchMerge, services: ServiceContainer = Depends(get_services)
):
    if len(body.batch_ids) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 batch IDs required")
    try:
        merged = services.batch_manager.merge_batches(
            body.batch_ids[0], body.batch_ids[1]
        )
        return {"merged_batch": merged}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Batch not found")


@router.delete("/batches/{batch_id}")
async def delete_batch(
    batch_id: str, services: ServiceContainer = Depends(get_services)
):
    try:
        count = services.batch_manager.delete_batch(batch_id)
        return {"deleted_count": count}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Batch not found")


@router.get("/batches/{batch_id}/images/{image_id}")
async def get_image(
    batch_id: str,
    image_id: str,
    services: ServiceContainer = Depends(get_services),
):
    path = services.batch_manager.get_image_path(batch_id, image_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path, media_type="image/jpeg")


@router.get("/batches/{batch_id}/images/{image_id}/thumb")
async def get_image_thumb(
    batch_id: str,
    image_id: str,
    services: ServiceContainer = Depends(get_services),
):
    thumb_path = services.batch_manager.get_thumb_path(batch_id, image_id)
    if not os.path.exists(thumb_path):
        image_path = services.batch_manager.get_image_path(batch_id, image_id)
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Image not found")
        services.batch_manager.generate_thumbnail(image_path)
    return FileResponse(thumb_path, media_type="image/jpeg")
