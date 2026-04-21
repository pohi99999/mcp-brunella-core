"""Helpers for resolving Google service-account credentials safely."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV = "GOOGLE_SERVICE_ACCOUNT_JSON"
CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV = "GOOGLE_CREDENTIALS_FILE"
LEGACY_GOOGLE_SERVICE_ACCOUNT_ENVS = (
    "GOOGLE_SHEETS_CREDS",
    "GOOGLE_CLOUD_CREDENTIALS_PATH",
)
DEFAULT_GOOGLE_SERVICE_ACCOUNT_FILE = "./credentials/google-service-account.json"
LEGACY_GOOGLE_SERVICE_ACCOUNT_FILE = "./config/google-service-account.json"
CANONICAL_GOOGLE_WORKSPACE_CREDENTIALS_FILE_ENV = "GOOGLE_WORKSPACE_CREDENTIALS_FILE"
CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV = "GOOGLE_WORKSPACE_TOKEN_FILE"
LEGACY_GOOGLE_WORKSPACE_TOKEN_FILE_ENV = "GMAIL_TOKEN_FILE"
DEFAULT_GOOGLE_WORKSPACE_CREDENTIALS_FILE = "./credentials/google-oauth2-credentials.json"
DEFAULT_GOOGLE_WORKSPACE_TOKEN_FILE = "./credentials/google-token.json"
LEGACY_GOOGLE_WORKSPACE_CREDENTIALS_FILES = (
    "./config/google_credentials.json",
    "./credentials.json",
)
LEGACY_GOOGLE_WORKSPACE_TOKEN_FILES = (
    "./config/google_token.json",
    "./token.json",
)


@dataclass(frozen=True)
class GoogleServiceAccountSource:
    value: Optional[str]
    source_name: Optional[str]
    is_inline_json: bool
    is_legacy_env: bool
    is_legacy_path: bool


@dataclass(frozen=True)
class GoogleWorkspaceOAuthPaths:
    credentials_path: str
    token_path: str
    preferred_credentials_path: str
    preferred_token_path: str
    credentials_source_name: Optional[str]
    token_source_name: Optional[str]
    using_legacy_credentials_path: bool
    using_legacy_token_path: bool
    using_legacy_token_env: bool


def _normalize(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _is_inline_json(value: str) -> bool:
    return value.lstrip().startswith("{")


def _is_legacy_config_path(value: str) -> bool:
    normalized = value.replace("\\", "/").strip()
    if _is_inline_json(normalized):
        return False
    return normalized in {
        "config/google-service-account.json",
        "./config/google-service-account.json",
    } or normalized.endswith("/config/google-service-account.json")


def _warn(message: str, active_logger: Optional[logging.Logger]) -> None:
    (active_logger or logger).warning(message)


def _normalize_path(value: str) -> str:
    return os.path.normcase(os.path.abspath(value))


def _matches_any_path(value: str, candidates: tuple[str, ...]) -> bool:
    normalized_value = _normalize_path(value)
    return any(normalized_value == _normalize_path(candidate) for candidate in candidates)


def _build_source(
    value: str,
    source_name: Optional[str],
    *,
    is_legacy_env: bool,
    active_logger: Optional[logging.Logger],
) -> GoogleServiceAccountSource:
    source = GoogleServiceAccountSource(
        value=value,
        source_name=source_name,
        is_inline_json=_is_inline_json(value),
        is_legacy_env=is_legacy_env,
        is_legacy_path=_is_legacy_config_path(value),
    )

    if source.is_legacy_env and source_name:
        _warn(
            f"Legacy Google service-account env '{source_name}' detected. "
            f"Prefer '{CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV}' or "
            f"'{CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV}'.",
            active_logger,
        )

    if source.is_legacy_path:
        _warn(
            "Legacy Google service-account path detected ('./config/google-service-account.json'). "
            f"Move the file to '{DEFAULT_GOOGLE_SERVICE_ACCOUNT_FILE}' or inject "
            f"'{CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV}'.",
            active_logger,
        )

    return source


def _resolve_workspace_path(
    configured_path: Optional[str],
    *,
    preferred_path: str,
    legacy_paths: tuple[str, ...],
) -> tuple[str, str, bool]:
    normalized_configured_path = _normalize(configured_path)
    if normalized_configured_path:
        using_legacy_path = _matches_any_path(normalized_configured_path, legacy_paths)
        return (
            normalized_configured_path,
            preferred_path if using_legacy_path else normalized_configured_path,
            using_legacy_path,
        )

    if os.path.exists(preferred_path):
        return preferred_path, preferred_path, False

    for candidate in legacy_paths:
        if os.path.exists(candidate):
            return candidate, preferred_path, True

    return preferred_path, preferred_path, False


def resolve_google_service_account_source(
    explicit_value: Optional[str] = None,
    *,
    active_logger: Optional[logging.Logger] = None,
) -> GoogleServiceAccountSource:
    normalized_explicit = _normalize(explicit_value)
    if normalized_explicit:
        return _build_source(
            normalized_explicit,
            None,
            is_legacy_env=False,
            active_logger=active_logger,
        )

    env_order = (
        CANONICAL_GOOGLE_SERVICE_ACCOUNT_JSON_ENV,
        CANONICAL_GOOGLE_SERVICE_ACCOUNT_FILE_ENV,
        *LEGACY_GOOGLE_SERVICE_ACCOUNT_ENVS,
    )
    for env_name in env_order:
        env_value = _normalize(os.getenv(env_name))
        if env_value:
            return _build_source(
                env_value,
                env_name,
                is_legacy_env=env_name in LEGACY_GOOGLE_SERVICE_ACCOUNT_ENVS,
                active_logger=active_logger,
            )

    return GoogleServiceAccountSource(
        value=None,
        source_name=None,
        is_inline_json=False,
        is_legacy_env=False,
        is_legacy_path=False,
    )


def resolve_google_service_account_value(
    explicit_value: Optional[str] = None,
    *,
    active_logger: Optional[logging.Logger] = None,
) -> Optional[str]:
    return resolve_google_service_account_source(
        explicit_value,
        active_logger=active_logger,
    ).value


def resolve_google_workspace_oauth_paths(
    *,
    credentials_file: Optional[str] = None,
    token_file: Optional[str] = None,
    active_logger: Optional[logging.Logger] = None,
) -> GoogleWorkspaceOAuthPaths:
    credentials_env_value = _normalize(
        credentials_file or os.getenv(CANONICAL_GOOGLE_WORKSPACE_CREDENTIALS_FILE_ENV)
    )
    token_source_name: Optional[str]
    token_env_value = _normalize(token_file)
    if token_env_value:
        token_source_name = None
        using_legacy_token_env = False
    else:
        token_env_value = _normalize(os.getenv(CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV))
        token_source_name = CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV if token_env_value else None
        using_legacy_token_env = False
        if not token_env_value:
            token_env_value = _normalize(os.getenv(LEGACY_GOOGLE_WORKSPACE_TOKEN_FILE_ENV))
            token_source_name = LEGACY_GOOGLE_WORKSPACE_TOKEN_FILE_ENV if token_env_value else None
            using_legacy_token_env = bool(token_env_value)

    credentials_path, preferred_credentials_path, using_legacy_credentials_path = _resolve_workspace_path(
        credentials_env_value,
        preferred_path=DEFAULT_GOOGLE_WORKSPACE_CREDENTIALS_FILE,
        legacy_paths=LEGACY_GOOGLE_WORKSPACE_CREDENTIALS_FILES,
    )
    token_path, preferred_token_path, using_legacy_token_path = _resolve_workspace_path(
        token_env_value,
        preferred_path=DEFAULT_GOOGLE_WORKSPACE_TOKEN_FILE,
        legacy_paths=LEGACY_GOOGLE_WORKSPACE_TOKEN_FILES,
    )

    if using_legacy_credentials_path:
        _warn(
            "Legacy Google Workspace OAuth credentials path detected. "
            f"Move it to '{DEFAULT_GOOGLE_WORKSPACE_CREDENTIALS_FILE}' or set "
            f"'{CANONICAL_GOOGLE_WORKSPACE_CREDENTIALS_FILE_ENV}'.",
            active_logger,
        )

    if using_legacy_token_env:
        _warn(
            f"Legacy Google Workspace token env '{LEGACY_GOOGLE_WORKSPACE_TOKEN_FILE_ENV}' detected. "
            f"Prefer '{CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV}'.",
            active_logger,
        )

    if using_legacy_token_path:
        _warn(
            "Legacy Google Workspace token path detected. "
            f"Move it to '{DEFAULT_GOOGLE_WORKSPACE_TOKEN_FILE}' or set "
            f"'{CANONICAL_GOOGLE_WORKSPACE_TOKEN_FILE_ENV}'.",
            active_logger,
        )

    return GoogleWorkspaceOAuthPaths(
        credentials_path=credentials_path,
        token_path=token_path,
        preferred_credentials_path=preferred_credentials_path,
        preferred_token_path=preferred_token_path,
        credentials_source_name=(
            CANONICAL_GOOGLE_WORKSPACE_CREDENTIALS_FILE_ENV if credentials_env_value else None
        ),
        token_source_name=token_source_name,
        using_legacy_credentials_path=using_legacy_credentials_path,
        using_legacy_token_path=using_legacy_token_path,
        using_legacy_token_env=using_legacy_token_env,
    )
