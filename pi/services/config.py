import json
import os
import copy

DEFAULT_CONFIG = {
    "location": {"lat": 0.0, "lon": 0.0},
    "daylight_only": False,
    "sunrise_offset_min": 0,
    "sunset_offset_min": 0,
    "window_start": "00:00",
    "window_end": "23:59",
    "hardware_interval_sec": 3600,
    "software_interval_sec": 60,
    "camera": {
        "iso": 100,
        "exposure_mode": "auto",
        "shutter_speed": None,
        "awb_mode": "auto",
        "ev_compensation": 0.0,
        "metering_mode": "centre",
        "brightness": 0.0,
        "contrast": 1.0,
        "saturation": 1.0,
        "sharpness": 1.0,
        "noise_reduction": "off",
    },
    "ap": {
        "ssid": "TimelapsePi",
        "password": "timelapse",
    },
    "power": {
        "volt_multiplier": 12.71,
        "battery_mah": 9700,
        "bypass_draw_ma": 180,
        "auto_draw_ma": 180,
        "auto_on_time_sec": 25,
    },
}


class ConfigService:
    def __init__(self, config_path: str):
        self._path = config_path

    def load(self) -> dict:
        merged = copy.deepcopy(DEFAULT_CONFIG)
        if os.path.exists(self._path):
            with open(self._path, "r") as f:
                stored = json.load(f)
            self._deep_merge(merged, stored)
        return merged

    def save(self, config: dict) -> None:
        os.makedirs(os.path.dirname(self._path) or ".", exist_ok=True)
        with open(self._path, "w") as f:
            json.dump(config, f, indent=2)
            f.flush()
            os.fsync(f.fileno())

    def merge(self, updates: dict) -> dict:
        config = self.load()
        self._deep_merge(config, updates)
        self.save(config)
        return config

    @staticmethod
    def _deep_merge(base: dict, updates: dict) -> None:
        for key, value in updates.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                ConfigService._deep_merge(base[key], value)
            else:
                base[key] = value
