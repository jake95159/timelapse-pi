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
