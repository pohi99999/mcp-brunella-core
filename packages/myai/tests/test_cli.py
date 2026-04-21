from myai.cli import app

def test_cli_app_exists():
    assert app is not None
    assert len(app.registered_commands) > 0
