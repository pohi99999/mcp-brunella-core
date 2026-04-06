# SDLC Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a 5-phase SDLC lifecycle (Architect→DevOps→Coder→QA→Reviewer) that auto-triggers on new conductor track creation, is available in Copilot CLI/VS Code Insiders via `.github/agents/`, and always invokes the relevant superpowers skill per phase.

**Architecture:** A new `src/core/sdlcPipeline.ts` module owns the TypeScript-side lifecycle (init/advance/getStatus/reset with its own EventEmitter). `ProjectConductorAgent.createTrack()` calls `sdlcPipeline.init()` after writing `meta.json`. The Copilot-facing side adds `sdlc_phase:` frontmatter to five existing `.github/agents/` files and a new `sdlc-pipeline.agent.md` orchestrator.

**Tech Stack:** TypeScript ESM, Node.js `EventEmitter`, `fs` (sync reads/writes to `meta.json`), Vitest, Commander.js + Inquirer + Chalk + Ora (CLI).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/core/sdlcPipeline.ts` | Core SDLC lifecycle: init/advance/runPhase/getStatus/reset + EventEmitter |
| Create | `test/sdlcPipeline.test.ts` | Vitest unit tests for the core module |
| Modify | `src/agents/ProjectConductorAgent.ts` | Call `sdlcPipeline.init()` inside `createTrack()` after `saveState()` |
| Modify | `.github/agents/bas-mcp-architect.agent.md` | Add `sdlc_phase: architect` frontmatter |
| Modify | `.github/agents/devops-infra-guardian.agent.md` | Add `sdlc_phase: devops` frontmatter |
| Modify | `.github/agents/bas-lead-developer.agent.md` | Add `sdlc_phase: coder` frontmatter |
| Modify | `.github/agents/robust-test-writer.agent.md` | Add `sdlc_phase: qa` frontmatter |
| Modify | `.github/agents/bas-phoenix-reviewer.agent.md` | Add `sdlc_phase: reviewer` frontmatter |
| Create | `.github/agents/sdlc-pipeline.agent.md` | Copilot orchestrator agent (`@sdlc-pipeline /start|/status|/phase`) |
| Create | `src/cli/sdlcCommands.ts` | `brunella sdlc status/run/phase/reset <trackId>` |
| Modify | `src/cli.ts` | Register `sdlcCommands` |
| Modify | `.github/copilot-instructions.md` | 3 additive changes: SDLC section, routing table rows, conventions paragraph |

---

## Task 1: `src/core/sdlcPipeline.ts`

**Files:**
- Create: `src/core/sdlcPipeline.ts`

- [ ] **Step 1: Write the failing test first** (see Task 2 — do Task 2 before this)

- [ ] **Step 2: Create `src/core/sdlcPipeline.ts`**

```typescript
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { logInfo, logError } from '../utils/logger.js';

export type SdlcPhase = 'architect' | 'devops' | 'coder' | 'qa' | 'reviewer';
export type SdlcPhaseStatus = 'pending' | 'running' | 'completed' | 'failed';

interface SdlcPhaseData {
  status: SdlcPhaseStatus;
  agent: string;
  output: string;
  completedAt?: string;
  error?: string;
}

interface SdlcBlock {
  enabled: boolean;
  current_phase: SdlcPhase;
  auto_advance: boolean;
  phases: Record<SdlcPhase, SdlcPhaseData>;
}

interface MetaJson {
  id: string;
  status: string;
  progress: number;
  sdlc?: SdlcBlock;
  [key: string]: unknown;
}

export interface SdlcStatus {
  enabled: boolean;
  currentPhase: SdlcPhase;
  phases: Record<SdlcPhase, SdlcPhaseStatus>;
  complete: boolean;
}

export const PHASE_ORDER: SdlcPhase[] = [
  'architect', 'devops', 'coder', 'qa', 'reviewer',
];

const PHASE_AGENTS: Record<SdlcPhase, string> = {
  architect: 'bas-mcp-architect + SpecWriterAgent',
  devops:    'devops-infra-guardian + DependencyGraphAgent',
  coder:     'bas-lead-developer + DeveloperAgent',
  qa:        'robust-test-writer + EvaluatorAgent',
  reviewer:  'bas-phoenix-reviewer + strict-code-reviewer',
};

const TS_PHASE_AGENTS: Record<SdlcPhase, string> = {
  architect: 'SpecWriterAgent',
  devops:    'DependencyGraphAgent',
  coder:     'DeveloperAgent',
  qa:        'EvaluatorAgent',
  reviewer:  'EvaluatorAgent',
};

const PHASE_OUTPUTS: Record<SdlcPhase, string> = {
  architect: 'phases/1-architect.md',
  devops:    'phases/2-devops.md',
  coder:     'phases/3-coder.md',
  qa:        'phases/4-qa.md',
  reviewer:  'phases/5-reviewer.md',
};

/** Internal EventEmitter — avoids touching the closed PhoenixEventMap type. */
export const sdlcEvents = new EventEmitter();

// ─── helpers ────────────────────────────────────────────────────────────────

function readMeta(trackDir: string): MetaJson {
  const p = path.join(trackDir, 'meta.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as MetaJson;
}

function writeMeta(trackDir: string, meta: MetaJson): void {
  fs.writeFileSync(path.join(trackDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Called by ProjectConductorAgent.createTrack() after saveState().
 * Writes the `sdlc` block into meta.json and creates the phases/ dir.
 * Idempotent: if the sdlc block already exists, does nothing.
 */
export function init(trackId: string, trackDir: string): void {
  const meta = readMeta(trackDir);
  if (meta.sdlc) return; // already initialised

  const sdlcBlock: SdlcBlock = {
    enabled: true,
    current_phase: 'architect',
    auto_advance: true,
    phases: Object.fromEntries(
      PHASE_ORDER.map((phase) => [
        phase,
        { status: 'pending' as SdlcPhaseStatus, agent: PHASE_AGENTS[phase], output: PHASE_OUTPUTS[phase] },
      ])
    ) as Record<SdlcPhase, SdlcPhaseData>,
  };

  meta.sdlc = sdlcBlock;
  writeMeta(trackDir, meta);

  const phasesDir = path.join(trackDir, 'phases');
  if (!fs.existsSync(phasesDir)) {
    fs.mkdirSync(phasesDir, { recursive: true });
  }

  logInfo('sdlcPipeline', `SDLC initialised for track: ${trackId}`);
  sdlcEvents.emit('sdlc:phase:start', { trackId, phase: 'architect' as SdlcPhase });
}

/** Returns the current SDLC status for a track. */
export function getStatus(trackId: string, trackDir: string): SdlcStatus {
  const meta = readMeta(trackDir);
  if (!meta.sdlc) {
    return {
      enabled: false,
      currentPhase: 'architect',
      phases: Object.fromEntries(PHASE_ORDER.map((p) => [p, 'pending'])) as Record<SdlcPhase, SdlcPhaseStatus>,
      complete: false,
    };
  }
  const { sdlc } = meta;
  return {
    enabled: sdlc.enabled,
    currentPhase: sdlc.current_phase,
    phases: Object.fromEntries(PHASE_ORDER.map((p) => [p, sdlc.phases[p].status])) as Record<SdlcPhase, SdlcPhaseStatus>,
    complete: PHASE_ORDER.every((p) => sdlc.phases[p].status === 'completed'),
  };
}

/** Runs a specific phase using AgentManager.executeWithRecovery(). */
export async function runPhase(trackId: string, trackDir: string, phase: SdlcPhase): Promise<void> {
  const meta = readMeta(trackDir);
  if (!meta.sdlc || !meta.sdlc.enabled) return;

  meta.sdlc.phases[phase].status = 'running';
  meta.sdlc.current_phase = phase;
  writeMeta(trackDir, meta);
  sdlcEvents.emit('sdlc:phase:start', { trackId, phase });
  logInfo('sdlcPipeline', `SDLC phase running: ${phase} — ${trackId}`);

  try {
    const { agentManager } = await import('../agents/AgentManager.js');
    const agentName = TS_PHASE_AGENTS[phase];
    const instruction = `SDLC ${phase} phase for track ${trackId}. Write output to ${PHASE_OUTPUTS[phase]}.`;
    await agentManager.executeWithRecovery(agentName, instruction, { trackId, trackDir, phase });

    // Ensure output file exists (agent may not have written it)
    const outputPath = path.join(trackDir, PHASE_OUTPUTS[phase]);
    if (!fs.existsSync(outputPath)) {
      const phasesDir = path.dirname(outputPath);
      if (!fs.existsSync(phasesDir)) fs.mkdirSync(phasesDir, { recursive: true });
      fs.writeFileSync(outputPath, `# ${phase} phase\n\nCompleted by ${agentName}\n`, 'utf-8');
    }

    const updated = readMeta(trackDir);
    if (updated.sdlc) {
      updated.sdlc.phases[phase].status = 'completed';
      updated.sdlc.phases[phase].completedAt = new Date().toISOString();
      writeMeta(trackDir, updated);
    }

    sdlcEvents.emit('sdlc:phase:complete', { trackId, phase });
    logInfo('sdlcPipeline', `SDLC phase complete: ${phase} — ${trackId}`);
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    const updated = readMeta(trackDir);
    if (updated.sdlc) {
      updated.sdlc.phases[phase].status = 'failed';
      updated.sdlc.phases[phase].error = error;
      writeMeta(trackDir, updated);
    }
    logError('sdlcPipeline', `SDLC phase failed: ${phase} — ${error}`);
    throw e;
  }
}

/**
 * Advances to the next pending phase (called automatically when auto_advance is true).
 * Emits `sdlc:complete` when all phases are done and sets track status to "testing".
 */
export async function advance(trackId: string, trackDir: string): Promise<void> {
  const meta = readMeta(trackDir);
  if (!meta.sdlc || !meta.sdlc.enabled) return;

  const nextPhase = PHASE_ORDER.find((p) => meta.sdlc!.phases[p].status === 'pending');
  if (!nextPhase) {
    sdlcEvents.emit('sdlc:complete', { trackId });
    // Update track status to "testing"
    const finished = readMeta(trackDir);
    finished.status = 'testing';
    writeMeta(trackDir, finished);
    logInfo('sdlcPipeline', `SDLC pipeline complete — track ${trackId} → testing`);
    return;
  }

  await runPhase(trackId, trackDir, nextPhase);

  // Re-read after runPhase to check auto_advance
  const after = readMeta(trackDir);
  if (after.sdlc?.auto_advance) {
    await advance(trackId, trackDir);
  }
}

/** Resets all phases to pending (useful for re-running). */
export async function reset(trackId: string, trackDir: string): Promise<void> {
  const meta = readMeta(trackDir);
  if (!meta.sdlc) return;
  PHASE_ORDER.forEach((p) => {
    if (meta.sdlc) {
      meta.sdlc.phases[p].status = 'pending';
      delete meta.sdlc.phases[p].completedAt;
      delete meta.sdlc.phases[p].error;
    }
  });
  meta.sdlc.current_phase = 'architect';
  writeMeta(trackDir, meta);
  logInfo('sdlcPipeline', `SDLC reset for ${trackId}`);
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run build 2>&1 | grep -E "error|sdlcPipeline"
```
Expected: no errors mentioning `sdlcPipeline.ts`.

---

## Task 2: `test/sdlcPipeline.test.ts`

**Files:**
- Create: `test/sdlcPipeline.test.ts`

> Do this BEFORE Task 1 Step 2 to follow TDD: write the test, verify it fails, then implement.

- [ ] **Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('fs');
vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    executeWithRecovery: vi.fn().mockResolvedValue({ success: true }),
  },
}));
vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

const TRACK_ID = 'test-track-20260406';
const TRACK_DIR = '/conductor/tracks/test-track-20260406';
const META_PATH = `${TRACK_DIR}/meta.json`;

const baseMeta = () =>
  JSON.stringify({ id: TRACK_ID, status: 'active', progress: 0 });

const metaWithSdlc = (currentPhase = 'architect', phases: Record<string, string> = {}) =>
  JSON.stringify({
    id: TRACK_ID,
    status: 'active',
    progress: 0,
    sdlc: {
      enabled: true,
      current_phase: currentPhase,
      auto_advance: false,
      phases: {
        architect: { status: phases['architect'] ?? 'pending', agent: 'x', output: 'phases/1-architect.md' },
        devops:    { status: phases['devops']    ?? 'pending', agent: 'x', output: 'phases/2-devops.md' },
        coder:     { status: phases['coder']     ?? 'pending', agent: 'x', output: 'phases/3-coder.md' },
        qa:        { status: phases['qa']        ?? 'pending', agent: 'x', output: 'phases/4-qa.md' },
        reviewer:  { status: phases['reviewer']  ?? 'pending', agent: 'x', output: 'phases/5-reviewer.md' },
      },
    },
  });

describe('sdlcPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(baseMeta());
    (fs.writeFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.mkdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);
  });

  describe('init()', () => {
    it('writes sdlc block to meta.json', async () => {
      const { init } = await import('../src/core/sdlcPipeline.js');
      init(TRACK_ID, TRACK_DIR);

      const calls = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      const written = JSON.parse(calls[0][1] as string);
      expect(written.sdlc).toBeDefined();
      expect(written.sdlc.enabled).toBe(true);
      expect(written.sdlc.current_phase).toBe('architect');
      expect(written.sdlc.phases.architect.status).toBe('pending');
      expect(written.sdlc.phases.reviewer.status).toBe('pending');
    });

    it('creates phases/ directory', async () => {
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const { init } = await import('../src/core/sdlcPipeline.js');
      init(TRACK_ID, TRACK_DIR);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('phases'),
        expect.objectContaining({ recursive: true }),
      );
    });

    it('is idempotent when sdlc block already exists', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      const { init } = await import('../src/core/sdlcPipeline.js');
      init(TRACK_ID, TRACK_DIR);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('emits sdlc:phase:start with phase=architect', async () => {
      const { init, sdlcEvents } = await import('../src/core/sdlcPipeline.js');
      const spy = vi.fn();
      sdlcEvents.once('sdlc:phase:start', spy);
      init(TRACK_ID, TRACK_DIR);

      expect(spy).toHaveBeenCalledWith({ trackId: TRACK_ID, phase: 'architect' });
    });
  });

  describe('getStatus()', () => {
    it('returns disabled when no sdlc block', async () => {
      const { getStatus } = await import('../src/core/sdlcPipeline.js');
      const s = getStatus(TRACK_ID, TRACK_DIR);
      expect(s.enabled).toBe(false);
    });

    it('returns correct currentPhase and per-phase statuses', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        metaWithSdlc('devops', { architect: 'completed', devops: 'pending' }),
      );
      const { getStatus } = await import('../src/core/sdlcPipeline.js');
      const s = getStatus(TRACK_ID, TRACK_DIR);

      expect(s.enabled).toBe(true);
      expect(s.currentPhase).toBe('devops');
      expect(s.phases.architect).toBe('completed');
      expect(s.phases.devops).toBe('pending');
      expect(s.complete).toBe(false);
    });

    it('returns complete=true when all phases are completed', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        metaWithSdlc('reviewer', {
          architect: 'completed', devops: 'completed',
          coder: 'completed', qa: 'completed', reviewer: 'completed',
        }),
      );
      const { getStatus } = await import('../src/core/sdlcPipeline.js');
      const s = getStatus(TRACK_ID, TRACK_DIR);
      expect(s.complete).toBe(true);
    });
  });

  describe('reset()', () => {
    it('resets all phases to pending', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
        metaWithSdlc('qa', { architect: 'completed', devops: 'completed', coder: 'completed' }),
      );
      const { reset } = await import('../src/core/sdlcPipeline.js');
      await reset(TRACK_ID, TRACK_DIR);

      const written = JSON.parse(
        (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1] as string,
      );
      expect(written.sdlc.current_phase).toBe('architect');
      expect(written.sdlc.phases.architect.status).toBe('pending');
      expect(written.sdlc.phases.coder.status).toBe('pending');
    });

    it('does nothing when no sdlc block', async () => {
      const { reset } = await import('../src/core/sdlcPipeline.js');
      await reset(TRACK_ID, TRACK_DIR);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('runPhase()', () => {
    it('calls AgentManager.executeWithRecovery with correct agent', async () => {
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      const { runPhase } = await import('../src/core/sdlcPipeline.js');
      const { agentManager } = await import('../src/agents/AgentManager.js');

      await runPhase(TRACK_ID, TRACK_DIR, 'architect');

      expect(agentManager.executeWithRecovery).toHaveBeenCalledWith(
        'SpecWriterAgent',
        expect.stringContaining('architect'),
        expect.objectContaining({ trackId: TRACK_ID, phase: 'architect' }),
      );
    });

    it('marks phase completed in meta.json', async () => {
      // readFileSync is called multiple times: once for running, once for update
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(metaWithSdlc());
      const { runPhase } = await import('../src/core/sdlcPipeline.js');
      await runPhase(TRACK_ID, TRACK_DIR, 'coder');

      const writes = (fs.writeFileSync as ReturnType<typeof vi.fn>).mock.calls;
      // Last write to meta.json should have coder=completed
      const lastMetaWrite = writes
        .filter((c: unknown[]) => (c[0] as string).endsWith('meta.json'))
        .at(-1);
      expect(lastMetaWrite).toBeDefined();
      const written = JSON.parse(lastMetaWrite![1] as string);
      expect(written.sdlc.phases.coder.status).toBe('completed');
    });
  });
});
```

- [ ] **Step 2: Run — expect failures (module not yet implemented)**

```bash
npx vitest run test/sdlcPipeline.test.ts
```
Expected: multiple failures like "Cannot find module '../src/core/sdlcPipeline.js'".

- [ ] **Step 3: Implement Task 1 Step 2 (write `sdlcPipeline.ts`)**

- [ ] **Step 4: Run tests again — expect green**

```bash
npx vitest run test/sdlcPipeline.test.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/sdlcPipeline.ts test/sdlcPipeline.test.ts
git commit -m "feat(core): SDLC pipeline module with init/advance/runPhase/getStatus/reset"
```

---

## Task 3: `src/agents/ProjectConductorAgent.ts` — createTrack hook

**Files:**
- Modify: `src/agents/ProjectConductorAgent.ts` (lines 435–440)

- [ ] **Step 1: Add the import at the top of the file**

Find the last `import` statement in `src/agents/ProjectConductorAgent.ts` and add after it:

```typescript
import * as sdlcPipeline from '../core/sdlcPipeline.js';
```

- [ ] **Step 2: Add the `sdlcPipeline.init()` call inside `createTrack()`**

Find the block (currently lines 435–444):
```typescript
    this.saveState();

    // tracks.md frissítése
    await this.updateTracksFile();

    return {
      success: true,
```

Replace with:
```typescript
    this.saveState();
    sdlcPipeline.init(trackId, trackDir);

    // tracks.md frissítése
    await this.updateTracksFile();

    return {
      success: true,
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | grep -E "error"
```
Expected: 0 TypeScript errors.

- [ ] **Step 4: Run fast tests**

```bash
npm run test:fast
```
Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/agents/ProjectConductorAgent.ts
git commit -m "feat(conductor): call sdlcPipeline.init() on new track creation"
```

---

## Task 4: Add `sdlc_phase:` frontmatter to 5 `.github/agents/` files

**Files:**
- Modify: `.github/agents/bas-mcp-architect.agent.md`
- Modify: `.github/agents/devops-infra-guardian.agent.md`
- Modify: `.github/agents/bas-lead-developer.agent.md`
- Modify: `.github/agents/robust-test-writer.agent.md`
- Modify: `.github/agents/bas-phoenix-reviewer.agent.md`

Each file has YAML frontmatter like:
```yaml
---
description: "..."
name: bas-mcp-architect
---
```

- [ ] **Step 1: Update `bas-mcp-architect.agent.md`**

Change the frontmatter from:
```yaml
---
description: "..."
name: bas-mcp-architect
---
```
To:
```yaml
---
description: "..."
name: bas-mcp-architect
sdlc_phase: architect
sdlc_output: phases/1-architect.md
sdlc_superpowers:
  - superpowers:writing-plans
---
```

- [ ] **Step 2: Update `devops-infra-guardian.agent.md`**

Add to frontmatter:
```yaml
sdlc_phase: devops
sdlc_output: phases/2-devops.md
```
(no sdlc_superpowers for devops phase)

- [ ] **Step 3: Update `bas-lead-developer.agent.md`**

Add to frontmatter:
```yaml
sdlc_phase: coder
sdlc_output: phases/3-coder.md
sdlc_superpowers:
  - superpowers:test-driven-development
```

- [ ] **Step 4: Update `robust-test-writer.agent.md`**

Add to frontmatter:
```yaml
sdlc_phase: qa
sdlc_output: phases/4-qa.md
sdlc_superpowers:
  - superpowers:systematic-debugging
```

- [ ] **Step 5: Update `bas-phoenix-reviewer.agent.md`**

Add to frontmatter:
```yaml
sdlc_phase: reviewer
sdlc_output: phases/5-reviewer.md
sdlc_superpowers:
  - superpowers:requesting-code-review
  - superpowers:verification-before-completion
```

- [ ] **Step 6: Commit**

```bash
git add .github/agents/bas-mcp-architect.agent.md \
        .github/agents/devops-infra-guardian.agent.md \
        .github/agents/bas-lead-developer.agent.md \
        .github/agents/robust-test-writer.agent.md \
        .github/agents/bas-phoenix-reviewer.agent.md
git commit -m "feat(agents): add sdlc_phase frontmatter to 5 existing .github/agents/ files"
```

---

## Task 5: `.github/agents/sdlc-pipeline.agent.md`

**Files:**
- Create: `.github/agents/sdlc-pipeline.agent.md`

- [ ] **Step 1: Create the orchestrator agent file**

```markdown
---
description: "Use this agent to orchestrate the 5-phase SDLC pipeline for a conductor track. Invoke with @sdlc-pipeline /start <trackId> to begin, /status <trackId> to check progress, or /phase <phase> <trackId> to run a specific phase. Always invokes the relevant superpowers skill before each phase."
name: sdlc-pipeline
sdlc_orchestrator: true
---

# SDLC Pipeline Orchestrator

You are the SDLC Pipeline orchestrator for the Brunella Agent System. You coordinate 5 sequential phases for conductor tracks.

## Available Commands

- `/start <trackId>` — Run all 5 phases in order (auto-advance)
- `/status <trackId>` — Show current phase and status of each phase
- `/phase <phaseName> <trackId>` — Run a single specific phase
- `/reset <trackId>` — Reset all phases to pending

## Phase–Agent Mapping

| # | Phase | Agent | Superpowers skill |
|---|-------|-------|-------------------|
| 1 | architect | `@bas-mcp-architect` | `superpowers:writing-plans` |
| 2 | devops | `@devops-infra-guardian` | — |
| 3 | coder | `@bas-lead-developer` | `superpowers:test-driven-development` |
| 4 | qa | `@robust-test-writer` | `superpowers:systematic-debugging` |
| 5 | reviewer | `@bas-phoenix-reviewer` | `superpowers:requesting-code-review` + `superpowers:verification-before-completion` |

## MANDATORY RULE

Before executing each phase, you MUST invoke the corresponding superpowers skill listed above. You cannot proceed to phase implementation without first loading the skill.

## Track file structure

Each phase writes its output to `conductor/tracks/<trackId>/phases/<N>-<phase>.md`.

## Workflow

1. Read `conductor/tracks/<trackId>/meta.json` — check `sdlc.current_phase` and phase statuses.
2. For each pending phase (in order): invoke superpowers skill → delegate to the phase agent → write output file → mark phase completed.
3. When all 5 phases complete: set track status to `testing` and notify the user.

## Reading meta.json SDLC block

```json
{
  "sdlc": {
    "enabled": true,
    "current_phase": "architect",
    "auto_advance": true,
    "phases": {
      "architect": { "status": "pending", "output": "phases/1-architect.md" },
      "devops":    { "status": "pending", "output": "phases/2-devops.md" },
      "coder":     { "status": "pending", "output": "phases/3-coder.md" },
      "qa":        { "status": "pending", "output": "phases/4-qa.md" },
      "reviewer":  { "status": "pending", "output": "phases/5-reviewer.md" }
    }
  }
}
```

Status values: `pending` | `running` | `completed` | `failed`.
```

- [ ] **Step 2: Commit**

```bash
git add .github/agents/sdlc-pipeline.agent.md
git commit -m "feat(agents): add sdlc-pipeline.agent.md Copilot orchestrator"
```

---

## Task 6: `src/cli/sdlcCommands.ts` + `src/cli.ts` registration

**Files:**
- Create: `src/cli/sdlcCommands.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Create `src/cli/sdlcCommands.ts`**

```typescript
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';
import * as sdlcPipeline from '../core/sdlcPipeline.js';

const CONDUCTOR_PATH = path.join(process.cwd(), 'conductor');

function resolveTrackDir(trackId: string): string {
  return path.join(CONDUCTOR_PATH, 'tracks', trackId);
}

function requireTrackDir(trackId: string): string {
  const dir = resolveTrackDir(trackId);
  if (!fs.existsSync(dir)) {
    console.error(chalk.red(`❌ Track nem található: ${trackId}`));
    process.exit(1);
  }
  return dir;
}

export function registerSdlcCommands(program: Command): void {
  const sdlc = program
    .command('sdlc')
    .description('SDLC pipeline parancsok');

  // brunella sdlc status <trackId>
  sdlc
    .command('status <trackId>')
    .description('SDLC fázisok állapotának megjelenítése')
    .action((trackId: string) => {
      const trackDir = requireTrackDir(trackId);
      const status = sdlcPipeline.getStatus(trackId, trackDir);

      if (!status.enabled) {
        console.log(chalk.yellow('⚠️  Az SDLC pipeline nincs engedélyezve erre a track-re.'));
        return;
      }

      console.log(chalk.bold(`\n🔄 SDLC Státusz — ${trackId}`));
      console.log(chalk.gray(`Jelenlegi fázis: ${chalk.cyan(status.currentPhase)}\n`));

      const phaseIcons: Record<string, string> = {
        pending: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌',
      };

      sdlcPipeline.PHASE_ORDER.forEach((phase) => {
        const phaseStatus = status.phases[phase];
        const icon = phaseIcons[phaseStatus] ?? '?';
        console.log(`  ${icon} ${chalk.white(phase.padEnd(12))} ${chalk.gray(phaseStatus)}`);
      });

      if (status.complete) {
        console.log(chalk.green('\n🎉 Pipeline kész! Track átállítva: testing'));
      }
      console.log();
    });

  // brunella sdlc run <trackId>
  sdlc
    .command('run <trackId>')
    .description('Teljes SDLC pipeline futtatása (minden fázis sorban)')
    .action(async (trackId: string) => {
      const trackDir = requireTrackDir(trackId);
      const spinner = ora(`SDLC pipeline indítása: ${trackId}...`).start();

      try {
        await sdlcPipeline.advance(trackId, trackDir);
        spinner.succeed(chalk.green(`SDLC pipeline kész: ${trackId}`));
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        spinner.fail(chalk.red(`SDLC pipeline hiba: ${error}`));
        process.exit(1);
      }
    });

  // brunella sdlc phase <trackId> <phase>
  sdlc
    .command('phase <trackId> <phase>')
    .description('Egy adott SDLC fázis futtatása (architect|devops|coder|qa|reviewer)')
    .action(async (trackId: string, phase: string) => {
      const validPhases = sdlcPipeline.PHASE_ORDER as readonly string[];
      if (!validPhases.includes(phase)) {
        console.error(chalk.red(`❌ Érvénytelen fázis: ${phase}`));
        console.error(chalk.gray(`Érvényes fázisok: ${validPhases.join(', ')}`));
        process.exit(1);
      }

      const trackDir = requireTrackDir(trackId);
      const spinner = ora(`${phase} fázis futtatása...`).start();

      try {
        await sdlcPipeline.runPhase(trackId, trackDir, phase as sdlcPipeline.SdlcPhase);
        spinner.succeed(chalk.green(`${phase} fázis kész`));
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        spinner.fail(chalk.red(`${phase} fázis hiba: ${error}`));
        process.exit(1);
      }
    });

  // brunella sdlc reset <trackId>
  sdlc
    .command('reset <trackId>')
    .description('SDLC fázisok visszaállítása (minden fázis: pending)')
    .action(async (trackId: string) => {
      const trackDir = requireTrackDir(trackId);
      await sdlcPipeline.reset(trackId, trackDir);
      console.log(chalk.green(`✅ SDLC visszaállítva: ${trackId}`));
    });
}
```

- [ ] **Step 2: Register in `src/cli.ts`**

Find the last `import { register...Commands }` block in `src/cli.ts` (around line 60) and add:

```typescript
import { registerSdlcCommands } from './cli/sdlcCommands.js';
```

Then find where other `registerXxxCommands(program)` calls are made in `src/cli.ts` and add:

```typescript
registerSdlcCommands(program);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build 2>&1 | grep -E "error"
```
Expected: 0 errors.

- [ ] **Step 4: Smoke test**

```bash
node build/cli.js sdlc --help
```
Expected: shows `status`, `run`, `phase`, `reset` subcommands.

- [ ] **Step 5: Commit**

```bash
git add src/cli/sdlcCommands.ts src/cli.ts
git commit -m "feat(cli): add brunella sdlc status/run/phase/reset commands"
```

---

## Task 7: `.github/copilot-instructions.md` — 3 additive changes

**Files:**
- Modify: `.github/copilot-instructions.md`

> **Important:** All existing content must remain intact. Only add new content.

- [ ] **Step 1: Add `## SDLC Pipeline` section after `## Session bootstrap`**

Find the line `## Build, test, and lint` and insert the following block BEFORE it (i.e., between `## Session bootstrap` and `## Build, test, and lint`):

```markdown
## SDLC Pipeline

Every new conductor track automatically receives a 5-phase SDLC pipeline block in `meta.json` (`sdlc.enabled: true`). Use `@sdlc-pipeline` in Copilot Chat to interact:

```
@sdlc-pipeline /start <trackId>      # Run all phases
@sdlc-pipeline /status <trackId>     # Check phase statuses
@sdlc-pipeline /phase architect <trackId>  # Run one phase
```

Phase order: **architect → devops → coder → qa → reviewer**. The `@sdlc-pipeline` agent always invokes the relevant superpowers skill before each phase. From the CLI: `brunella sdlc status|run|phase|reset <trackId>`.

```

- [ ] **Step 2: Add 6 rows to the agent routing table in `## Custom Copilot agents`**

Find the table in the `## Custom Copilot agents` section (ends around `| strict-code-reviewer | ...`). Add the following rows at the bottom of the table:

```markdown
| `sdlc-pipeline` | Orchestrates all 5 SDLC phases; reads/writes `meta.json` sdlc block |
| `bas-mcp-architect` *(sdlc: architect)* | SDLC phase 1 — pseudocode, data model, interfaces, flow diagram |
| `devops-infra-guardian` *(sdlc: devops)* | SDLC phase 2 — deps check, env validation, build result |
| `bas-lead-developer` *(sdlc: coder)* | SDLC phase 3 — implementation summary, affected files |
| `robust-test-writer` *(sdlc: qa)* | SDLC phase 4 — test results, bugs, performance |
| `bas-phoenix-reviewer` *(sdlc: reviewer)* | SDLC phase 5 — refactor proposals, EPP v2 report, final docs |
```

- [ ] **Step 3: Add 1 paragraph to `## Key repository conventions`**

Find the end of the `## Key repository conventions` section (just before `## Known pitfalls`) and add:

```markdown
- **SDLC pipeline is automatic for new tracks.** When `ProjectConductorAgent.createTrack()` creates a new track, `sdlcPipeline.init()` writes an `sdlc` block into `meta.json` with `enabled: true`. Use `@sdlc-pipeline` in Copilot Chat or `brunella sdlc` on the CLI to drive phases. Existing tracks without an `sdlc` block are unaffected (backward-compatible).
```

- [ ] **Step 4: Verify no existing content was removed**

```bash
# The line count should only increase, never decrease
git diff --stat .github/copilot-instructions.md
```
Expected: only additions (`+` lines), no deletions (`-` lines) except empty lines at most.

- [ ] **Step 5: Commit**

```bash
git add .github/copilot-instructions.md
git commit -m "feat(docs): add SDLC pipeline section to copilot-instructions.md (additive)"
```

---

## Final verification

- [ ] **Build clean**

```bash
npm run build 2>&1 | tail -5
```
Expected: `0 errors`.

- [ ] **Full test suite**

```bash
npm run test:fast
```
Expected: all tests pass including `test/sdlcPipeline.test.ts`.

- [ ] **CLI smoke**

```bash
# Requires a real track in conductor/tracks/
node build/cli.js sdlc status brunella_identity_project_maintainer_20260402
```
Expected: shows phase statuses (or "SDLC nincs engedélyezve" for old tracks without sdlc block).

- [ ] **Final commit and push**

```bash
git push origin feature/kkv-crm-skeleton-20260404
```

---

## Self-review

**Spec coverage:**
- ✅ Auto-trigger on track creation → Task 3
- ✅ 5-phase order (architect→devops→coder→qa→reviewer) → Task 1
- ✅ sdlc block in meta.json → Task 1 (`init()`)
- ✅ phases/ output files → Task 1 (`runPhase()`)
- ✅ Copilot CLI + VS Code Insiders availability → Tasks 4, 5
- ✅ `@sdlc-pipeline /start|/status|/phase` → Task 5
- ✅ superpowers skill per phase (frontmatter) → Task 4
- ✅ `brunella sdlc status/run/phase/reset` → Task 6
- ✅ 3 additive copilot-instructions.md changes → Task 7
- ✅ Existing `.github/agents/` content untouched → Tasks 4, 5 (only frontmatter added)
- ✅ `npm run build` and `npm run test:fast` green → Tasks 2, 3, 6

**Placeholder scan:** No TBD, TODO, or vague steps — all code blocks are complete.

**Type consistency:**
- `SdlcPhase` defined in Task 1, imported in Tasks 3 and 6 via `'../core/sdlcPipeline.js'`
- `PHASE_ORDER` exported from Task 1, used in Task 6 for validation
- `agentManager.executeWithRecovery(agentName, instruction, context)` — matches `AgentManager.ts:1159` signature
