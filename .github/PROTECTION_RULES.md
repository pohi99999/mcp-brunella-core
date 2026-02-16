# 🛡️ BAS Repository Protection Rules (Phoenix Protocol)

This repository enforces strict rules to ensure stability ("Antifragility").
Use these guidelines when managing branches and merging code.

## 🚫 Forbidden Actions
1.  **Direct Push to Main:** NEVER push code directly to the \main\ branch.
2.  **Force Push:** NEVER use \git push --force\ on protected branches.
3.  **Branch Deletion:** Do not delete \main\ or active feature tracks defined in \	racks.md\.

## ✅ Required Workflow (The "Glass Box" Way)
1.  **Create Branch:** \git checkout -b feat/my-new-feature\
2.  **Commit Changes:** Use Conventional Commits (e.g., \ix(agent): handle null response\).
3.  **Open PR:** Create a Pull Request via GitHub CLI or Interface.
4.  **Merge:** Squash and Merge is preferred to keep history clean.

## 🤖 AI Agent Behavior
- If you (the AI) are asked to fix a bug, ALWAYS create a new branch first.
- Do not attempt to bypass these rules using admin privileges.
