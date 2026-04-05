import pytest
from unittest.mock import MagicMock
from PIL import Image
from io import BytesIO

from api.main import create_app
from services.power import PowerService

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
