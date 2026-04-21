from __future__ import annotations

import sys
import time
import gc
import os
import platform
import pytest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture(scope="session", autouse=True)
def configure_for_windows():
    """
    Configure pytest for Windows compatibility.

    Prevents file locking issues on Windows by:
    - Setting PYTHONUNBUFFERED to prevent buffering issues
    - Setting PYTHONDONTWRITEBYTECODE to avoid __pycache__ locks
    """
    if platform.system() == "Windows":
        os.environ["PYTHONUNBUFFERED"] = "1"
        os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
        # Also set encoding to UTF-8 for consistent behavior
        os.environ["PYTHONIOENCODING"] = "utf-8"
        os.environ["PYTHONUTF8"] = "1"


@pytest.fixture(autouse=True)
def cleanup_after_test():
    """
    Ensure proper cleanup after each test.

    Forces garbage collection and adds small delay to allow Windows
    file system to release file handles before pytest tries to clean
    up temp directories.
    """
    yield

    # Force garbage collection to close any lingering file handles
    gc.collect()

    # Small delay for Windows file system latency
    # (file handles may not be released immediately)
    if platform.system() == "Windows":
        time.sleep(0.05)


@pytest.fixture
def isolated_lancedb_path(tmp_path):
    """
    Provide isolated LanceDB database path for each test.

    Returns a string path to a dedicated .lancedb directory within
    the test's tmp_path, ensuring database files don't conflict
    between tests.

    Args:
        tmp_path: pytest's built-in tmp_path fixture

    Returns:
        str: Absolute path to isolated LanceDB directory
    """
    db_path = tmp_path / ".lancedb"
    db_path.mkdir(exist_ok=True)
    return str(db_path)
