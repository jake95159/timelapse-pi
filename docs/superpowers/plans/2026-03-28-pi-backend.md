# Pi Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FastAPI REST API, camera/capture services, WiFi management, and systemd boot flow for the Pi's BYPASS mode.

**Architecture:** Services layer (config, camera, batch, capture loop, WiFi) wrapped by FastAPI routers, deployed via updated provisioning script. Mode detection via GPIO27 determines AUTO vs BYPASS boot path. All batch operations are filesystem-based (directories = batches).

**Tech Stack:** Python 3.11, FastAPI, Uvicorn, picamera2, lgpio, Pillow, NetworkManager (nmcli), systemd, pytest + httpx for testing.

**Spec:** `docs/superpowers/specs/2026-03-28-sprint2-api-app-design.md`

---

## File Structure

```
pi/
├── api/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app factory + lifespan
│   ├── run.py                     # Uvicorn entry point (production)
│   ├── dependencies.py            # ServiceContainer + get_services
│   ├── models.py                  # Pydantic request models
│   └── routers/
│       ├── __init__.py
│       ├── status.py              # GET /api/status
│       ├── settings.py            # GET/PATCH /api/settings
│       ├── capture.py             # POST /api/capture, loop start/stop
│       ├── preview.py             # GET /api/preview
│       ├── batches.py             # Batch CRUD + image serving
│       └── network.py             # WiFi status/scan/connect/AP
├── services/
│   ├── __init__.py
│   ├── config.py                  # Read/write/merge tl_config.json
│   ├── batch_manager.py           # Batch CRUD, split/merge, thumbnails
│   ├── camera.py                  # picamera2 wrapper with threading lock
│   ├── capture_loop.py            # BYPASS software-timed capture loop
│   ├── mode.py                    # GPIO27 mode detection
│   └── wifi_manager.py            # nmcli wrapper for AP/client management
├── systemd/
│   ├── timelapse-mode.sh          # Boot script: read GPIO27, start correct target
│   ├── timelapse-mode.service     # Oneshot: runs mode detection
│   ├── timelapse-auto.service     # AUTO: capture_auto.py (Sprint 1)
│   ├── timelapse-api.service      # BYPASS: FastAPI server
│   ├── timelapse-wifi.service     # BYPASS: WiFi manager
│   └── timelapse-bypass.target    # BYPASS: groups API + WiFi
├── capture_auto.py                # Sprint 1 AUTO capture (minimal update: batch dir)
├── requirements.txt               # FastAPI, uvicorn, Pillow
└── tests/
    ├── __init__.py
    ├── conftest.py                # Shared fixtures
    ├── test_config.py
    ├── test_batch_manager.py
    ├── test_capture_loop.py
    └── test_api/
        ├── __init__.py
        ├── conftest.py            # TestClient + mock services
        ├── test_status.py
        ├── test_settings.py
        ├── test_capture.py
        ├── test_batches.py
        └── test_network.py
provision.sh                       # Updated provisioning (stays at repo root)
```

---

## Task 1: Repository Restructure + Scaffolding

**Files:**
- Create: `pi/`, `pi/api/`, `pi/api/routers/`, `pi/services/`, `pi/systemd/`, `pi/tests/`, `pi/tests/test_api/`
- Move: `capture_auto.py` → `pi/capture_auto.py`
- Create: `pi/requirements.txt`
- Create: all `__init__.py` files

- [ ] **Step 1: Create directory structure and move capture script**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi
mkdir -p pi/api/routers pi/services pi/systemd pi/tests/test_api
mv capture_auto.py pi/capture_auto.py
```

- [ ] **Step 2: Create `__init__.py` files**

Create empty `__init__.py` in each package directory:

```bash
touch pi/__init__.py pi/api/__init__.py pi/api/routers/__init__.py \
      pi/services/__init__.py pi/tests/__init__.py pi/tests/test_api/__init__.py
```

- [ ] **Step 3: Create `pi/requirements.txt`**

```
fastapi==0.115.*
uvicorn==0.34.*
python-multipart==0.0.*
Pillow>=10.0
httpx>=0.27
pytest>=8.0
```

Note: `picamera2`, `lgpio`, and `Pillow` are system packages on the Pi (accessed via `--system-site-packages` venv). `httpx` and `pytest` are dev-only dependencies for testing on WSL.

- [ ] **Step 4: Set up development venv on WSL**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/pi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 5: Update `.gitignore`**

Add to `.gitignore`:

```
# Python venv
pi/venv/
```

- [ ] **Step 6: Verify structure and commit**

```bash
find pi/ -type f | sort
git add -A
git commit -m "chore: restructure repo for Sprint 2 monorepo (pi/ directory)"
```

---

## Task 2: Config Service + Tests

**Files:**
- Create: `pi/services/config.py`
- Create: `pi/tests/conftest.py`
- Create: `pi/tests/test_config.py`

- [ ] **Step 1: Write tests for config service**

Create `pi/tests/conftest.py`:

```python
import pytest
import sys
import os

# Add pi/ to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
```

Create `pi/tests/test_config.py`:

```python
import json
import pytest
from services.config import ConfigService, DEFAULT_CONFIG


class TestConfigLoad:
    def test_returns_defaults_when_no_file(self, tmp_path):
        svc = ConfigService(str(tmp_path / "config.json"))
        config = svc.load()
        assert config["software_interval_sec"] == 60
        assert config["camera"]["iso"] == 100
        assert config["ap"]["ssid"] == "TimelapsePi"

    def test_reads_existing_file(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text('{"software_interval_sec": 30}')
        svc = ConfigService(str(path))
        config = svc.load()
        assert config["software_interval_sec"] == 30
        assert config["camera"]["iso"] == 100  # defaults filled in

    def test_ignores_unknown_keys(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text('{"unknown_key": "value", "software_interval_sec": 5}')
        svc = ConfigService(str(path))
        config = svc.load()
        assert config["unknown_key"] == "value"
        assert config["software_interval_sec"] == 5


class TestConfigSave:
    def test_writes_json_file(self, tmp_path):
        path = tmp_path / "config.json"
        svc = ConfigService(str(path))
        svc.save({"test": True})
        assert json.loads(path.read_text()) == {"test": True}

    def test_creates_parent_dirs(self, tmp_path):
        path = tmp_path / "subdir" / "config.json"
        svc = ConfigService(str(path))
        svc.save({"test": True})
        assert path.exists()


class TestConfigMerge:
    def test_merges_top_level_field(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text(json.dumps(DEFAULT_CONFIG))
        svc = ConfigService(str(path))
        result = svc.merge({"software_interval_sec": 10})
        assert result["software_interval_sec"] == 10
        assert result["camera"]["iso"] == 100

    def test_merges_nested_field(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text(json.dumps(DEFAULT_CONFIG))
        svc = ConfigService(str(path))
        result = svc.merge({"camera": {"iso": 400}})
        assert result["camera"]["iso"] == 400
        assert result["camera"]["awb_mode"] == "auto"

    def test_merge_persists_to_disk(self, tmp_path):
        path = tmp_path / "config.json"
        path.write_text(json.dumps(DEFAULT_CONFIG))
        svc = ConfigService(str(path))
        svc.merge({"software_interval_sec": 10})
        reloaded = json.loads(path.read_text())
        assert reloaded["software_interval_sec"] == 10
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/pi
source venv/bin/activate
pytest tests/test_config.py -v
```

Expected: `ModuleNotFoundError: No module named 'services.config'`

- [ ] **Step 3: Implement config service**

Create `pi/services/config.py`:

```python
import json
import os
import copy

DEFAULT_CONFIG = {
    "location": {"lat": 0.0, "lon": 0.0},
    "daylight_only": False,
    "window_start": "00:00",
    "window_end": "23:59",
    "hardware_interval_sec": 3600,
    "software_interval_sec": 60,
    "battery_mah": 5000,
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_config.py -v
```

Expected: All 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add pi/services/config.py pi/tests/conftest.py pi/tests/test_config.py
git commit -m "feat: add config service with read/write/merge and tests"
```

---

## Task 3: Batch Manager + Tests

**Files:**
- Create: `pi/services/batch_manager.py`
- Create: `pi/tests/test_batch_manager.py`

- [ ] **Step 1: Write tests for batch manager**

Create `pi/tests/test_batch_manager.py`:

```python
import json
import os
import pytest
from PIL import Image
from services.batch_manager import BatchManager


@pytest.fixture
def bm(tmp_path):
    images_dir = tmp_path / "images"
    images_dir.mkdir()
    return BatchManager(str(images_dir))


def _create_test_image(path, width=100, height=80):
    """Create a minimal JPEG for testing."""
    img = Image.new("RGB", (width, height), color="red")
    img.save(path, "JPEG")


class TestCreateBatch:
    def test_creates_directory_and_metadata(self, bm):
        batch = bm.create_batch("My Batch")
        assert batch["name"] == "My Batch"
        assert os.path.isdir(bm.get_batch_dir(batch["id"]))
        meta_path = os.path.join(bm.get_batch_dir(batch["id"]), "batch.json")
        assert os.path.exists(meta_path)

    def test_auto_generates_name_if_none(self, bm):
        batch = bm.create_batch()
        assert "Batch" in batch["name"]

    def test_sequential_ids(self, bm):
        b1 = bm.create_batch()
        b2 = bm.create_batch()
        assert "001" in b1["id"]
        assert "002" in b2["id"]


class TestListBatches:
    def test_empty_when_no_batches(self, bm):
        assert bm.list_batches() == []

    def test_lists_created_batches(self, bm):
        bm.create_batch("First")
        bm.create_batch("Second")
        batches = bm.list_batches()
        assert len(batches) == 2
        assert batches[0]["name"] == "First"

    def test_includes_image_count(self, bm):
        batch = bm.create_batch()
        img_path = os.path.join(bm.get_batch_dir(batch["id"]), "capture_00001.jpg")
        _create_test_image(img_path)
        batches = bm.list_batches()
        assert batches[0]["image_count"] == 1


class TestGetBatch:
    def test_returns_image_list(self, bm):
        batch = bm.create_batch()
        batch_dir = bm.get_batch_dir(batch["id"])
        _create_test_image(os.path.join(batch_dir, "capture_00001.jpg"))
        _create_test_image(os.path.join(batch_dir, "capture_00002.jpg"))
        detail = bm.get_batch(batch["id"])
        assert len(detail["images"]) == 2
        assert detail["images"][0]["id"] == "capture_00001"

    def test_excludes_thumbnails(self, bm):
        batch = bm.create_batch()
        batch_dir = bm.get_batch_dir(batch["id"])
        _create_test_image(os.path.join(batch_dir, "capture_00001.jpg"))
        _create_test_image(os.path.join(batch_dir, "capture_00001_thumb.jpg"))
        detail = bm.get_batch(batch["id"])
        assert len(detail["images"]) == 1


class TestRenameBatch:
    def test_updates_metadata(self, bm):
        batch = bm.create_batch("Old Name")
        result = bm.rename_batch(batch["id"], "New Name")
        assert result["name"] == "New Name"
        reloaded = bm.get_batch(batch["id"])
        assert reloaded["name"] == "New Name"


class TestSplitBatch:
    def test_splits_images_into_two_batches(self, bm):
        batch = bm.create_batch()
        batch_dir = bm.get_batch_dir(batch["id"])
        for i in range(1, 5):
            _create_test_image(os.path.join(batch_dir, f"capture_{i:05d}.jpg"))
        a, b = bm.split_batch(batch["id"], "capture_00002")
        assert len(a["images"]) == 2
        assert len(b["images"]) == 2

    def test_moves_thumbnails_too(self, bm):
        batch = bm.create_batch()
        batch_dir = bm.get_batch_dir(batch["id"])
        for i in range(1, 3):
            _create_test_image(os.path.join(batch_dir, f"capture_{i:05d}.jpg"))
            _create_test_image(os.path.join(batch_dir, f"capture_{i:05d}_thumb.jpg"))
        _, b = bm.split_batch(batch["id"], "capture_00001")
        b_dir = bm.get_batch_dir(b["id"])
        assert os.path.exists(os.path.join(b_dir, "capture_00002_thumb.jpg"))

    def test_raises_if_nothing_after_split(self, bm):
        batch = bm.create_batch()
        batch_dir = bm.get_batch_dir(batch["id"])
        _create_test_image(os.path.join(batch_dir, "capture_00001.jpg"))
        with pytest.raises(ValueError):
            bm.split_batch(batch["id"], "capture_00001")


class TestMergeBatches:
    def test_consolidates_files(self, bm):
        b1 = bm.create_batch("First")
        b2 = bm.create_batch("Second")
        _create_test_image(os.path.join(bm.get_batch_dir(b1["id"]), "capture_00001.jpg"))
        _create_test_image(os.path.join(bm.get_batch_dir(b2["id"]), "capture_00002.jpg"))
        merged = bm.merge_batches(b1["id"], b2["id"])
        assert len(merged["images"]) == 2
        assert not os.path.exists(bm.get_batch_dir(b2["id"]))


class TestDeleteBatch:
    def test_removes_directory(self, bm):
        batch = bm.create_batch()
        batch_dir = bm.get_batch_dir(batch["id"])
        _create_test_image(os.path.join(batch_dir, "capture_00001.jpg"))
        count = bm.delete_batch(batch["id"])
        assert count == 1
        assert not os.path.exists(batch_dir)


class TestThumbnails:
    def test_generates_thumbnail(self, bm):
        batch = bm.create_batch()
        img_path = os.path.join(bm.get_batch_dir(batch["id"]), "capture_00001.jpg")
        _create_test_image(img_path, width=4056, height=3040)
        thumb_path = bm.generate_thumbnail(img_path)
        assert os.path.exists(thumb_path)
        thumb = Image.open(thumb_path)
        assert thumb.width == 300
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_batch_manager.py -v
```

Expected: `ModuleNotFoundError: No module named 'services.batch_manager'`

- [ ] **Step 3: Implement batch manager**

Create `pi/services/batch_manager.py`:

```python
import json
import os
import shutil
from datetime import datetime
from typing import Optional

from PIL import Image

BATCH_META_FILE = "batch.json"
THUMB_SUFFIX = "_thumb"
THUMB_MAX_WIDTH = 300


class BatchManager:
    def __init__(self, images_dir: str):
        self._images_dir = images_dir
        self._batch_seq_file = os.path.join(images_dir, ".batch_seq")
        os.makedirs(images_dir, exist_ok=True)

    def get_batch_dir(self, batch_id: str) -> str:
        return os.path.join(self._images_dir, batch_id)

    def create_batch(self, name: Optional[str] = None) -> dict:
        seq = self._next_batch_seq()
        date_str = datetime.now().strftime("%Y-%m-%d")
        batch_id = f"batch_{seq:03d}_{date_str}"
        batch_dir = os.path.join(self._images_dir, batch_id)
        os.makedirs(batch_dir)

        display_name = name or f"{date_str} Batch {seq}"
        meta = {
            "id": batch_id,
            "name": display_name,
            "created": datetime.now().isoformat(),
        }
        with open(os.path.join(batch_dir, BATCH_META_FILE), "w") as f:
            json.dump(meta, f, indent=2)
        return meta

    def list_batches(self) -> list:
        batches = []
        if not os.path.exists(self._images_dir):
            return batches
        for entry in sorted(os.listdir(self._images_dir)):
            batch_dir = os.path.join(self._images_dir, entry)
            if not os.path.isdir(batch_dir) or entry.startswith("."):
                continue
            meta_path = os.path.join(batch_dir, BATCH_META_FILE)
            if not os.path.exists(meta_path):
                continue
            with open(meta_path) as f:
                meta = json.load(f)
            images = self._list_images(batch_dir)
            meta["image_count"] = len(images)
            if images:
                meta["first_capture"] = images[0]
                meta["last_capture"] = images[-1]
            else:
                meta["first_capture"] = None
                meta["last_capture"] = None
            batches.append(meta)
        return batches

    def get_batch(self, batch_id: str) -> dict:
        batch_dir = os.path.join(self._images_dir, batch_id)
        with open(os.path.join(batch_dir, BATCH_META_FILE)) as f:
            meta = json.load(f)
        images = self._list_images(batch_dir)
        meta["images"] = []
        for img_name in images:
            img_path = os.path.join(batch_dir, img_name)
            img_id = os.path.splitext(img_name)[0]
            meta["images"].append(
                {
                    "id": img_id,
                    "filename": img_name,
                    "size_bytes": os.path.getsize(img_path),
                }
            )
        return meta

    def rename_batch(self, batch_id: str, new_name: str) -> dict:
        batch_dir = os.path.join(self._images_dir, batch_id)
        meta_path = os.path.join(batch_dir, BATCH_META_FILE)
        with open(meta_path) as f:
            meta = json.load(f)
        meta["name"] = new_name
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
        return meta

    def split_batch(self, batch_id: str, after_image_id: str) -> tuple:
        batch_dir = os.path.join(self._images_dir, batch_id)
        images = self._list_images(batch_dir)
        split_name = f"{after_image_id}.jpg"
        split_idx = images.index(split_name)

        images_b = images[split_idx + 1 :]
        if not images_b:
            raise ValueError("Cannot split: no images after split point")

        new_meta = self.create_batch()
        new_dir = os.path.join(self._images_dir, new_meta["id"])

        for img_name in images_b:
            shutil.move(
                os.path.join(batch_dir, img_name),
                os.path.join(new_dir, img_name),
            )
            thumb_name = self._thumb_name(img_name)
            thumb_src = os.path.join(batch_dir, thumb_name)
            if os.path.exists(thumb_src):
                shutil.move(thumb_src, os.path.join(new_dir, thumb_name))

        return self.get_batch(batch_id), self.get_batch(new_meta["id"])

    def merge_batches(self, batch_id_a: str, batch_id_b: str) -> dict:
        dir_a = os.path.join(self._images_dir, batch_id_a)
        dir_b = os.path.join(self._images_dir, batch_id_b)

        for entry in os.listdir(dir_b):
            if entry == BATCH_META_FILE:
                continue
            shutil.move(os.path.join(dir_b, entry), os.path.join(dir_a, entry))
        shutil.rmtree(dir_b)
        return self.get_batch(batch_id_a)

    def delete_batch(self, batch_id: str) -> int:
        batch_dir = os.path.join(self._images_dir, batch_id)
        count = len(self._list_images(batch_dir))
        shutil.rmtree(batch_dir)
        return count

    def get_image_path(self, batch_id: str, image_id: str) -> str:
        return os.path.join(self._images_dir, batch_id, f"{image_id}.jpg")

    def get_thumb_path(self, batch_id: str, image_id: str) -> str:
        return os.path.join(self._images_dir, batch_id, f"{image_id}_thumb.jpg")

    def generate_thumbnail(self, image_path: str) -> str:
        base, ext = os.path.splitext(image_path)
        thumb_path = f"{base}_thumb{ext}"
        img = Image.open(image_path)
        ratio = THUMB_MAX_WIDTH / img.width
        new_size = (THUMB_MAX_WIDTH, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
        img.save(thumb_path, "JPEG", quality=80)
        return thumb_path

    def _list_images(self, batch_dir: str) -> list:
        return sorted(
            f
            for f in os.listdir(batch_dir)
            if f.endswith(".jpg") and THUMB_SUFFIX not in f
        )

    def _next_batch_seq(self) -> int:
        seq = 0
        try:
            with open(self._batch_seq_file, "r") as f:
                seq = int(f.read().strip())
        except (FileNotFoundError, ValueError):
            pass
        seq += 1
        with open(self._batch_seq_file, "w") as f:
            f.write(str(seq))
        return seq

    @staticmethod
    def _thumb_name(image_name: str) -> str:
        base, ext = os.path.splitext(image_name)
        return f"{base}_thumb{ext}"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_batch_manager.py -v
```

Expected: All 14 tests pass.

- [ ] **Step 5: Commit**

```bash
git add pi/services/batch_manager.py pi/tests/test_batch_manager.py
git commit -m "feat: add batch manager with filesystem-based CRUD, split/merge, thumbnails"
```

---

## Task 4: Camera Service

**Files:**
- Create: `pi/services/camera.py`

This service wraps picamera2 and is only testable on the Pi (hardware-dependent). No WSL tests.

- [ ] **Step 1: Implement camera service**

Create `pi/services/camera.py`:

```python
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
        if controls:
            with self._lock:
                self._camera.set_controls(controls)
```

- [ ] **Step 2: Commit**

```bash
git add pi/services/camera.py
git commit -m "feat: add camera service with preview/still capture and settings control"
```

---

## Task 5: Capture Loop + Tests

**Files:**
- Create: `pi/services/capture_loop.py`
- Create: `pi/tests/test_capture_loop.py`

- [ ] **Step 1: Write tests for capture loop**

Create `pi/tests/test_capture_loop.py`:

```python
import os
import time
import pytest
from unittest.mock import MagicMock
from PIL import Image
from services.capture_loop import CaptureLoop
from services.batch_manager import BatchManager


@pytest.fixture
def setup(tmp_path):
    images_dir = tmp_path / "images"
    images_dir.mkdir()
    seq_file = str(tmp_path / "sequence.txt")
    bm = BatchManager(str(images_dir))

    mock_camera = MagicMock()

    def fake_capture(filepath):
        img = Image.new("RGB", (100, 80), color="blue")
        img.save(filepath, "JPEG")

    mock_camera.capture_still.side_effect = fake_capture

    loop = CaptureLoop(mock_camera, bm, seq_file)
    return loop, bm, mock_camera


class TestCaptureLoop:
    def test_not_running_initially(self, setup):
        loop, _, _ = setup
        assert not loop.is_running
        assert loop.capture_count == 0

    def test_start_creates_batch_and_runs(self, setup):
        loop, bm, _ = setup
        batch_id = loop.start(interval_sec=60)
        assert loop.is_running
        assert batch_id is not None
        assert os.path.isdir(bm.get_batch_dir(batch_id))
        loop.stop()

    def test_stop_returns_count(self, setup):
        loop, _, _ = setup
        loop.start(interval_sec=0.1)
        time.sleep(0.5)
        count = loop.stop()
        assert count >= 2
        assert not loop.is_running

    def test_capture_single(self, setup):
        loop, bm, _ = setup
        result = loop.capture_single()
        assert "image_id" in result
        assert "batch_id" in result
        assert os.path.exists(bm.get_image_path(result["batch_id"], result["image_id"]))

    def test_sequence_increments(self, setup):
        loop, _, _ = setup
        r1 = loop.capture_single()
        r2 = loop.capture_single()
        assert r2["sequence"] == r1["sequence"] + 1

    def test_start_while_running_raises(self, setup):
        loop, _, _ = setup
        loop.start(interval_sec=60)
        with pytest.raises(RuntimeError):
            loop.start(interval_sec=60)
        loop.stop()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_capture_loop.py -v
```

Expected: `ModuleNotFoundError: No module named 'services.capture_loop'`

- [ ] **Step 3: Implement capture loop**

Create `pi/services/capture_loop.py`:

```python
import os
import threading
import time


class CaptureLoop:
    """Software-timed capture loop for BYPASS mode.

    Creates a new batch when started, captures at the configured
    interval, stops on request. Uses a global sequence counter
    shared with AUTO mode captures.
    """

    def __init__(self, camera, batch_manager, sequence_file: str):
        self._camera = camera
        self._batch_manager = batch_manager
        self._sequence_file = sequence_file
        self._thread = None
        self._running = False
        self._capture_count = 0
        self._current_batch_id = None
        self._interval_sec = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def capture_count(self) -> int:
        return self._capture_count

    @property
    def current_batch_id(self) -> str:
        return self._current_batch_id

    @property
    def interval_sec(self) -> float:
        return self._interval_sec

    def start(self, interval_sec: float) -> str:
        if self._running:
            raise RuntimeError("Capture loop already running")
        batch = self._batch_manager.create_batch()
        self._current_batch_id = batch["id"]
        self._capture_count = 0
        self._interval_sec = interval_sec
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return self._current_batch_id

    def stop(self) -> int:
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
            self._thread = None
        count = self._capture_count
        return count

    def capture_single(self) -> dict:
        if not self._current_batch_id:
            batch = self._batch_manager.create_batch()
            self._current_batch_id = batch["id"]
        return self._capture_one()

    def _loop(self):
        while self._running:
            self._capture_one()
            elapsed = 0.0
            while elapsed < self._interval_sec and self._running:
                step = min(0.5, self._interval_sec - elapsed)
                time.sleep(step)
                elapsed += step

    def _capture_one(self) -> dict:
        seq = self._next_sequence()
        batch_dir = self._batch_manager.get_batch_dir(self._current_batch_id)
        image_id = f"capture_{seq:05d}"
        filepath = os.path.join(batch_dir, f"{image_id}.jpg")

        self._camera.capture_still(filepath)
        self._batch_manager.generate_thumbnail(filepath)
        self._capture_count += 1

        return {
            "image_id": image_id,
            "batch_id": self._current_batch_id,
            "sequence": seq,
        }

    def _next_sequence(self) -> int:
        seq = 0
        try:
            with open(self._sequence_file, "r") as f:
                seq = int(f.read().strip())
        except (FileNotFoundError, ValueError):
            pass
        seq += 1
        with open(self._sequence_file, "w") as f:
            f.write(str(seq))
            f.flush()
            os.fsync(f.fileno())
        return seq
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_capture_loop.py -v
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add pi/services/capture_loop.py pi/tests/test_capture_loop.py
git commit -m "feat: add capture loop service with start/stop and single-shot capture"
```

---

## Task 6: FastAPI App Shell + Dependencies + Models

**Files:**
- Create: `pi/api/main.py`
- Create: `pi/api/run.py`
- Create: `pi/api/dependencies.py`
- Create: `pi/api/models.py`
- Create: `pi/tests/test_api/conftest.py`

- [ ] **Step 1: Create Pydantic request models**

Create `pi/api/models.py`:

```python
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
```

- [ ] **Step 2: Create service container and dependency injection**

Create `pi/api/dependencies.py`:

```python
from fastapi import Request

from services.batch_manager import BatchManager
from services.camera import CameraService
from services.capture_loop import CaptureLoop
from services.config import ConfigService
from services.wifi_manager import WifiManager


class ServiceContainer:
    def __init__(
        self,
        config_path: str,
        images_dir: str,
        sequence_file: str,
        camera=None,
        wifi=None,
    ):
        self.config = ConfigService(config_path)
        self.batch_manager = BatchManager(images_dir)
        self.camera = camera if camera is not None else CameraService()
        self.capture_loop = CaptureLoop(
            self.camera, self.batch_manager, sequence_file
        )
        self.wifi = wifi if wifi is not None else WifiManager()


def get_services(request: Request) -> ServiceContainer:
    return request.app.state.services
```

- [ ] **Step 3: Create FastAPI app factory**

Create `pi/api/main.py`:

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
) -> FastAPI:
    from api.routers import batches, capture, network, preview, settings, status

    app = FastAPI(title="TimelapsePi API", lifespan=lifespan)

    app.state.services = ServiceContainer(
        config_path=config_path,
        images_dir=images_dir,
        sequence_file=sequence_file,
        camera=camera,
        wifi=wifi,
    )

    app.include_router(status.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    app.include_router(capture.router, prefix="/api")
    app.include_router(preview.router, prefix="/api")
    app.include_router(batches.router, prefix="/api")
    app.include_router(network.router, prefix="/api")

    return app
```

Create `pi/api/run.py`:

```python
import os

from api.main import create_app

app = create_app(
    config_path=os.environ.get("TL_CONFIG", "/home/pi/timelapse/tl_config.json"),
    images_dir=os.environ.get("TL_IMAGES", "/home/pi/timelapse/images"),
    sequence_file=os.environ.get(
        "TL_SEQUENCE", "/home/pi/timelapse/logs/sequence.txt"
    ),
)
```

- [ ] **Step 4: Create stub routers (so the app can import)**

Create stub routers so `create_app` can import them. Each will be a minimal file with an empty router:

`pi/api/routers/status.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

`pi/api/routers/settings.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

`pi/api/routers/capture.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

`pi/api/routers/preview.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

`pi/api/routers/batches.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

`pi/api/routers/network.py`:
```python
from fastapi import APIRouter
router = APIRouter()
```

- [ ] **Step 5: Create stub WiFi manager (so dependencies can import)**

Create `pi/services/wifi_manager.py`:

```python
class WifiManager:
    """Stub — implemented in Task 10."""
    pass
```

- [ ] **Step 6: Create test conftest with TestClient**

Create `pi/tests/test_api/conftest.py`:

```python
import pytest
from unittest.mock import MagicMock
from PIL import Image
from io import BytesIO

from api.main import create_app

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
def app(tmp_path, mock_camera, mock_wifi):
    images_dir = tmp_path / "images"
    images_dir.mkdir()
    return create_app(
        config_path=str(tmp_path / "config.json"),
        images_dir=str(images_dir),
        sequence_file=str(tmp_path / "sequence.txt"),
        camera=mock_camera,
        wifi=mock_wifi,
    )


@pytest.fixture
def client(app):
    from fastapi.testclient import TestClient
    return TestClient(app)
```

- [ ] **Step 7: Verify app starts with a basic test**

Create a quick smoke test in `pi/tests/test_api/test_status.py` (will be expanded in Task 7):

```python
def test_app_starts(client):
    # Stub router has no routes, but the app should start without errors
    response = client.get("/api/nonexistent")
    assert response.status_code == 404
```

Run:
```bash
pytest tests/test_api/test_status.py -v
```

Expected: 1 test passes.

- [ ] **Step 8: Commit**

```bash
git add pi/api/ pi/services/wifi_manager.py pi/tests/test_api/
git commit -m "feat: add FastAPI app shell with dependency injection and test infrastructure"
```

---

## Task 7: Status + Settings Routers + Tests

**Files:**
- Modify: `pi/api/routers/status.py`
- Modify: `pi/api/routers/settings.py`
- Modify: `pi/tests/test_api/test_status.py`
- Create: `pi/tests/test_api/test_settings.py`

- [ ] **Step 1: Write status endpoint tests**

Replace `pi/tests/test_api/test_status.py`:

```python
def test_status_returns_mode(client):
    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] in ("auto", "bypass")


def test_status_includes_capture_state(client):
    resp = client.get("/api/status")
    data = resp.json()
    assert data["capture_state"] == "idle"
    assert data["capture_count"] == 0


def test_status_includes_storage(client):
    resp = client.get("/api/status")
    data = resp.json()
    assert "storage_used_pct" in data
    assert "storage_free_mb" in data


def test_status_includes_config_values(client):
    resp = client.get("/api/status")
    data = resp.json()
    assert data["software_interval_sec"] == 60
    assert data["hardware_interval_sec"] == 3600
```

- [ ] **Step 2: Write settings endpoint tests**

Create `pi/tests/test_api/test_settings.py`:

```python
def test_get_settings_returns_config(client):
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["camera"]["iso"] == 100
    assert data["ap"]["ssid"] == "TimelapsePi"


def test_patch_settings_updates_field(client):
    resp = client.patch("/api/settings", json={"software_interval_sec": 10})
    assert resp.status_code == 200
    data = resp.json()
    assert data["software_interval_sec"] == 10


def test_patch_settings_preserves_other_fields(client):
    client.patch("/api/settings", json={"software_interval_sec": 10})
    resp = client.get("/api/settings")
    data = resp.json()
    assert data["camera"]["iso"] == 100


def test_patch_settings_updates_nested(client):
    resp = client.patch("/api/settings", json={"camera": {"iso": 400}})
    data = resp.json()
    assert data["camera"]["iso"] == 400
    assert data["camera"]["awb_mode"] == "auto"
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pytest tests/test_api/test_status.py tests/test_api/test_settings.py -v
```

Expected: Failures (stub routers have no endpoints).

- [ ] **Step 4: Implement status router**

Create `pi/services/mode.py` (needed by status):

```python
def detect_mode() -> str:
    """Read GPIO27 to determine AUTO or BYPASS mode.

    Returns 'auto' if GPIO27 is HIGH (SparkFun VDD = 5V),
    'bypass' if GPIO27 is LOW (SparkFun VDD floating).
    Falls back to 'bypass' if lgpio is unavailable (dev/testing).
    """
    try:
        import lgpio

        h = lgpio.gpiochip_open(0)
        lgpio.gpio_claim_input(h, 27, lgpio.SET_PULL_DOWN)
        value = lgpio.gpio_read(h, 27)
        lgpio.gpiochip_close(h)
        return "auto" if value == 1 else "bypass"
    except Exception:
        return "bypass"
```

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

    # Battery estimate
    battery_mah = config.get("battery_mah", 5000)
    if mode == "bypass":
        runtime_hours = round(battery_mah / 180, 1)
    else:
        interval = config.get("hardware_interval_sec", 3600)
        duty = 25 / max(interval, 1)
        avg_ma = 180 * duty + 0.1 * (1 - duty)
        runtime_hours = round(battery_mah / max(avg_ma, 0.01), 1)

    return {
        "mode": mode,
        "capture_state": "running" if services.capture_loop.is_running else "idle",
        "capture_count": services.capture_loop.capture_count,
        "last_capture": last_capture,
        "storage_used_pct": storage_used_pct,
        "storage_free_mb": storage_free_mb,
        "battery_mah": battery_mah,
        "runtime_estimate_hours": runtime_hours,
        "software_interval_sec": config.get("software_interval_sec"),
        "hardware_interval_sec": config.get("hardware_interval_sec"),
        "uptime_sec": round(time.time() - _start_time),
    }
```

- [ ] **Step 5: Implement settings router**

Replace `pi/api/routers/settings.py`:

```python
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
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/test_api/test_status.py tests/test_api/test_settings.py -v
```

Expected: All 8 tests pass.

- [ ] **Step 7: Commit**

```bash
git add pi/api/routers/status.py pi/api/routers/settings.py \
       pi/services/mode.py pi/tests/test_api/
git commit -m "feat: add status and settings API endpoints with tests"
```

---

## Task 8: Capture + Preview Routers + Tests

**Files:**
- Modify: `pi/api/routers/capture.py`
- Modify: `pi/api/routers/preview.py`
- Create: `pi/tests/test_api/test_capture.py`

- [ ] **Step 1: Write capture and preview tests**

Create `pi/tests/test_api/test_capture.py`:

```python
def test_capture_single_shot(client):
    resp = client.post("/api/capture")
    assert resp.status_code == 200
    data = resp.json()
    assert "image_id" in data
    assert "batch_id" in data
    assert "sequence" in data


def test_capture_loop_start(client):
    resp = client.post("/api/capture/loop/start", json={"interval_sec": 60})
    assert resp.status_code == 200
    assert resp.json()["status"] == "started"
    # Clean up
    client.post("/api/capture/loop/stop")


def test_capture_loop_stop(client):
    client.post("/api/capture/loop/start", json={"interval_sec": 60})
    resp = client.post("/api/capture/loop/stop")
    assert resp.status_code == 200
    assert resp.json()["status"] == "stopped"
    assert "capture_count" in resp.json()


def test_capture_loop_start_while_running(client):
    client.post("/api/capture/loop/start", json={"interval_sec": 60})
    resp = client.post("/api/capture/loop/start", json={"interval_sec": 30})
    assert resp.status_code == 409
    client.post("/api/capture/loop/stop")


def test_preview_returns_jpeg(client):
    resp = client.get("/api/preview")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"
    assert len(resp.content) > 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_api/test_capture.py -v
```

Expected: Failures (stub routers).

- [ ] **Step 3: Implement capture router**

Replace `pi/api/routers/capture.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from api.dependencies import ServiceContainer, get_services
from api.models import CaptureLoopStart

router = APIRouter()


@router.post("/capture")
async def capture_single(services: ServiceContainer = Depends(get_services)):
    result = services.capture_loop.capture_single()
    return result


@router.post("/capture/loop/start")
async def start_capture_loop(
    body: CaptureLoopStart, services: ServiceContainer = Depends(get_services)
):
    try:
        batch_id = services.capture_loop.start(body.interval_sec)
    except RuntimeError:
        raise HTTPException(status_code=409, detail="Capture loop already running")
    return {"status": "started", "batch_id": batch_id}


@router.post("/capture/loop/stop")
async def stop_capture_loop(
    services: ServiceContainer = Depends(get_services),
):
    count = services.capture_loop.stop()
    return {"status": "stopped", "capture_count": count}
```

- [ ] **Step 4: Implement preview router**

Replace `pi/api/routers/preview.py`:

```python
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from api.dependencies import ServiceContainer, get_services

router = APIRouter()


@router.get("/preview")
async def get_preview(services: ServiceContainer = Depends(get_services)):
    jpeg_bytes = services.camera.capture_preview()
    return Response(content=jpeg_bytes, media_type="image/jpeg")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pytest tests/test_api/test_capture.py -v
```

Expected: All 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add pi/api/routers/capture.py pi/api/routers/preview.py \
       pi/tests/test_api/test_capture.py
git commit -m "feat: add capture and preview API endpoints with tests"
```

---

## Task 9: Batches + Images Router + Tests

**Files:**
- Modify: `pi/api/routers/batches.py`
- Create: `pi/tests/test_api/test_batches.py`

- [ ] **Step 1: Write batches endpoint tests**

Create `pi/tests/test_api/test_batches.py`:

```python
import os
from PIL import Image


def _seed_batch(client, app):
    """Create a batch with 2 images via the services directly."""
    services = app.state.services
    batch = services.batch_manager.create_batch("Test Batch")
    batch_dir = services.batch_manager.get_batch_dir(batch["id"])
    for i in range(1, 3):
        img = Image.new("RGB", (100, 80), "green")
        path = os.path.join(batch_dir, f"capture_{i:05d}.jpg")
        img.save(path, "JPEG")
    return batch["id"]


def test_list_batches_empty(client):
    resp = client.get("/api/batches")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_batches_returns_created(client, app):
    _seed_batch(client, app)
    resp = client.get("/api/batches")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Batch"
    assert data[0]["image_count"] == 2


def test_get_batch_detail(client, app):
    batch_id = _seed_batch(client, app)
    resp = client.get(f"/api/batches/{batch_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["images"]) == 2
    assert data["images"][0]["id"] == "capture_00001"


def test_rename_batch(client, app):
    batch_id = _seed_batch(client, app)
    resp = client.patch(f"/api/batches/{batch_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


def test_split_batch(client, app):
    batch_id = _seed_batch(client, app)
    resp = client.post(
        f"/api/batches/{batch_id}/split",
        json={"after_image_id": "capture_00001"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["batch_a"]["images"]) == 1
    assert len(data["batch_b"]["images"]) == 1


def test_merge_batches(client, app):
    services = app.state.services
    b1 = services.batch_manager.create_batch("A")
    b2 = services.batch_manager.create_batch("B")
    # Add one image to each
    for b, i in [(b1, 1), (b2, 2)]:
        img = Image.new("RGB", (10, 10), "red")
        img.save(
            os.path.join(
                services.batch_manager.get_batch_dir(b["id"]),
                f"capture_{i:05d}.jpg",
            ),
            "JPEG",
        )
    resp = client.post(
        "/api/batches/merge", json={"batch_ids": [b1["id"], b2["id"]]}
    )
    assert resp.status_code == 200
    assert resp.json()["merged_batch"]["image_count"] == 2


def test_delete_batch(client, app):
    batch_id = _seed_batch(client, app)
    resp = client.delete(f"/api/batches/{batch_id}")
    assert resp.status_code == 200
    assert resp.json()["deleted_count"] == 2


def test_get_image_full_res(client, app):
    batch_id = _seed_batch(client, app)
    resp = client.get(f"/api/batches/{batch_id}/images/capture_00001")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"


def test_get_image_thumbnail(client, app):
    batch_id = _seed_batch(client, app)
    resp = client.get(f"/api/batches/{batch_id}/images/capture_00001/thumb")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"


def test_get_nonexistent_image_404(client, app):
    batch_id = _seed_batch(client, app)
    resp = client.get(f"/api/batches/{batch_id}/images/nonexistent")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_api/test_batches.py -v
```

Expected: Failures (stub router).

- [ ] **Step 3: Implement batches router**

Replace `pi/api/routers/batches.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_api/test_batches.py -v
```

Expected: All 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add pi/api/routers/batches.py pi/tests/test_api/test_batches.py
git commit -m "feat: add batches API with CRUD, split/merge, and image serving"
```

---

## Task 10: WiFi Manager + Network Router + Tests

**Files:**
- Modify: `pi/services/wifi_manager.py`
- Modify: `pi/api/routers/network.py`
- Create: `pi/tests/test_api/test_network.py`

- [ ] **Step 1: Write network endpoint tests**

Create `pi/tests/test_api/test_network.py`:

```python
def test_network_status(client):
    resp = client.get("/api/network/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mode"] in ("ap", "client")
    assert "ssid" in data


def test_network_scan(client):
    resp = client.get("/api/network/scan")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_network_connect(client, mock_wifi):
    mock_wifi.connect.return_value = True
    resp = client.post(
        "/api/network/connect",
        json={"ssid": "HomeNetwork", "password": "secret"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "connecting"
    mock_wifi.connect.assert_called_once_with("HomeNetwork", "secret")


def test_network_start_ap(client, mock_wifi):
    mock_wifi.start_ap.return_value = True
    resp = client.post("/api/network/ap", json={})
    assert resp.status_code == 200
    assert resp.json()["status"] == "activating"


def test_network_saved(client, mock_wifi):
    mock_wifi.get_saved_networks.return_value = [
        {"ssid": "Home", "priority": 1}
    ]
    resp = client.get("/api/network/saved")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_network_delete_saved(client, mock_wifi):
    mock_wifi.remove_saved_network.return_value = True
    resp = client.delete("/api/network/saved/Home")
    assert resp.status_code == 200
```

- [ ] **Step 2: Implement WiFi manager**

Replace `pi/services/wifi_manager.py`:

```python
import subprocess


class WifiManager:
    """Wraps NetworkManager (nmcli) for WiFi AP/client management."""

    def get_status(self) -> dict:
        result = subprocess.run(
            ["nmcli", "-t", "-f", "GENERAL.TYPE,GENERAL.STATE,GENERAL.CONNECTION",
             "device", "show", "wlan0"],
            capture_output=True, text=True,
        )
        mode = "unknown"
        ssid = None
        ip = None

        # Check if AP is active
        ap_check = subprocess.run(
            ["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show", "--active"],
            capture_output=True, text=True,
        )
        for line in ap_check.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 2 and "wireless" in parts[1]:
                ssid = parts[0]

        # Check connection mode
        mode_check = subprocess.run(
            ["nmcli", "-t", "-f", "WIFI.MODE", "device", "show", "wlan0"],
            capture_output=True, text=True,
        )
        if "AP" in mode_check.stdout:
            mode = "ap"
        elif ssid:
            mode = "client"

        # Get IP
        ip_check = subprocess.run(
            ["nmcli", "-t", "-f", "IP4.ADDRESS", "device", "show", "wlan0"],
            capture_output=True, text=True,
        )
        for line in ip_check.stdout.strip().split("\n"):
            if "IP4.ADDRESS" in line:
                ip = line.split(":")[-1].split("/")[0]

        # Signal strength
        signal = None
        if mode == "client":
            sig_check = subprocess.run(
                ["nmcli", "-t", "-f", "IN-USE,SIGNAL", "dev", "wifi"],
                capture_output=True, text=True,
            )
            for line in sig_check.stdout.strip().split("\n"):
                if line.startswith("*:"):
                    signal = int(line.split(":")[1])

        return {"mode": mode, "ssid": ssid, "ip": ip, "signal_strength": signal}

    def scan(self) -> list:
        subprocess.run(
            ["nmcli", "dev", "wifi", "rescan"],
            capture_output=True, timeout=10,
        )
        result = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list"],
            capture_output=True, text=True,
        )
        networks = []
        seen = set()
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 3 and parts[0] and parts[0] not in seen:
                seen.add(parts[0])
                networks.append({
                    "ssid": parts[0],
                    "signal": int(parts[1]) if parts[1].isdigit() else 0,
                    "security": parts[2] or "Open",
                })
        return sorted(networks, key=lambda n: n["signal"], reverse=True)

    def connect(self, ssid: str, password: str) -> bool:
        result = subprocess.run(
            ["sudo", "nmcli", "dev", "wifi", "connect", ssid,
             "password", password],
            capture_output=True, text=True, timeout=30,
        )
        return result.returncode == 0

    def start_ap(self, ssid: str = "TimelapsePi",
                 password: str = "timelapse") -> bool:
        # Remove existing AP connection if any
        subprocess.run(
            ["sudo", "nmcli", "connection", "delete", "timelapse-ap"],
            capture_output=True,
        )
        # Create AP connection
        result = subprocess.run(
            ["sudo", "nmcli", "connection", "add",
             "type", "wifi",
             "con-name", "timelapse-ap",
             "ssid", ssid,
             "wifi.mode", "ap",
             "wifi-sec.key-mgmt", "wpa-psk",
             "wifi-sec.psk", password,
             "ipv4.method", "shared",
             "ipv4.addresses", "10.42.0.1/24"],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            return False
        result = subprocess.run(
            ["sudo", "nmcli", "connection", "up", "timelapse-ap"],
            capture_output=True, text=True, timeout=15,
        )
        return result.returncode == 0

    def get_saved_networks(self) -> list:
        result = subprocess.run(
            ["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"],
            capture_output=True, text=True,
        )
        networks = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            if len(parts) >= 2 and "wireless" in parts[1]:
                name = parts[0]
                if name != "timelapse-ap":
                    networks.append({"ssid": name, "priority": 0})
        return networks

    def remove_saved_network(self, ssid: str) -> bool:
        result = subprocess.run(
            ["sudo", "nmcli", "connection", "delete", ssid],
            capture_output=True, text=True,
        )
        return result.returncode == 0
```

- [ ] **Step 3: Implement network router**

Replace `pi/api/routers/network.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_api/test_network.py -v
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add pi/services/wifi_manager.py pi/api/routers/network.py \
       pi/tests/test_api/test_network.py
git commit -m "feat: add WiFi manager (nmcli) and network API endpoints"
```

---

## Task 11: Update capture_auto.py for Batch Directories

**Files:**
- Modify: `pi/capture_auto.py`

Minimal change: AUTO captures go to an `auto/` batch directory so they're visible in the gallery.

- [ ] **Step 1: Update capture_auto.py**

The changes are:
1. `IMAGE_DIR` points to a batch subdirectory under `images/`
2. On first boot, create the `auto` batch directory with a `batch.json` sidecar
3. Thumbnail generation is skipped (too slow for AUTO boot — generated on demand by the API)

Edit `pi/capture_auto.py` — change the `IMAGE_DIR` constant and add `ensure_auto_batch()`:

Replace the `# Configuration` block at the top:

```python
# Configuration
BASE_DIR = "/home/pi/timelapse"
IMAGES_DIR = os.path.join(BASE_DIR, "images")
AUTO_BATCH_DIR = os.path.join(IMAGES_DIR, "auto")
LOG_FILE = os.path.join(BASE_DIR, "logs", "boot_trace.log")
SEQ_FILE = os.path.join(BASE_DIR, "logs", "sequence.txt")
LOCK_FILE = "/tmp/timelapse-capture.lock"
GPIO_DONE = 17
```

Add after the `log()` function:

```python
def ensure_auto_batch():
    """Create the auto batch directory and metadata if they don't exist."""
    os.makedirs(AUTO_BATCH_DIR, exist_ok=True)
    meta_path = os.path.join(AUTO_BATCH_DIR, "batch.json")
    if not os.path.exists(meta_path):
        import json
        meta = {
            "id": "auto",
            "name": "Auto Captures",
            "created": datetime.now().isoformat(),
        }
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
```

Update `capture_image()` to use `AUTO_BATCH_DIR`:

```python
def capture_image(seq):
    """Initialize camera, warm up, capture full-res JPEG, close camera."""
    from picamera2 import Picamera2

    ensure_auto_batch()

    log(f"AUTO: Camera init (capture #{seq})")
    camera = Picamera2()

    config = camera.create_still_configuration(
        main={"size": (4056, 3040), "format": "RGB888"}
    )
    camera.configure(config)

    log("AUTO: Camera starting (2s warm-up)")
    camera.start()
    time.sleep(2)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(AUTO_BATCH_DIR, f"capture_{seq:05d}_{timestamp}.jpg")

    log(f"AUTO: Capturing → {filename}")
    camera.capture_file(filename)

    camera.stop()
    camera.close()

    return filename
```

- [ ] **Step 2: Verify the full script is correct**

Read the modified file end-to-end to verify consistency. The only changes from Sprint 1 are:
- `IMAGE_DIR` → split into `IMAGES_DIR` + `AUTO_BATCH_DIR`
- Added `ensure_auto_batch()` function
- `capture_image()` uses `AUTO_BATCH_DIR` and calls `ensure_auto_batch()`
- Everything else (lock, sequence, DONE signal) is unchanged

- [ ] **Step 3: Commit**

```bash
git add pi/capture_auto.py
git commit -m "feat: update AUTO capture to use batch directory structure"
```

---

## Task 12: Systemd Services + Boot Flow

**Files:**
- Create: `pi/systemd/timelapse-mode.sh`
- Create: `pi/systemd/timelapse-mode.service`
- Create: `pi/systemd/timelapse-auto.service`
- Create: `pi/systemd/timelapse-api.service`
- Create: `pi/systemd/timelapse-wifi.service`
- Create: `pi/systemd/timelapse-bypass.target`

- [ ] **Step 1: Create mode detection boot script**

Create `pi/systemd/timelapse-mode.sh`:

```bash
#!/bin/bash
# Read GPIO27 to determine AUTO vs BYPASS mode.
# Starts the appropriate systemd target.
#
# GPIO27 = mode detection pin:
#   HIGH (~2.5V via divider) = AUTO (SparkFun VDD powered)
#   LOW (0V via pull-down) = BYPASS (SparkFun VDD floating)

set -euo pipefail

GPIO=27
CHIP=/dev/gpiochip0

# Read GPIO27 value
VALUE=$(gpioget "$CHIP" "$GPIO" 2>/dev/null || echo "0")

if [ "$VALUE" = "1" ]; then
    echo "Mode: AUTO (GPIO27=HIGH)"
    systemctl start timelapse-auto.service
else
    echo "Mode: BYPASS (GPIO27=LOW)"
    systemctl start timelapse-bypass.target
fi
```

- [ ] **Step 2: Create systemd unit files**

Create `pi/systemd/timelapse-mode.service`:

```ini
[Unit]
Description=Timelapse Mode Detection (GPIO27)
DefaultDependencies=no
After=local-fs.target
Before=sysinit.target

[Service]
Type=oneshot
ExecStart=/bin/bash /home/pi/timelapse/systemd/timelapse-mode.sh
StandardOutput=journal
StandardError=journal
RemainAfterExit=yes

[Install]
WantedBy=sysinit.target
```

Create `pi/systemd/timelapse-auto.service`:

```ini
[Unit]
Description=Timelapse AUTO Capture
DefaultDependencies=no
After=local-fs.target

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/timelapse
ExecStart=/usr/bin/python3 /home/pi/timelapse/capture_auto.py
StandardOutput=append:/home/pi/timelapse/logs/capture.log
StandardError=append:/home/pi/timelapse/logs/capture.log
TimeoutStartSec=45
```

Create `pi/systemd/timelapse-bypass.target`:

```ini
[Unit]
Description=Timelapse BYPASS Mode
DefaultDependencies=no
After=local-fs.target network-online.target
Wants=timelapse-wifi.service timelapse-api.service
```

Create `pi/systemd/timelapse-wifi.service`:

```ini
[Unit]
Description=Timelapse WiFi Manager
PartOf=timelapse-bypass.target
After=NetworkManager.service

[Service]
Type=oneshot
ExecStart=/bin/bash /home/pi/timelapse/systemd/wifi-startup.sh
StandardOutput=journal
StandardError=journal
RemainAfterExit=yes
TimeoutStartSec=60
```

Create `pi/systemd/wifi-startup.sh`:

```bash
#!/bin/bash
# WiFi startup: try saved networks, fall back to AP mode.
set -euo pipefail

CONFIG="/home/pi/timelapse/tl_config.json"
TIMEOUT=15

echo "WiFi: Checking for saved networks..."

# Check if already connected
if nmcli -t -f STATE general | grep -q "connected"; then
    echo "WiFi: Already connected"
    exit 0
fi

# Try connecting to any saved WiFi network
if nmcli dev wifi connect --wait "$TIMEOUT" 2>/dev/null; then
    echo "WiFi: Connected to saved network"
    exit 0
fi

# No saved network found — start AP mode
echo "WiFi: No saved network, starting AP..."

# Read AP config from tl_config.json
SSID="TimelapsePi"
PASSWORD="timelapse"
if [ -f "$CONFIG" ]; then
    SSID_FROM_CONFIG=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('ap',{}).get('ssid','TimelapsePi'))" 2>/dev/null || echo "TimelapsePi")
    PASSWORD_FROM_CONFIG=$(python3 -c "import json; print(json.load(open('$CONFIG')).get('ap',{}).get('password','timelapse'))" 2>/dev/null || echo "timelapse")
    SSID="${SSID_FROM_CONFIG}"
    PASSWORD="${PASSWORD_FROM_CONFIG}"
fi

# Delete existing AP connection if any
nmcli connection delete timelapse-ap 2>/dev/null || true

# Create and activate AP
nmcli connection add type wifi con-name timelapse-ap ssid "$SSID" \
    wifi.mode ap wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASSWORD" \
    ipv4.method shared ipv4.addresses 10.42.0.1/24

nmcli connection up timelapse-ap

echo "WiFi: AP mode active (SSID: $SSID)"
```

Create `pi/systemd/timelapse-api.service`:

```ini
[Unit]
Description=Timelapse FastAPI Server
PartOf=timelapse-bypass.target
After=timelapse-wifi.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/timelapse
ExecStart=/home/pi/timelapse/venv/bin/uvicorn api.run:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=TL_CONFIG=/home/pi/timelapse/tl_config.json
Environment=TL_IMAGES=/home/pi/timelapse/images
Environment=TL_SEQUENCE=/home/pi/timelapse/logs/sequence.txt
```

- [ ] **Step 3: Create captive portal DNS config**

Create `pi/systemd/dnsmasq-captive.conf`:

```
# Redirect all DNS queries to the AP gateway.
# This creates captive-portal behavior so the phone
# stays on the Pi's WiFi instead of falling back to cellular.
address=/#/10.42.0.1
```

This file will be deployed to `/etc/NetworkManager/dnsmasq-shared.d/captive.conf` by the provisioning script.

- [ ] **Step 4: Commit**

```bash
git add pi/systemd/
git commit -m "feat: add systemd boot flow with GPIO27 mode detection and WiFi manager"
```

---

## Task 13: Provisioning Script Update

**Files:**
- Modify: `provision.sh` (repo root)

- [ ] **Step 1: Rewrite provision.sh for Sprint 2**

Replace `provision.sh`:

```bash
#!/bin/bash
# ============================================================
# Timelapse Pi - Sprint 2 Provisioning Script
# ============================================================
# Run from the workstation (WSL). SSHs into the Pi and sets up
# the full Sprint 2 stack: FastAPI, WiFi manager, systemd services.
#
# Usage: bash provision.sh
# ============================================================

set -euo pipefail

PI_HOST="timelapse-pi"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_DIR="$SCRIPT_DIR/pi"

echo "═══════════════════════════════════════════════════"
echo "  Timelapse Pi — Sprint 2 Provisioning"
echo "═══════════════════════════════════════════════════"

# ----------------------------------------------------------
# 1. Install system packages
# ----------------------------------------------------------
echo ""
echo "▸ [1/8] Installing system packages..."
ssh "$PI_HOST" "sudo apt-get update -qq && sudo apt-get install -y -qq \
    git ffmpeg \
    python3-pip python3-venv python3-picamera2 python3-lgpio python3-pil \
    libcamera-apps \
    network-manager avahi-daemon gpiod \
    2>&1 | tail -5"

# Ensure NetworkManager is active, disable dhcpcd
ssh "$PI_HOST" "
    sudo systemctl disable --now dhcpcd 2>/dev/null || true
    sudo systemctl enable --now NetworkManager
    sudo systemctl enable --now avahi-daemon
"
echo "  ✓ Packages installed, NetworkManager active"

# ----------------------------------------------------------
# 2. Create directory structure
# ----------------------------------------------------------
echo ""
echo "▸ [2/8] Creating directory structure..."
ssh "$PI_HOST" "mkdir -p ~/timelapse/{images/auto,videos,logs,systemd}"
echo "  ✓ Directory structure created"

# ----------------------------------------------------------
# 3. Deploy application code
# ----------------------------------------------------------
echo ""
echo "▸ [3/8] Deploying application code..."
rsync -az --delete \
    --exclude='venv/' --exclude='tests/' --exclude='__pycache__/' \
    "$PI_DIR/" "$PI_HOST:~/timelapse/"
echo "  ✓ Code deployed"

# ----------------------------------------------------------
# 4. Set up Python venv
# ----------------------------------------------------------
echo ""
echo "▸ [4/8] Setting up Python venv..."
ssh "$PI_HOST" "
    cd ~/timelapse
    python3 -m venv --system-site-packages venv 2>/dev/null || true
    venv/bin/pip install --quiet fastapi uvicorn python-multipart
"
echo "  ✓ Python venv ready"

# ----------------------------------------------------------
# 5. Deploy systemd services
# ----------------------------------------------------------
echo ""
echo "▸ [5/8] Installing systemd services..."
ssh "$PI_HOST" "
    # Remove old Sprint 1 services
    sudo systemctl disable --now timelapse-auto.service 2>/dev/null || true

    # Remove old rc.local and cron entries
    sudo rm -f /etc/rc.local
    (crontab -l 2>/dev/null | grep -v capture_auto) | crontab - 2>/dev/null || true

    # Install new services
    sudo cp ~/timelapse/systemd/timelapse-mode.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-auto.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-api.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-wifi.service /etc/systemd/system/
    sudo cp ~/timelapse/systemd/timelapse-bypass.target /etc/systemd/system/

    # Make scripts executable
    chmod +x ~/timelapse/systemd/timelapse-mode.sh
    chmod +x ~/timelapse/systemd/wifi-startup.sh

    # Enable mode detection service (it starts everything else)
    sudo systemctl daemon-reload
    sudo systemctl enable timelapse-mode.service
"
echo "  ✓ Systemd services installed"

# ----------------------------------------------------------
# 6. Configure captive portal DNS
# ----------------------------------------------------------
echo ""
echo "▸ [6/8] Configuring captive portal DNS..."
ssh "$PI_HOST" "
    sudo mkdir -p /etc/NetworkManager/dnsmasq-shared.d
    sudo cp ~/timelapse/systemd/dnsmasq-captive.conf \
        /etc/NetworkManager/dnsmasq-shared.d/captive.conf
"
echo "  ✓ Captive portal DNS configured"

# ----------------------------------------------------------
# 7. Boot config (GPIO pull-downs)
# ----------------------------------------------------------
echo ""
echo "▸ [7/8] Applying boot config..."
ssh "$PI_HOST" "
    CONFIG=/boot/firmware/config.txt

    # GPIO17 pull-down (DONE signal) — Sprint 1
    grep -q 'gpio=17=pd' \$CONFIG || echo 'gpio=17=pd' | sudo tee -a \$CONFIG > /dev/null

    # GPIO27 pull-down (mode detection) — Sprint 2
    grep -q 'gpio=27=pd' \$CONFIG || echo 'gpio=27=pd' | sudo tee -a \$CONFIG > /dev/null

    # Bluetooth off, HDMI off, splash off — Sprint 1
    grep -q 'dtoverlay=disable-bt' \$CONFIG || echo 'dtoverlay=disable-bt' | sudo tee -a \$CONFIG > /dev/null
    grep -q 'hdmi_blanking=2' \$CONFIG || echo 'hdmi_blanking=2' | sudo tee -a \$CONFIG > /dev/null
    grep -q 'disable_splash=1' \$CONFIG || echo 'disable_splash=1' | sudo tee -a \$CONFIG > /dev/null

    # Set hostname for mDNS
    sudo hostnamectl set-hostname timelapse-pi
"
echo "  ✓ Boot config applied (GPIO17 pd, GPIO27 pd, hostname)"

# ----------------------------------------------------------
# 8. Verify installation
# ----------------------------------------------------------
echo ""
echo "▸ [8/8] Verifying installation..."
ssh "$PI_HOST" "
    echo '── Directory structure ──'
    ls ~/timelapse/
    echo ''
    echo '── Venv packages ──'
    ~/timelapse/venv/bin/pip list 2>/dev/null | grep -E 'fastapi|uvicorn|Pillow'
    echo ''
    echo '── Systemd services ──'
    systemctl is-enabled timelapse-mode.service 2>/dev/null || echo 'not enabled'
    echo ''
    echo '── Camera ──'
    libcamera-hello --list-cameras 2>&1 | head -3
    echo ''
    echo '── NetworkManager ──'
    nmcli general status
    echo ''
    echo '── Hostname ──'
    hostname
"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Sprint 2 provisioning complete!"
echo ""
echo "  Next steps:"
echo "  1. Wire GPIO27 mode detection (see design spec)"
echo "  2. Reboot: ssh timelapse-pi 'sudo reboot'"
echo "  3. Set BYPASS mode (DPDT switch)"
echo "  4. Test API: curl http://timelapse-pi.local:8000/api/status"
echo "═══════════════════════════════════════════════════"
```

- [ ] **Step 2: Commit**

```bash
git add provision.sh
git commit -m "feat: update provisioning for Sprint 2 (FastAPI, NetworkManager, systemd)"
```

---

## Task 14: Deploy + End-to-End Smoke Test

**Files:** None (testing only)

**Prerequisites:** GPIO27 hardware mod must be wired. DPDT switch set to BYPASS.

- [ ] **Step 1: Run all unit tests locally**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/pi
source venv/bin/activate
pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 2: Deploy to Pi**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi
bash provision.sh
```

- [ ] **Step 3: Reboot Pi in BYPASS mode**

Ensure DPDT switch is in BYPASS position, then:

```bash
ssh timelapse-pi "sudo reboot"
```

Wait ~30 seconds for boot.

- [ ] **Step 4: Verify API is running**

```bash
curl -s http://timelapse-pi.local:8000/api/status | python3 -m json.tool
```

Expected: JSON with `"mode": "bypass"`, `"capture_state": "idle"`.

- [ ] **Step 5: Test core endpoints**

```bash
# Settings
curl -s http://timelapse-pi.local:8000/api/settings | python3 -m json.tool

# Update a setting
curl -s -X PATCH http://timelapse-pi.local:8000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"software_interval_sec": 30}' | python3 -m json.tool

# Single capture
curl -s -X POST http://timelapse-pi.local:8000/api/capture | python3 -m json.tool

# List batches
curl -s http://timelapse-pi.local:8000/api/batches | python3 -m json.tool

# Preview (save JPEG)
curl -s http://timelapse-pi.local:8000/api/preview -o /tmp/preview.jpg
ls -la /tmp/preview.jpg

# Network status
curl -s http://timelapse-pi.local:8000/api/network/status | python3 -m json.tool

# Start capture loop
curl -s -X POST http://timelapse-pi.local:8000/api/capture/loop/start \
  -H "Content-Type: application/json" \
  -d '{"interval_sec": 5}' | python3 -m json.tool

# Wait, then stop
sleep 15
curl -s -X POST http://timelapse-pi.local:8000/api/capture/loop/stop | python3 -m json.tool

# Check batches again (should have new batch with captures)
curl -s http://timelapse-pi.local:8000/api/batches | python3 -m json.tool
```

- [ ] **Step 6: Test AUTO mode (if GPIO27 wired)**

Flip DPDT switch to AUTO. Press SparkFun button to trigger a wake cycle. Check that:

```bash
# After Pi powers back on in BYPASS:
ssh timelapse-pi "ls ~/timelapse/images/auto/"
ssh timelapse-pi "cat ~/timelapse/logs/boot_trace.log | tail -10"
```

Expected: New capture in `auto/` directory. Boot trace shows AUTO capture.

- [ ] **Step 7: Commit any fixes**

If any changes were needed during testing:

```bash
git add -A
git commit -m "fix: address issues found during integration testing"
```
