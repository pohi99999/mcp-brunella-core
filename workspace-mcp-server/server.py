from pathlib import Path
from sys import path as sys_path

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys_path:
    sys_path.insert(0, str(SRC_ROOT))

from workspace_mcp_server.server import main


if __name__ == "__main__":
    main()
