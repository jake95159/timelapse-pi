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
