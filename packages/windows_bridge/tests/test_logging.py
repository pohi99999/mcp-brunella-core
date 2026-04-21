from fastapi.testclient import TestClient
from wab_server import app, BASE_DIR
import os
import uuid
from pathlib import Path

client = TestClient(app)

def test_audit_logging():
    log_dir = BASE_DIR / "logs"
    if not log_dir.exists():
        log_dir.mkdir()
    log_file = log_dir / "wab_audit.log"
    
    unique_string = f"LogTest_{uuid.uuid4().hex}"
    client.post("/ps/execute", json={"command": f"Write-Output '{unique_string}'"})
    
    assert log_file.exists()
    content = log_file.read_text(encoding="utf-8", errors="ignore")
    assert unique_string in content
