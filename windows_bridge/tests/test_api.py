from fastapi.testclient import TestClient
from wab_server import app
import pathlib

client = TestClient(app)

def test_ps_execute_endpoint():
    response = client.post("/ps/execute", json={"command": "Write-Output 'API Test'"})
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert "API Test" in response.json()["stdout"]

def test_fs_mkdir_endpoint(tmp_path: pathlib.Path):
    test_dir = tmp_path / "test_mkdir"
    response = client.post("/fs", json={"action": "mkdir", "path": str(test_dir)})
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert test_dir.exists()
