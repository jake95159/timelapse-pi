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
