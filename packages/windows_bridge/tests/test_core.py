# windows_bridge/tests/test_core.py
from wab_server import run_powershell

def test_run_powershell_success():
    result = run_powershell("Write-Output 'Hello WAB'")
    assert result["ok"] is True
    assert "Hello WAB" in result["stdout"]
    assert result["returncode"] == 0

def test_run_powershell_error():
    result = run_powershell("Write-Error 'Test Error'")
    # pwsh Write-Error doesn't necessarily fail returncode, but it writes to stderr
    # Let's just check the text in stderr
    assert "Test Error" in result["stderr"]
