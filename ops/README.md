# Infrastructure ^& Ops Directory

This directory contains all operational scripts, Docker configurations, and infrastructure-related files.

## Directory Structure

- `bootstrap/`: Primary launchers and system startup scripts.
- `docker/`: Dockerfiles, Docker Compose configurations, and Nginx settings.
- `infra/`: Infrastructure-as-code and cloud-specific configurations (TBD).
- `scripts/`: Maintenance, utility, and background synchronization scripts.

## Key Files

### Bootstrap
- `BRUNELLA_START.bat`: The master orchestration startup script.
- `inditas.bat`: Canonical stable entry point (with Windows service support).
- `start-full.bat`: All-in-one startup for local development.

### Docker
- `Dockerfile.node`: Production Node.js environment.
- `Dockerfile.python`: Specialized Python agent environment.
- `docker-compose.yml`: Local container orchestration.

### Scripts
- `dashboard.bat`: Standalone launcher for the Dashboard UI.
- `github-sync.bat`: Automated repository synchronization and state management.

## Usage

Use the root `start.bat` as the primary entry point. It provides a menu to delegate to the specialized scripts in this directory.
