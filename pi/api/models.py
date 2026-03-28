from pydantic import BaseModel
from typing import Optional


class CaptureLoopStart(BaseModel):
    interval_sec: float


class BatchRename(BaseModel):
    name: str


class BatchSplit(BaseModel):
    after_image_id: str


class BatchMerge(BaseModel):
    batch_ids: list[str]


class NetworkConnect(BaseModel):
    ssid: str
    password: str


class APConfig(BaseModel):
    ssid: Optional[str] = None
    password: Optional[str] = None
