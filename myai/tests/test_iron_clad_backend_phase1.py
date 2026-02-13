from fastapi.testclient import TestClient

from myai.backend.app import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"


def test_models_endpoint_returns_list_shape():
    client = TestClient(app)
    response = client.get("/models")
    assert response.status_code == 200
    payload = response.json()
    assert payload["object"] == "list"
    assert isinstance(payload["data"], list)


def test_chat_completions_rejects_stream_mode():
    client = TestClient(app)
    response = client.post(
        "/chat/completions",
        json={
            "model": "qwen2.5-coder:latest",
            "stream": True,
            "messages": [{"role": "user", "content": "hello"}],
        },
    )
    assert response.status_code == 400
