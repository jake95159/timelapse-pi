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
