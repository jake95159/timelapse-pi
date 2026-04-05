import threading
from io import BytesIO


class CameraService:
    """Wraps picamera2 with a threading lock for safe shared access.

    Runs in preview mode (800x600) by default. Switches to full-res
    still mode for captures using switch_mode_and_capture_file(),
    which automatically returns to preview mode after capture.
    """

    PREVIEW_SIZE = (800, 600)
    STILL_SIZE = (4056, 3040)

    def __init__(self):
        self._camera = None
        self._lock = threading.Lock()
        self._still_config = None
        self._started = False

    @property
    def is_started(self) -> bool:
        return self._started

    def start(self) -> None:
        if self._started:
            return
        from picamera2 import Picamera2

        self._camera = Picamera2()
        preview_config = self._camera.create_preview_configuration(
            main={"size": self.PREVIEW_SIZE, "format": "RGB888"}
        )
        self._still_config = self._camera.create_still_configuration(
            main={"size": self.STILL_SIZE, "format": "RGB888"}
        )
        self._camera.configure(preview_config)
        self._camera.start()
        self._started = True

    def stop(self) -> None:
        if not self._started:
            return
        self._camera.stop()
        self._camera.close()
        self._camera = None
        self._started = False

    def capture_preview(self) -> bytes:
        """Grab current preview frame as JPEG bytes."""
        with self._lock:
            from PIL import Image

            array = self._camera.capture_array("main")
            img = Image.fromarray(array)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=70)
            return buf.getvalue()

    def capture_still(self, filepath: str) -> None:
        """Capture full-resolution still to file. Blocks during capture."""
        with self._lock:
            self._camera.switch_mode_and_capture_file(
                self._still_config, filepath
            )

    def update_settings(
        self,
        iso: int = None,
        exposure_mode: str = None,
        awb_mode: str = None,
        shutter_speed: int = None,
        ev_compensation: float = None,
        metering_mode: str = None,
        brightness: float = None,
        contrast: float = None,
        saturation: float = None,
        sharpness: float = None,
        noise_reduction: str = None,
    ) -> None:
        """Apply camera control settings."""
        controls = {}
        if iso is not None:
            controls["AnalogueGain"] = iso / 100.0
        if exposure_mode == "auto":
            controls["AeEnable"] = True
        elif exposure_mode == "manual":
            controls["AeEnable"] = False
        if awb_mode is not None:
            awb_map = {
                "auto": 0,
                "daylight": 1,
                "cloudy": 2,
                "tungsten": 3,
                "fluorescent": 4,
            }
            if awb_mode in awb_map:
                controls["AwbMode"] = awb_map[awb_mode]
        if shutter_speed is not None:
            controls["ExposureTime"] = shutter_speed
        if ev_compensation is not None:
            controls["ExposureValue"] = ev_compensation
        if metering_mode is not None:
            metering_map = {"centre": 0, "spot": 1, "matrix": 2}
            if metering_mode in metering_map:
                controls["AeMeteringMode"] = metering_map[metering_mode]
        if brightness is not None:
            controls["Brightness"] = brightness
        if contrast is not None:
            controls["Contrast"] = contrast
        if saturation is not None:
            controls["Saturation"] = saturation
        if sharpness is not None:
            controls["Sharpness"] = sharpness
        if noise_reduction is not None:
            nr_map = {"off": 0, "fast": 1, "high_quality": 2, "minimal": 3}
            if noise_reduction in nr_map:
                controls["NoiseReductionMode"] = nr_map[noise_reduction]
        if controls:
            with self._lock:
                self._camera.set_controls(controls)
