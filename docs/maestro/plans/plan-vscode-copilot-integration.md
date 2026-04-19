---
title: VS Code Insiders & GitHub Copilot CLI Integration Plan
status: approved
---

## Work Breakdown

### Phase 1: MCP Server Configuration (Gépház)
- **Agent**: `coder`
- **Goal**: Standardize the Copilot MCP server configuration in `~/.gemini/settings.json`. Remove the empty/broken entry and ensure `npx -y @aykahshi/copilot-mcp-server` is correctly registered.
- **Dependencies**: None
- **Validation**: `/mcp` output showing `copilot` as CONNECTED.

### Phase 2: IDE Companion Activation
- **Agent**: `devops_engineer`
- **Goal**: Run `/ide install` and `/ide enable` within the Gemini CLI. Verify that the dynamic port for the IDE companion is correctly established and the CLI is "IDE-aware".
- **Dependencies**: Phase 1
- **Validation**: `/ide status` returns "Connected to VS Code Insiders".

### Phase 3: Workspace Integration (Terminal & Settings)
- **Agent**: `design_system_engineer`
- **Goal**: Update `.vscode/settings.json` (or the global settings) to configure the integrated terminal for VS Code Insiders. Ensure that environmental variables required for the IDE companion are persistent.
- **Dependencies**: Phase 2
- **Validation**: Opening a new terminal in VS Code Insiders automatically shows Gemini CLI ready for action.
