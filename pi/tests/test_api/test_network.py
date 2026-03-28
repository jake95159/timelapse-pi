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
