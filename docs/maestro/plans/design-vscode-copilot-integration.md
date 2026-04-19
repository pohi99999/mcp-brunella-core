---
title: VS Code Insiders & GitHub Copilot CLI Integration for Gemini CLI
date: 2026-04-16
task_complexity: medium
design_depth: deep
status: approved
---

## 1. Problem Statement
The user wants to unify their AI development environment by connecting the Gemini CLI with VS Code Insiders and the GitHub Copilot CLI. While extensions are installed, the Model Context Protocol (MCP) bridge between these tools is either inactive or incorrectly configured in the Gemini CLI settings, preventing cross-tool intelligence and IDE-aware code manipulation.

## 2. Approach: Native MCP Bridge & Integrated Environment
We will implement a tight integration using the official IDE Companion and the community-standard Copilot MCP wrapper.

### Key Elements:
*   **Copilot MCP Integration:** Fix the existing broken/redundant configuration for `@aykahshi/copilot-mcp-server` to allow Gemini CLI to leverage Copilot's reasoning.
*   **VS Code IDE Companion:** Activate the dynamic MCP server provided by the `google.gemini-cli-vscode-ide-companion` extension. This enables Gemini CLI to "see" the active editor, selection, and perform native diffing in VS Code Insiders.
*   **Integrated Terminal Setup:** Configure VS Code Insiders workspace settings to prioritize the Gemini CLI as the primary AI interaction point in the terminal.

## 3. Requirements & Constraints
*   **Tooling:** Requires `gh` CLI with `copilot` extension, `code-insiders`, and Gemini CLI (already verified).
*   **Configuration:** Must update `~/.gemini/settings.json` and `.vscode/settings.json`.
*   **Portability:** Use dynamic port detection for the IDE Companion.

## 4. Architecture & Data Flow
1.  **Copilot Chain:** Gemini CLI -> `copilot-mcp-server` -> `gh copilot` -> GitHub AI.
2.  **IDE Context:** Gemini CLI -> IDE Companion MCP (Local Socket/Port) -> VS Code Insiders Workspace.
3.  **Unified UX:** User interacts via VS Code Insiders terminal; Gemini CLI provides the orchestration, calling Copilot when specialized coding advice is needed or modifying files directly in the editor.

## 5. Test Plan
*   **MCP Connectivity:** Run `/mcp` inside Gemini CLI to verify `copilot` and `ide-companion` statuses.
*   **Functional Test:** Execute `/ide status` and an `ask-copilot` query.
*   **IDE Verification:** Verify that a kódmódosítás (file change) in Gemini CLI triggers a visual diff or update in VS Code Insiders.
