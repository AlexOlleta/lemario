import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import Settings, create_app

API_KEY = "secret"


def fake_lemario(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/health":
        return httpx.Response(200, json={"status": "ok", "index_ready": True})
    if request.headers.get("X-API-Key") != API_KEY:
        return httpx.Response(401, json={"detail": "invalid"})
    if request.url.path == "/words/rhymes":
        return httpx.Response(200, json={"words": ["hijo"], "query": str(request.url.query)})
    return httpx.Response(200, json={})


def make_client(api_key: str = API_KEY, handler=fake_lemario) -> TestClient:
    app = create_app(Settings(api_key=api_key), httpx.MockTransport(handler))
    return TestClient(app)


def test_forwards_allowed_path_with_key():
    with make_client() as client:
        response = client.get("/api/words/rhymes", params={"ending": "ijo"})
    assert response.status_code == 200
    assert "ending=ijo" in response.json()["query"]


def test_repeated_params_are_preserved():
    with make_client() as client:
        response = client.get("/api/words/exists?w=a&w=b")
    assert response.status_code == 200


@pytest.mark.parametrize("path", ["health", "docs", "words/../health", "words/exists/a/b", "admin"])
def test_blocks_paths_outside_allowlist(path):
    with make_client() as client:
        assert client.get(f"/api/{path}").status_code == 404


def test_wrong_key_is_not_leaked_as_401():
    with make_client("wrong") as client:
        response = client.get("/api/words/rhymes", params={"ending": "ijo"})
    assert response.status_code == 502
    assert response.json() == {"error": "bad_key"}


def test_api_down_returns_503():
    def refuse(request):
        raise httpx.ConnectError("down")

    with make_client(handler=refuse) as client:
        assert client.get("/api/words/random").status_code == 503
        assert client.get("/api/status").json() == {"state": "down"}


def test_status_states():
    with make_client() as client:
        assert client.get("/api/status").json() == {"state": "ok"}
    with make_client("wrong") as client:
        assert client.get("/api/status").json() == {"state": "bad_key"}
    with make_client("") as client:
        assert client.get("/api/status").json() == {"state": "bad_key"}


def test_only_get_and_security_headers():
    with make_client() as client:
        assert client.post("/api/words/random").status_code == 405
        headers = client.get("/").headers
    assert "default-src 'self'" in headers["content-security-policy"]
    assert headers["x-content-type-options"] == "nosniff"
