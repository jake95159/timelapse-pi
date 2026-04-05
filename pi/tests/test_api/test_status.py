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
    assert data["battery_voltage"] is None
    assert data["battery_soc_pct"] is None


def test_status_runtime_estimate_without_hardware(client):
    resp = client.get("/api/status")
    data = resp.json()
    assert data["runtime_estimate_hours"] is not None
    assert data["runtime_estimate_hours"] > 0
