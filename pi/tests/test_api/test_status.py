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
