from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import ServiceContainer, get_services
from api.models import APConfig, NetworkConnect

router = APIRouter()


@router.get("/network/status")
async def network_status(services: ServiceContainer = Depends(get_services)):
    return services.wifi.get_status()


@router.get("/network/scan")
async def network_scan(services: ServiceContainer = Depends(get_services)):
    return services.wifi.scan()


@router.post("/network/connect")
async def network_connect(
    body: NetworkConnect, services: ServiceContainer = Depends(get_services)
):
    services.wifi.connect(body.ssid, body.password)
    return {"status": "connecting"}


@router.post("/network/ap")
async def start_ap(
    body: APConfig = APConfig(),
    services: ServiceContainer = Depends(get_services),
):
    config = services.config.load()
    ssid = body.ssid or config.get("ap", {}).get("ssid", "TimelapsePi")
    password = body.password or config.get("ap", {}).get("password", "timelapse")
    success = services.wifi.start_ap(ssid, password)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to start AP")
    return {"status": "activating"}


@router.get("/network/saved")
async def saved_networks(services: ServiceContainer = Depends(get_services)):
    return services.wifi.get_saved_networks()


@router.delete("/network/saved/{ssid}")
async def delete_saved_network(
    ssid: str, services: ServiceContainer = Depends(get_services)
):
    services.wifi.remove_saved_network(ssid)
    return {"status": "removed"}
