# Chief of Staff & Autocleaning Swarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Visionary-Architect" workflow by creating the `myai/incubator` environment, preparing the `Z:\.000_PROJEKTEK` directory structure for external clients, and launching the first phase of the Autocleaning Swarm (The Great Audit).

**Architecture:** This plan focuses on creating physical boundaries (directories), updating the central Conductor configuration to recognize these boundaries, and creating a dedicated tracking mechanism for technical debt removal. No core functionality of Brunella will be modified; this is purely structural and organizational to support the new interaction model.

**Tech Stack:** File system operations, Git, JSON manipulation (Conductor config), Markdown.

---

### Task 1: Create the Incubator Safe Zone

**Files:**
- Create: `myai/incubator/README.md`
- Create: `myai/incubator/.gitignore`
- Modify: `config/safe_zones.json` (if exists, to include incubator)

- [ ] **Step 1: Create the incubator directory and README**
```bash
mkdir -p myai/incubator
```
```markdown
<!-- myai/incubator/README.md -->
# Brunella Incubator (The Visionary's Playground)

This is the designated safe zone for rapid prototyping, zero-prompt experiments, and A2A integration testing.
Code here is EXEMPT from strict EPP v2 rules during ideation. 

**Rules:**
1. Experiment freely.
2. If it works, the Chief of Staff (AI Architect) will refactor, test, and migrate it to the stable Core.
3. Do NOT import directly from `incubator/` into `src/` or `myai/server.py`.
```

- [ ] **Step 2: Create incubator .gitignore**
To prevent committing temporary junk, but keep the folder tracked:
```gitignore
# myai/incubator/.gitignore
# Ignore temporary experiment files, but allow tracking explicit prototypes
*.tmp
*.log
__pycache__/
node_modules/
```

- [ ] **Step 3: Update safe zones configuration**
Verify if `config/safe_zones.json` exists. If it does, ensure `myai/incubator` is included as described in the specs. (Assuming the file structure from the prompt context).
Run: `cat config/safe_zones.json`
If it needs modification, append: `{"name": "Incubator", "path": "./myai/incubator", "permissions": ["read", "write"]}` to the `safe_zones` array.

- [ ] **Step 4: Commit Incubator creation**
```bash
git add myai/incubator/
git commit -m "chore(workspace): create incubator safe zone for rapid prototyping"
```

---

### Task 2: Scaffold the External Projects Directory (`Z:\.000_PROJEKTEK`)

**Note:** Since `Z:\` is outside the current workspace, these operations rely on absolute paths.

- [ ] **Step 1: Ensure the root directory exists**
```powershell
New-Item -ItemType Directory -Force -Path "Z:\.000_PROJEKTEK"
```

- [ ] **Step 2: Create a Central Manifest for Brunella**
Create a tracking file so Brunella knows what projects live outside.
```powershell
Set-Content -Path "Z:\.000_PROJEKTEK\brunella-managed-projects.json" -Value '{
  "last_updated": "",
  "managed_repositories": {
    "Nova_Assiss": {"path": "Z:\\.000_PROJEKTEK\\Nova_Assiss", "github": "https://github.com/pohi99999/Nova_Assiss.git"},
    "toura": {"path": "Z:\\.000_PROJEKTEK\\toura", "github": "https://github.com/pohi99999/toura.git"},
    "P-book": {"path": "Z:\\.000_PROJEKTEK\\P-book", "github": "https://github.com/pohi99999/P-book.git"},
    "p-ber": {"path": "Z:\\.000_PROJEKTEK\\p-ber", "github": "https://github.com/pohi99999/p-ber.git"},
    "P-SEARCH": {"path": "Z:\\.000_PROJEKTEK\\P-SEARCH", "github": "https://github.com/pohi99999/P-SEARCH.git"},
    "ViktoriaVarga": {"path": "Z:\\.000_PROJEKTEK\\ViktoriaVarga", "github": ""}
  }
}'
```

- [ ] **Step 3: Document the external linking strategy in the Core**
```markdown
<!-- docs/external_projects.md -->
# External Client Projects

All client projects developed using Brunella have been moved out of `.worktrees` to reduce repository bloat.
They are now managed remotely at: `Z:\.000_PROJEKTEK\`

Brunella orchestrates these using absolute paths. A manifest of tracked repositories is located at `Z:\.000_PROJEKTEK\brunella-managed-projects.json`.
```

- [ ] **Step 4: Commit the documentation**
```bash
git add docs/external_projects.md
git commit -m "docs: document external Z drive project management strategy"
```

---

### Task 3: Initialize "The Great Audit" Track

**Files:**
- Modify: `conductor/tracks.md`
- Create: `conductor/tracks/great_audit_202604/meta.json`
- Create: `conductor/tracks/great_audit_202604/plan.md`

- [ ] **Step 1: Create the track metadata**
```bash
mkdir -p conductor/tracks/great_audit_202604
```
```json
// conductor/tracks/great_audit_202604/meta.json
{
  "id": "great_audit_202604",
  "name": "The Great Audit: Technical Debt Eradication",
  "description": "Comprehensive scan of mcp-brunella-core to identify orphan files, unused endpoints, and duplicate agents.",
  "status": "proposed",
  "owner": "Chief of Staff (AI Architect)",
  "created_at": "2026-04-18T00:00:00Z",
  "progress": 0,
  "sdlc": {
    "enabled": false
  },
  "tags": ["maintenance", "refactor", "cleanup"]
}
```

- [ ] **Step 2: Create the audit plan**
```markdown
<!-- conductor/tracks/great_audit_202604/plan.md -->
# The Great Audit Plan

**Goal:** Map the entire `mcp-brunella-core` and prepare a removal list for legacy clutter.

- [ ] Run `DependencyGraphAgent` to find unimported TypeScript/Python files in `src/` and `myai/`.
- [ ] Scan `src/server/routes/` against frontend API calls to find unused REST endpoints.
- [ ] Review `src/agents/registry.json` (95 agents) to flag duplicates or deprecated agent concepts.
- [ ] Present findings to the Visionary (User) for deletion approval.
```

- [ ] **Step 3: Register the track in tracks.md**
Add the new track to the `conductor/tracks.md` file under the "Proposed" section. (Assuming the file exists, append or insert appropriately).
Run: `echo "- [ ] **great_audit_202604**: The Great Audit: Technical Debt Eradication" >> conductor/tracks.md` (or equivalent file edit to keep formatting).

- [ ] **Step 4: Commit the Audit Track**
```bash
git add conductor/tracks/great_audit_202604/ conductor/tracks.md
git commit -m "feat(conductor): initialize The Great Audit track for tech debt removal"
```
