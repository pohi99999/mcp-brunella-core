import json
import os
import platform
import sys
from pathlib import Path

KNOWN_API_PATHS = [
    Path(os.environ.get('DAVINCI_RESOLVE_SCRIPT_API_PATH', '')).expanduser() if os.environ.get('DAVINCI_RESOLVE_SCRIPT_API_PATH') else None,
    Path('C:/ProgramData/Blackmagic Design/DaVinci Resolve/Support/Developer/Scripting'),
    Path('/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting'),
    Path('/opt/resolve/Developer/Scripting'),
]

KNOWN_PYTHON_PATHS = [
    Path(os.environ.get('DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES', '')).expanduser() if os.environ.get('DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES') else None,
    Path('C:/ProgramData/Blackmagic Design/DaVinci Resolve/Support/Developer/Scripting/Modules'),
    Path('/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules'),
    Path('/opt/resolve/Developer/Scripting/Modules'),
]

KNOWN_EXECUTABLES = [
    Path('C:/Program Files/Blackmagic Design/DaVinci Resolve/Resolve.exe'),
    Path('C:/Program Files/Blackmagic Design/DaVinci Resolve/DaVinci Resolve.exe'),
    Path('/Applications/DaVinci Resolve/DaVinci Resolve.app'),
    Path('/opt/resolve/bin/resolve'),
]


def existing_paths(candidates):
    items = []
    for candidate in candidates:
        if candidate and candidate.exists():
            items.append(str(candidate))
    return items


def main():
    api_paths = existing_paths(KNOWN_API_PATHS)
    python_paths = existing_paths(KNOWN_PYTHON_PATHS)
    executables = existing_paths(KNOWN_EXECUTABLES)

    payload = {
        'success': True,
        'available': bool(api_paths or python_paths or executables),
        'platform': platform.platform(),
        'python': sys.executable,
        'apiPaths': api_paths,
        'pythonModulePaths': python_paths,
        'executables': executables,
        'env': {
            'DAVINCI_RESOLVE_SCRIPT_API_PATH': os.environ.get('DAVINCI_RESOLVE_SCRIPT_API_PATH', ''),
            'DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES': os.environ.get('DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES', ''),
            'DAVINCI_RESOLVE_PROJECT_NAME': os.environ.get('DAVINCI_RESOLVE_PROJECT_NAME', ''),
        },
    }
    print(json.dumps(payload))


if __name__ == '__main__':
    main()
