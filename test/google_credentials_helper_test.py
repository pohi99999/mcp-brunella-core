import logging

from myai.utils.google_credentials import (
    CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV,
    CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV,
    CANONICAL_GOOGLE_WORKSPACE_CREDENTIALS_FILE_ENV,
    CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV,
    LEGACY_GOOGLE_SERVICE_ACCOUNT_ENVS,
    LEGACY_GOOGLE_WORKSPACE_TOKEN_FILE_ENV,
    resolve_google_service_account_source,
    resolve_google_workspace_oauth_paths,
)


def _clear_google_service_account_env(monkeypatch) -> None:
    monkeypatch.delenv(CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV, raising=False)
    monkeypatch.delenv(CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV, raising=False)
    for env_name in LEGACY_GOOGLE_SERVICE_ACCOUNT_ENVS:
        monkeypatch.delenv(env_name, raising=False)


def test_prefers_inline_google_service_account_json(monkeypatch):
    _clear_google_service_account_env(monkeypatch)
    monkeypatch.setenv(
        CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV,
        '{"type":"service_account","project_id":"brunella"}',
    )
    monkeypatch.setenv(
        CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV,
        "./credentials/google-service-account.json",
    )

    source = resolve_google_service_account_source()

    assert source.source_name == CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV
    assert source.is_inline_json is True
    assert source.is_legacy_env is False


def test_uses_canonical_google_credentials_file(monkeypatch):
    _clear_google_service_account_env(monkeypatch)
    monkeypatch.setenv(
        CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV,
        "./credentials/google-service-account.json",
    )

    source = resolve_google_service_account_source()

    assert source.value == "./credentials/google-service-account.json"
    assert source.source_name == CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV
    assert source.is_inline_json is False
    assert source.is_legacy_env is False


def test_warns_on_legacy_env_alias(monkeypatch, caplog):
    _clear_google_service_account_env(monkeypatch)
    monkeypatch.setenv("GOOGLE_SHEETS_CREDS", "./credentials/google-service-account.json")

    with caplog.at_level(logging.WARNING):
        source = resolve_google_service_account_source()

    assert source.source_name == "GOOGLE_SHEETS_CREDS"
    assert source.is_legacy_env is True
    assert "Legacy Google service-account env" in caplog.text


def test_warns_on_legacy_config_path(monkeypatch, caplog):
    _clear_google_service_account_env(monkeypatch)
    monkeypatch.setenv("GOOGLE_CREDENTIALS_FILE", "./config/google-service-account.json")

    with caplog.at_level(logging.WARNING):
        source = resolve_google_service_account_source()

    assert source.is_legacy_path is True
    assert "./config/google-service-account.json" in caplog.text


def test_workspace_oauth_prefers_explicit_env_paths(monkeypatch):
    monkeypatch.setenv(
        CANONICAL_GOOGLE_WORKSPACE_CREDENTIALS_FILE_ENV,
        "./secrets/oauth.json",
    )
    monkeypatch.setenv(
        CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV,
        "./secrets/token.json",
    )

    paths = resolve_google_workspace_oauth_paths()

    assert paths.credentials_path.endswith("secrets/oauth.json")
    assert paths.token_path.endswith("secrets/token.json")
    assert paths.using_legacy_credentials_path is False
    assert paths.using_legacy_token_path is False


def test_workspace_oauth_warns_on_legacy_token_env(monkeypatch, caplog):
    monkeypatch.delenv(CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV, raising=False)
    monkeypatch.setenv(LEGACY_GOOGLE_WORKSPACE_TOKEN_FILE_ENV, "./token.json")

    with caplog.at_level(logging.WARNING):
        paths = resolve_google_workspace_oauth_paths()

    assert paths.using_legacy_token_env is True
    assert "Legacy Google Workspace token env" in caplog.text


def test_workspace_oauth_falls_back_to_legacy_root_files(monkeypatch, tmp_path, caplog):
    monkeypatch.chdir(tmp_path)
    credentials_file = tmp_path / "credentials.json"
    token_file = tmp_path / "token.json"
    credentials_file.write_text("{}", encoding="utf-8")
    token_file.write_text("{}", encoding="utf-8")

    with caplog.at_level(logging.WARNING):
        paths = resolve_google_workspace_oauth_paths()

    assert paths.credentials_path.endswith("credentials.json")
    assert paths.token_path.endswith("token.json")
    assert paths.using_legacy_credentials_path is True
    assert paths.using_legacy_token_path is True
    assert "Legacy Google Workspace OAuth credentials path detected" in caplog.text
    assert "Legacy Google Workspace token path detected" in caplog.text
