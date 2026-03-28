def test_app_starts(client):
    # Stub router has no routes, but the app should start without errors
    response = client.get("/api/nonexistent")
    assert response.status_code == 404
