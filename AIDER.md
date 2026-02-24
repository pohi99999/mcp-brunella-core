# 🤖 Aider AI Assistant Integration Guide

**Last Updated:** 2026-02-24  
**Status:** Active Integration  
**Model:** GPT-4o (GitHub Models) / Gemini 2.0 Flash (via LiteLLM)

---

## What is Aider?

Aider is an AI pair programming tool that works directly in your terminal and git repository. It can:
- Write and edit code across multiple files
- Create git commits automatically
- Refactor code intelligently
- Generate tests
- Work on feature branches

---

## Team Roles

```
┌─────────────────────────────────────────────────┐
│  Brunella AI Development Team                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  Claude Code (Architect & Coordinator)           │
│  ├─ Planning & high-level architecture          │
│  ├─ Track management & coordination             │
│  ├─ Code reviews & final decisions              │
│  └─ Complex refactoring (multi-agent systems)   │
│                                                  │
│  Aider (Code Writer & Refactorer)                │
│  ├─ Focused code changes (1-3 files)            │
│  ├─ Test file generation                        │
│  ├─ Small-medium features (own branch)          │
│  └─ Boilerplate code generation                 │
│                                                  │
│  Gemini CLI (Browser & Python Specialist)        │
│  ├─ RobotkezV2 Comet development                │
│  ├─ Python subsystem (myai/)                    │
│  └─ Dashboard widgets & UI                      │
│                                                  │
│  Brunella Agents (Automation & Execution)        │
│  └─ OrchestratorAgent coordinates runtime tasks │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## ✅ When to Use Aider

**Perfect for:**
- **Small features** (1-3 files, well-defined scope)
  - Example: "Add email validation to ContactForm.tsx"
- **Refactoring** (rename, extract functions, type improvements)
  - Example: "Extract email sending logic into a separate utility"
- **Test generation**
  - Example: "Create unit tests for ApifyScrapingAgent"
- **Bug fixes** (isolated, well-understood)
  - Example: "Fix the null check error in line 42 of logger.ts"
- **Boilerplate code**
  - Example: "Create a new REST endpoint for /api/tasks"

**Best practices:**
- Work on **feature branches** (not main directly)
- Let Aider **auto-commit** after successful changes
- Review Aider's changes before merging

---

## ❌ When NOT to Use Aider

**Avoid for:**
- **Protected files** (see `.aiderignore`)
  - `conductor/tracks.md` (ProjectConductor manages)
  - `src/agents/registry.json` (manual agent registration)
  - `.ai/claude.md`, `.ai/gemini.md` (agent work logs)
  - `.env` (sensitive configuration)
- **Critical infrastructure** (complex state management)
  - `src/core/modelRouter.ts` (multi-provider routing logic)
  - `src/utils/d1Adapter.ts` (Cloudflare D1 bridge)
  - `src/agents/AgentManager.ts` (agent lifecycle + queue)
- **Architectural decisions** (discuss with Claude first)
  - Database schema changes
  - New agent patterns
  - Breaking API changes
- **Large refactorings** (>5 files, multi-agent coordination)

---

## 🚀 Quick Start

### 1. Install Aider

```bash
# Using pip
pip install aider-chat

# Or using pipx (recommended)
pipx install aider-chat
```

### 2. Start LiteLLM Proxy (if using GitHub Models or Gemini)

```bash
# Start LiteLLM on port 4000
litellm --model github/gpt-4o --port 4000

# Or for Gemini
litellm --model gemini/gemini-2.0-flash --port 4000
```

### 3. Run Aider

```bash
# Using GitHub Models GPT-4o (via LiteLLM)
aider --model openai/gpt-4o \
      --openai-api-base http://localhost:4000 \
      --openai-api-key dummy

# Or using Gemini (via LiteLLM)
aider --model openai/gemini-2.0-flash \
      --openai-api-base http://localhost:4000 \
      --openai-api-key dummy

# Or direct OpenAI (if you have API key)
aider --model gpt-4o --openai-api-key YOUR_KEY

# Or Anthropic Claude
aider --model claude-3-5-sonnet-20241022 --anthropic-api-key YOUR_KEY
```

### 4. Add Files to Context

```bash
# In Aider prompt
/add src/agents/MyAgent.ts
/add test/myAgent.test.ts

# Or start with files
aider src/agents/MyAgent.ts test/myAgent.test.ts
```

### 5. Give Instructions

```
Create a new method called processData() that validates input 
and returns a TypeScript Result type. Add unit tests.
```

---

## 📋 Common Workflows

### Workflow 1: New Agent Implementation

```bash
# 1. Create feature branch
git checkout -b feature/my-new-agent

# 2. Start Aider with template
aider src/agents/MyNewAgent.ts

# 3. Instruct Aider
"""
Create a new agent class MyNewAgent that implements IAgent.
It should have:
- name: 'MyNew'
- capabilities: ['data_processing', 'validation']
- execute() method that processes input data
- Proper error handling with try/catch/finally
- Status updates via setAgentStatus()
"""

# 4. Review and test
npm run build
npm test -- myNewAgent

# 5. Commit (Aider auto-commits)
# 6. Merge via PR
```

### Workflow 2: Refactoring

```bash
aider src/utils/oldHelper.ts

# Instruct Aider:
"""
Extract the email validation logic into a separate validateEmail() 
function. Add TypeScript types. Add unit tests in test/validation.test.ts
"""
```

### Workflow 3: Test Generation

```bash
aider --read src/agents/ApifyScrapingAgent.ts --write test/apifyScrapingAgent.test.ts

# Instruct:
"""
Generate comprehensive unit tests for ApifyScrapingAgent.
Test all public methods, error cases, and edge cases.
Use Vitest framework.
"""
```

---

## 🛡️ Safety Guardrails

### Pre-commit Checks

Before Aider commits, ensure:
1. ✅ `npm run build` succeeds (0 TypeScript errors)
2. ✅ `npm test` passes (all tests green)
3. ✅ No changes to protected files (`.aiderignore` blocks these)
4. ✅ Git branch is NOT `main` (work on feature branches)

### If Aider Gets Stuck

1. **Simplify the task** - Break into smaller steps
2. **Add more context** - `/add` relevant files
3. **Check model** - Try different model if GPT-4o struggles
4. **Fallback to Claude** - For complex architectural changes

---

## 🔧 Configuration

### LiteLLM Config (litellm_config.yaml)

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: github/gpt-4o
      api_base: https://models.inference.ai.azure.com
      api_key: os.environ/GITHUB_PAT

  - model_name: gemini-2.0-flash
    litellm_params:
      model: gemini/gemini-2.0-flash
      api_key: os.environ/GEMINI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  drop_params: true
```

### Start LiteLLM

```bash
litellm --config litellm_config.yaml --port 4000
```

---

## 📊 Usage Statistics

Track Aider usage in `.ai/aider.md` (optional):

```markdown
### 2026-02-24 - Aider Session

**Task:** Implemented ChromeDevToolsAgent helper methods
**Files:** src/agents/ChromeDevToolsAgent.ts
**Result:** ✅ Success (3 methods added, tests passing)
**Duration:** 15 minutes
**Model:** GPT-4o (GitHub Models)
```

---

## 🎯 Best Practices

1. **One feature per branch** - Don't mix unrelated changes
2. **Let Aider commit** - Use auto-commit for traceability
3. **Review before merge** - Always check Aider's code
4. **Keep context small** - Add only relevant files (3-5 max)
5. **Clear instructions** - Specific > vague
6. **Test immediately** - Run tests after each Aider session

---

## 🚨 Emergency Stop

If Aider makes unwanted changes:

```bash
# Undo last commit
git reset --hard HEAD~1

# Or discard all changes
git checkout .

# Or restore specific file
git checkout HEAD -- src/agents/MyAgent.ts
```

---

## 📚 Resources

- **Aider Docs:** https://aider.chat/docs/
- **LiteLLM Docs:** https://docs.litellm.ai/
- **Track:** `conductor/tracks/aider_integration_20260222/`

---

**Generated:** 2026-02-24 by Claude  
**Track:** `aider_integration_20260222`
