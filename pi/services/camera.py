import threading
from io import BytesIO


TUNING_FILES = {
    "standard": "imx477.json",
    "scientific": "imx477_scientific.json",
}


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
        self._tuning_name = "standard"

    @property
    def is_started(self) -> bool:
        return self._started

    def start(self, tuning: str = None) -> None:
        if self._started:
            return
        from picamera2 import Picamera2

        tuning_dict = None
        if tuning and tuning in TUNING_FILES:
            self._tuning_name = tuning
            tuning_dict = Picamera2.load_tuning_file(TUNING_FILES[tuning])

        self._camera = Picamera2(tuning=tuning_dict)
        preview_config = self._camera.create_preview_configuration(
            main={"size": self.PREVIEW_SIZE, "format": "RGB888"}
        )
        self._still_config = self._camera.create_still_configuration(
            main={"size": self.STILL_SIZE, "format": "RGB888"}
        )
        self._camera.configure(preview_config)
        self._camera.start()
        self._started = True

    def restart_with_tuning(self, tuning: str) -> None:
        """Stop camera, re-init with a different tuning file, start again."""
        if tuning == self._tuning_name and self._started:
            return
        self.stop()
        self.start(tuning=tuning)

    def stop(self) -> None:
        if not self._started:
            return
        self._camera.stop()
        self._camera.close()
        self._camera = None
        self._started = False

    def capture_preview(self, quality: int = 70) -> bytes:
        """Grab current preview frame as JPEG bytes."""
        with self._lock:
            from PIL import Image

            array = self._camera.capture_array("main")
            # picamera2 "RGB888" is V4L2_PIX_FMT_BGR24 — bytes are BGR in memory
            array = array[:, :, ::-1]
            img = Image.fromarray(array)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=quality)
            return buf.getvalue()

    def capture_still(self, filepath: str) -> None:
        """Capture full-resolution still to file. Blocks during capture."""
        with self._lock:
            self._camera.switch_mode_and_capture_file(
                self._still_config, filepath
            )

    def sample_pixel(self, norm_x: float, norm_y: float, radius: int = 5) -> dict:
        """Sample average RGB at normalised coordinates from the current preview.

        Returns dict with r, g, b integer values (0-255).
        A small square region of *radius* pixels is averaged to reduce noise.
        """
        with self._lock:
            array = self._camera.capture_array("main")

        # picamera2 "RGB888" is BGR in memory — swap to real RGB
        array = array[:, :, ::-1]

        h, w = array.shape[:2]
        cx = int(norm_x * w)
        cy = int(norm_y * h)

        x0 = max(0, cx - radius)
        x1 = min(w, cx + radius + 1)
        y0 = max(0, cy - radius)
        y1 = min(h, cy + radius + 1)

        region = array[y0:y1, x0:x1]
        r = float(region[:, :, 0].mean())
        g = float(region[:, :, 1].mean())
        b = float(region[:, :, 2].mean())

        return {"r": round(r), "g": round(g), "b": round(b)}

    def update_settings(
        self,
        analogue_gain: float = None,
        exposure_mode: str = None,
        awb_mode: str = None,
        red_gain: float = None,
        blue_gain: float = None,
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
        if analogue_gain is not None:
            controls["AnalogueGain"] = analogue_gain
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
                "indoor": 5,
            }
            if awb_mode == "manual":
                controls["AwbEnable"] = False
                if red_gain is not None and blue_gain is not None:
                    controls["ColourGains"] = (red_gain, blue_gain)
            elif awb_mode in awb_map:
                controls["AwbEnable"] = True
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
