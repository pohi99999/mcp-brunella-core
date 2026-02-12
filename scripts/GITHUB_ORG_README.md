# GitHub Repository Organization Scripts

## Overview

These scripts automate the setup of labels, milestones, and initial issues for the Brunella-Core repository organization.

## Scripts

### `setup_github_org.sh` (Linux/macOS/Git Bash)
Bash script for Unix-like systems.

### `setup_github_org.bat` (Windows)
Batch script for Windows Command Prompt.

## What the Scripts Do

### 1. Create Labels
The scripts create three organizational labels:

- **mcp-tool** (Blue #0075ca): For new MCP tool development
- **core-logic** (Red #d73a4a): For core system development
- **database** (Light Blue #a2eeef): For database and storage work

### 2. Create Milestones
Two milestones are created:

- **Fázis 3: Stabilizálás**: Bug fixes and testing phase
- **Fázis 4: Adat-Raj (Data Swarm)**: Mass agent management phase

### 3. Create Initial Issues
Two initial issues are created:

1. **Dashboard integráció véglegesítése**
   - Label: `core-logic`
   - Milestone: `Fázis 3: Stabilizálás`
   - Description: Full synchronization between frontend and MCP server after network errors

2. **SQLite/LanceDB séma véglegesítése**
   - Label: `database`
   - Milestone: `Fázis 4: Adat-Raj (Data Swarm)`
   - Description: Create database tables needed for the Data Swarm phase

## Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated
- Appropriate permissions on the `pohi99999/mcp-brunella-core` repository

## Usage

### Linux/macOS/Git Bash
```bash
cd scripts
./setup_github_org.sh
```

### Windows Command Prompt
```cmd
cd scripts
setup_github_org.bat
```

### Windows PowerShell
```powershell
cd scripts
cmd /c setup_github_org.bat
```

## Authentication

Before running the scripts, ensure you're authenticated with GitHub CLI:

```bash
gh auth login
```

Or set the `GH_TOKEN` environment variable:

```bash
export GH_TOKEN=your_github_token
```

## Notes

- The `--force` flag on label creation means existing labels will be updated if they already exist
- Milestone creation will fail if a milestone with the same title already exists (this is by design)
- Issue creation will always create new issues; duplicate checking is not performed

## Troubleshooting

### "gh: command not found"
Install GitHub CLI from https://cli.github.com/

### Authentication errors
Run `gh auth login` to authenticate with GitHub

### Permission errors
Ensure you have write access to the repository

## Script Modification

To customize the labels, milestones, or issues:
1. Edit the script file
2. Modify the `gh label create`, `gh api`, or `gh issue create` commands
3. Refer to the [GitHub CLI documentation](https://cli.github.com/manual/) for available options
