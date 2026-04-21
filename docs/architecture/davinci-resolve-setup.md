# DaVinci Resolve setup for Brunella Studio

## Manual prerequisites
1. Install DaVinci Resolve on the local workstation.
2. Enable scripting support in the Resolve installation.
3. Ensure Python is available to BAS (`PYTHON_BIN`).
4. Point BAS to the Resolve scripting folders if auto-detection does not find them.

## Expected environment variables
```env
PYTHON_BIN=python
DAVINCI_RESOLVE_SCRIPT_API_PATH=C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting
DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES=C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules
DAVINCI_RESOLVE_PROJECT_NAME=BrunellaStudio
```

## Windows default locations
- API root: `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting`
- Python modules: `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules`
- Resolve executable: `C:\Program Files\Blackmagic Design\DaVinci Resolve\Resolve.exe`

## Verification
```bash
node build/cli.js studio probe
python scripts/resolve/resolve_probe.py
python scripts/resolve/resolve_bridge.py < NUL
```

## Troubleshooting
- If `resolve_probe.py` sees no install, verify the Resolve installation path.
- If `resolve_bridge.py` cannot import `DaVinciResolveScript`, set both scripting path env vars explicitly.
- If Resolve is installed but `resolveReachable=false`, start Resolve once manually before probing.
- If render queueing fails, check that the target project exists and the render settings/preset are supported by the local Resolve build.

## Operational note
Brunella Studio gracefully degrades to FFmpeg-only execution when Resolve is unavailable. That keeps ingest, rough-cut, audio planning, baseline rendering, and QC usable in CI or headless environments.
