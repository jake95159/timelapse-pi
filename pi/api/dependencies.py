from fastapi import Request

from services.batch_manager import BatchManager
from services.camera import CameraService
from services.capture_loop import CaptureLoop
from services.config import ConfigService
from services.power import PowerService
from services.wifi_manager import WifiManager


class ServiceContainer:
    def __init__(
        self,
        config_path: str,
        images_dir: str,
        sequence_file: str,
        camera=None,
        wifi=None,
        power=None,
    ):
        self.config = ConfigService(config_path)
        self.batch_manager = BatchManager(images_dir)
        self.camera = camera if camera is not None else CameraService()
        self.capture_loop = CaptureLoop(
            self.camera, self.batch_manager, sequence_file
        )
        self.wifi = wifi if wifi is not None else WifiManager()
        if power is not None:
            self.power = power
        else:
            config = self.config.load()
            self.power = PowerService(
                volt_multiplier=config.get("power", {}).get("volt_multiplier", 12.71),
            )


def get_services(request: Request) -> ServiceContainer:
    return request.app.state.services
