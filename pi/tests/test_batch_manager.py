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
