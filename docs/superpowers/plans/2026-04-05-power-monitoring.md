# Power Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add battery voltage monitoring via ADS1115 ADC, with 3S LiPo state-of-charge estimation and runtime predictions in the API.

**Architecture:** New `PowerService` class reads voltage from ADS1115 over I2C, maps to SoC via a lookup table, and estimates runtime. Injected into the existing `ServiceContainer` and exposed through the existing `/api/status` endpoint. Graceful degradation when hardware absent.

**Tech Stack:** Python 3.11, adafruit-circuitpython-ads1x15, FastAPI, pytest

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `pi/services/power.py` | Create | PowerService: voltage reading, SoC lookup, runtime estimation |
| `pi/services/config.py` | Modify | Add `power` section to DEFAULT_CONFIG, remove top-level `battery_mah` |
| `pi/api/dependencies.py` | Modify | Add PowerService to ServiceContainer |
| `pi/api/routers/status.py` | Modify | Add battery_voltage, battery_soc_pct to response, use config power values |
| `pi/requirements.txt` | Modify | Add adafruit-circuitpython-ads1x15 |
| `pi/tests/test_power.py` | Create | Unit tests for PowerService |
| `pi/tests/test_api/test_status.py` | Modify | Test battery fields in status response |
| `pi/tests/test_config.py` | Modify | Update test for moved battery_mah |
| `provision.sh` | Modify | Enable I2C, install pip dependency |

---

### Task 1: PowerService — voltage reading and SoC lookup

**Files:**
- Create: `pi/services/power.py`
- Create: `pi/tests/test_power.py`

- [ ] **Step 1: Write failing tests for SoC lookup**

Create `pi/tests/test_power.py`:

```python
import pytest
from services.power import PowerService


class TestGetSoc:
    def test_full_charge(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(12.6) == 100.0

    def test_empty(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(9.0) == 0.0

    def test_below_empty_clamps(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(8.0) == 0.0

    def test_above_full_clamps(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(13.0) == 100.0

    def test_midpoint_interpolation(self):
        svc = PowerService(hw_enabled=False)
        # 11.6V = 60%, 12.0V = 80%, so 11.8V should be 70%
        assert svc.get_soc(11.8) == pytest.approx(70.0)

    def test_low_battery(self):
        svc = PowerService(hw_enabled=False)
        # 10.5V = 5%, 11.0V = 10%, so 10.75V should be 7.5%
        assert svc.get_soc(10.75) == pytest.approx(7.5)

    def test_exact_table_value(self):
        svc = PowerService(hw_enabled=False)
        assert svc.get_soc(11.4) == 40.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pi && python -m pytest tests/test_power.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.power'`

- [ ] **Step 3: Implement PowerService with SoC lookup**

Create `pi/services/power.py`:

```python
import time
import logging

logger = logging.getLogger(__name__)

# 3S LiPo discharge curve: (voltage, soc_percent)
# Sorted descending by voltage for lookup
_SOC_TABLE = [
    (12.60, 100.0),
    (12.40, 95.0),
    (12.00, 80.0),
    (11.60, 60.0),
    (11.40, 40.0),
    (11.20, 20.0),
    (11.00, 10.0),
    (10.50, 5.0),
    (9.00, 0.0),
]


class PowerService:
    def __init__(self, volt_multiplier: float = 12.71, hw_enabled: bool = True):
        self._multiplier = volt_multiplier
        self._ads = None
        self._voltage_channel = None
        self._cache = None
        self._cache_time = 0.0
        self._cache_ttl = 5.0

        if hw_enabled:
            try:
                import board
                import busio
                import adafruit_ads1x15.ads1115 as ADS
                from adafruit_ads1x15.analog_in import AnalogIn

                i2c = busio.I2C(board.SCL, board.SDA)
                self._ads = ADS.ADS1115(i2c)
                self._ads.gain = 1  # +/- 4.096V
                self._voltage_channel = AnalogIn(self._ads, 0)
                logger.info("PowerService: ADS1115 initialized")
            except Exception as e:
                logger.warning(f"PowerService: ADS1115 unavailable ({e})")

    def read_voltage(self) -> float | None:
        if self._voltage_channel is None:
            return None

        now = time.monotonic()
        if self._cache is not None and (now - self._cache_time) < self._cache_ttl:
            return self._cache

        try:
            samples = []
            for _ in range(5):
                samples.append(self._voltage_channel.voltage)
                time.sleep(0.05)
            sense_v = sum(samples) / len(samples)
            voltage = sense_v * self._multiplier
            self._cache = voltage
            self._cache_time = now
            return voltage
        except Exception as e:
            logger.warning(f"PowerService: read error ({e})")
            return self._cache

    def get_soc(self, voltage: float) -> float:
        if voltage >= _SOC_TABLE[0][0]:
            return _SOC_TABLE[0][1]
        if voltage <= _SOC_TABLE[-1][0]:
            return _SOC_TABLE[-1][1]

        for i in range(len(_SOC_TABLE) - 1):
            v_high, soc_high = _SOC_TABLE[i]
            v_low, soc_low = _SOC_TABLE[i + 1]
            if v_low <= voltage <= v_high:
                ratio = (voltage - v_low) / (v_high - v_low)
                return soc_low + ratio * (soc_high - soc_low)

        return 0.0

    def get_status(self) -> dict:
        voltage = self.read_voltage()
        soc = self.get_soc(voltage) if voltage is not None else None
        return {
            "battery_voltage": round(voltage, 2) if voltage is not None else None,
            "battery_soc_pct": round(soc, 1) if soc is not None else None,
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pi && python -m pytest tests/test_power.py -v`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add pi/services/power.py pi/tests/test_power.py
git commit -m "feat: add PowerService with 3S LiPo SoC lookup table"
```

---

### Task 2: PowerService — runtime estimation

**Files:**
- Modify: `pi/services/power.py`
- Modify: `pi/tests/test_power.py`

- [ ] **Step 1: Write failing tests for runtime estimation**

Append to `pi/tests/test_power.py`:

```python
class TestEstimateRuntime:
    def test_bypass_full_charge(self):
        svc = PowerService(hw_enabled=False)
        config = {"battery_mah": 9700, "bypass_draw_ma": 180}
        hours = svc.estimate_runtime(100.0, "bypass", config)
        assert hours == pytest.approx(9700 / 180, rel=0.01)

    def test_bypass_half_charge(self):
        svc = PowerService(hw_enabled=False)
        config = {"battery_mah": 9700, "bypass_draw_ma": 180}
        hours = svc.estimate_runtime(50.0, "bypass", config)
        assert hours == pytest.approx(4850 / 180, rel=0.01)

    def test_auto_mode(self):
        svc = PowerService(hw_enabled=False)
        config = {
            "battery_mah": 9700,
            "auto_draw_ma": 180,
            "auto_on_time_sec": 25,
        }
        hours = svc.estimate_runtime(100.0, "auto", config, interval_sec=3600)
        # duty = 25/3600, avg_ma = 180*(25/3600) + 0.035*(1-25/3600) ~ 1.28
        assert hours > 1000  # should be very long runtime

    def test_returns_none_when_soc_none(self):
        svc = PowerService(hw_enabled=False)
        config = {"battery_mah": 9700, "bypass_draw_ma": 180}
        assert svc.estimate_runtime(None, "bypass", config) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pi && python -m pytest tests/test_power.py::TestEstimateRuntime -v`
Expected: FAIL — `AttributeError: 'PowerService' object has no attribute 'estimate_runtime'`

- [ ] **Step 3: Add estimate_runtime method to PowerService**

Add to `pi/services/power.py` at the end of the `PowerService` class:

```python
    def estimate_runtime(
        self,
        soc: float | None,
        mode: str,
        config: dict,
        interval_sec: int = 3600,
    ) -> float | None:
        if soc is None:
            return None

        remaining_mah = config["battery_mah"] * (soc / 100.0)

        if mode == "bypass":
            draw_ma = config["bypass_draw_ma"]
        else:
            on_time = config.get("auto_on_time_sec", 25)
            duty = on_time / max(interval_sec, 1)
            draw_ma = config["auto_draw_ma"] * duty + 0.035 * (1 - duty)

        return remaining_mah / max(draw_ma, 0.01)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pi && python -m pytest tests/test_power.py -v`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add pi/services/power.py pi/tests/test_power.py
git commit -m "feat: add runtime estimation to PowerService"
```

---

### Task 3: Config — add power section

**Files:**
- Modify: `pi/services/config.py`
- Modify: `pi/tests/test_config.py`

- [ ] **Step 1: Write failing test for power config defaults**

Add to `pi/tests/test_config.py` in `TestConfigLoad`:

```python
    def test_power_defaults(self, tmp_path):
        svc = ConfigService(str(tmp_path / "config.json"))
        config = svc.load()
        assert config["power"]["volt_multiplier"] == 12.71
        assert config["power"]["battery_mah"] == 9700
        assert config["power"]["bypass_draw_ma"] == 180
        assert config["power"]["auto_draw_ma"] == 180
        assert config["power"]["auto_on_time_sec"] == 25
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pi && python -m pytest tests/test_config.py::TestConfigLoad::test_power_defaults -v`
Expected: FAIL — `KeyError: 'power'`

- [ ] **Step 3: Update DEFAULT_CONFIG**

In `pi/services/config.py`, replace the `DEFAULT_CONFIG` dict:

```python
DEFAULT_CONFIG = {
    "location": {"lat": 0.0, "lon": 0.0},
    "daylight_only": False,
    "window_start": "00:00",
    "window_end": "23:59",
    "hardware_interval_sec": 3600,
    "software_interval_sec": 60,
    "camera": {
        "iso": 100,
        "exposure_mode": "auto",
        "shutter_speed": None,
        "awb_mode": "auto",
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
```

Note: `"battery_mah": 5000` top-level key is removed.

- [ ] **Step 4: Fix any tests that referenced top-level battery_mah**

In `pi/tests/test_config.py`, if any tests reference `config["battery_mah"]`, remove those assertions. (Currently no tests do — the existing tests reference `software_interval_sec` and `camera`.)

- [ ] **Step 5: Run all config tests**

Run: `cd pi && python -m pytest tests/test_config.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add pi/services/config.py pi/tests/test_config.py
git commit -m "feat: add power config section with calibration defaults"
```

---

### Task 4: Wire PowerService into ServiceContainer and status endpoint

**Files:**
- Modify: `pi/api/dependencies.py`
- Modify: `pi/api/routers/status.py`
- Modify: `pi/api/main.py`
- Modify: `pi/tests/test_api/conftest.py`
- Modify: `pi/tests/test_api/test_status.py`

- [ ] **Step 1: Write failing tests for battery fields in status**

Add to `pi/tests/test_api/test_status.py`:

```python
def test_status_includes_battery_voltage(client):
    resp = client.get("/api/status")
    data = resp.json()
    assert "battery_voltage" in data


def test_status_includes_battery_soc(client):
    resp = client.get("/api/status")
    data = resp.json()
    assert "battery_soc_pct" in data


def test_status_battery_null_without_hardware(client):
    resp = client.get("/api/status")
    data = resp.json()
    # In test environment, ADS1115 is not present
    assert data["battery_voltage"] is None
    assert data["battery_soc_pct"] is None


def test_status_runtime_estimate_without_hardware(client):
    resp = client.get("/api/status")
    data = resp.json()
    # Falls back to capacity-based estimate when voltage unavailable
    assert data["runtime_estimate_hours"] is not None
    assert data["runtime_estimate_hours"] > 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pi && python -m pytest tests/test_api/test_status.py -v`
Expected: FAIL — `battery_voltage` not in response

- [ ] **Step 3: Add PowerService to ServiceContainer**

Replace `pi/api/dependencies.py`:

```python
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
```

- [ ] **Step 4: Update create_app to accept power parameter**

In `pi/api/main.py`, add `power=None` parameter to `create_app` and pass it through:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.dependencies import ServiceContainer


@asynccontextmanager
async def lifespan(app: FastAPI):
    services: ServiceContainer = app.state.services
    try:
        services.camera.start()
    except Exception:
        pass  # Camera unavailable (testing or AUTO mode)
    yield
    try:
        services.capture_loop.stop()
    except Exception:
        pass
    try:
        services.camera.stop()
    except Exception:
        pass


def create_app(
    config_path: str,
    images_dir: str,
    sequence_file: str,
    camera=None,
    wifi=None,
    power=None,
) -> FastAPI:
    from api.routers import batches, capture, network, preview, settings, status

    app = FastAPI(title="TimelapsePi API", lifespan=lifespan)

    app.state.services = ServiceContainer(
        config_path=config_path,
        images_dir=images_dir,
        sequence_file=sequence_file,
        camera=camera,
        wifi=wifi,
        power=power,
    )

    app.include_router(status.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    app.include_router(capture.router, prefix="/api")
    app.include_router(preview.router, prefix="/api")
    app.include_router(batches.router, prefix="/api")
    app.include_router(network.router, prefix="/api")

    return app
```

- [ ] **Step 5: Update test conftest to pass mock power service**

In `pi/tests/test_api/conftest.py`, add a mock power fixture and pass it to create_app:

```python
import pytest
from unittest.mock import MagicMock
from PIL import Image
from io import BytesIO

from api.main import create_app
from services.power import PowerService

# Minimal valid JPEG for mock camera
_img = Image.new("RGB", (10, 10), "red")
_buf = BytesIO()
_img.save(_buf, "JPEG")
MINIMAL_JPEG = _buf.getvalue()


@pytest.fixture
def mock_camera():
    cam = MagicMock()
    cam.capture_preview.return_value = MINIMAL_JPEG
    cam.is_started = True

    def fake_capture(filepath):
        img = Image.new("RGB", (100, 80), "blue")
        img.save(filepath, "JPEG")

    cam.capture_still.side_effect = fake_capture
    return cam


@pytest.fixture
def mock_wifi():
    wifi = MagicMock()
    wifi.get_status.return_value = {
        "mode": "ap",
        "ssid": "TimelapsePi",
        "ip": "10.42.0.1",
        "signal_strength": None,
    }
    wifi.scan.return_value = []
    wifi.get_saved_networks.return_value = []
    return wifi


@pytest.fixture
def mock_power():
    return PowerService(hw_enabled=False)


@pytest.fixture
def app(tmp_path, mock_camera, mock_wifi, mock_power):
    images_dir = tmp_path / "images"
    images_dir.mkdir()
    return create_app(
        config_path=str(tmp_path / "config.json"),
        images_dir=str(images_dir),
        sequence_file=str(tmp_path / "sequence.txt"),
        camera=mock_camera,
        wifi=mock_wifi,
        power=mock_power,
    )


@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)
```

- [ ] **Step 6: Update status router to include battery data**

Replace `pi/api/routers/status.py`:

```python
import shutil
import time

from fastapi import APIRouter, Depends

from api.dependencies import ServiceContainer, get_services
from services.mode import detect_mode

router = APIRouter()

_start_time = time.time()


@router.get("/status")
async def get_status(services: ServiceContainer = Depends(get_services)):
    config = services.config.load()
    mode = detect_mode()
    power_config = config.get("power", {})

    # Storage
    try:
        usage = shutil.disk_usage(services.batch_manager._images_dir)
        storage_used_pct = round((usage.used / usage.total) * 100, 1)
        storage_free_mb = round(usage.free / (1024 * 1024))
    except Exception:
        storage_used_pct = 0.0
        storage_free_mb = 0

    # Last capture from most recent batch
    last_capture = None
    batches = services.batch_manager.list_batches()
    if batches:
        last_batch = batches[-1]
        detail = services.batch_manager.get_batch(last_batch["id"])
        if detail.get("images"):
            last_img = detail["images"][-1]
            last_capture = {
                "image_id": last_img["id"],
                "batch_id": last_batch["id"],
            }

    # Battery
    power_status = services.power.get_status()
    battery_voltage = power_status["battery_voltage"]
    battery_soc_pct = power_status["battery_soc_pct"]

    # Runtime estimate
    interval = config.get("hardware_interval_sec", 3600)
    runtime_hours = services.power.estimate_runtime(
        battery_soc_pct, mode, power_config, interval_sec=interval,
    )

    # Fallback: capacity-based estimate when voltage unavailable
    if runtime_hours is None:
        battery_mah = power_config.get("battery_mah", 9700)
        if mode == "bypass":
            runtime_hours = round(battery_mah / power_config.get("bypass_draw_ma", 180), 1)
        else:
            duty = power_config.get("auto_on_time_sec", 25) / max(interval, 1)
            avg_ma = power_config.get("auto_draw_ma", 180) * duty + 0.035 * (1 - duty)
            runtime_hours = round(battery_mah / max(avg_ma, 0.01), 1)
    else:
        runtime_hours = round(runtime_hours, 1)

    return {
        "mode": mode,
        "capture_state": "running" if services.capture_loop.is_running else "idle",
        "capture_count": services.capture_loop.capture_count,
        "last_capture": last_capture,
        "storage_used_pct": storage_used_pct,
        "storage_free_mb": storage_free_mb,
        "battery_voltage": battery_voltage,
        "battery_soc_pct": battery_soc_pct,
        "battery_mah": power_config.get("battery_mah", 9700),
        "runtime_estimate_hours": runtime_hours,
        "software_interval_sec": config.get("software_interval_sec"),
        "hardware_interval_sec": config.get("hardware_interval_sec"),
        "uptime_sec": round(time.time() - _start_time),
    }
```

- [ ] **Step 7: Run all tests**

Run: `cd pi && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add pi/api/dependencies.py pi/api/main.py pi/api/routers/status.py pi/tests/test_api/conftest.py pi/tests/test_api/test_status.py
git commit -m "feat: wire PowerService into API, add battery fields to status"
```

---

### Task 5: Provisioning and requirements

**Files:**
- Modify: `pi/requirements.txt`
- Modify: `provision.sh`

- [ ] **Step 1: Add ADS1115 library to requirements.txt**

In `pi/requirements.txt`, add:

```
adafruit-circuitpython-ads1x15>=3.0
```

- [ ] **Step 2: Update provision.sh — fix I2C enable and add pip dep**

In `provision.sh`, in section 4 (Python venv), add the new pip package. Change:

```bash
    venv/bin/pip install --quiet fastapi uvicorn python-multipart
```

to:

```bash
    venv/bin/pip install --quiet fastapi uvicorn python-multipart adafruit-circuitpython-ads1x15
```

In section 7 (boot config), fix the I2C grep to not match commented lines and add i2c-dev module loading. After the existing `grep -q 'gpio=27=pd'` block, add:

```bash
    # Enable I2C for ADS1115 ADC
    if ! grep -q '^dtparam=i2c_arm=on' \$CONFIG; then
        sudo sed -i 's/^#dtparam=i2c_arm=on/dtparam=i2c_arm=on/' \$CONFIG
        grep -q '^dtparam=i2c_arm=on' \$CONFIG || echo 'dtparam=i2c_arm=on' | sudo tee -a \$CONFIG > /dev/null
    fi

    # Ensure i2c-dev module loads at boot
    echo 'i2c-dev' | sudo tee /etc/modules-load.d/i2c.conf > /dev/null
```

- [ ] **Step 3: Commit**

```bash
git add pi/requirements.txt provision.sh
git commit -m "chore: add ADS1115 dependency and I2C provisioning"
```

---

### Task 6: Deploy and verify on hardware

**Files:** None (deployment and manual testing)

- [ ] **Step 1: Deploy to Pi**

```bash
rsync -az --exclude='venv/' --exclude='tests/' --exclude='__pycache__/' pi/ timelapse-pi:~/timelapse/
ssh timelapse-pi "dos2unix -q ~/timelapse/systemd/*.sh ~/timelapse/systemd/*.service 2>/dev/null"
```

- [ ] **Step 2: Install new pip dependency on Pi**

```bash
ssh timelapse-pi "~/timelapse/venv/bin/pip install --quiet adafruit-circuitpython-ads1x15"
```

- [ ] **Step 3: Restart API service**

```bash
ssh timelapse-pi "sudo systemctl restart timelapse-api.service"
```

- [ ] **Step 4: Verify status endpoint includes battery data**

```bash
ssh timelapse-pi "curl -s http://localhost:8000/api/status | python3 -m json.tool"
```

Expected: response includes `battery_voltage` (non-null float), `battery_soc_pct` (non-null float), and `runtime_estimate_hours` (calculated from real SoC).

- [ ] **Step 5: Commit all changes together**

```bash
git add -A
git commit -m "feat: battery voltage monitoring via ADS1115 + Power Brick Mini"
```
