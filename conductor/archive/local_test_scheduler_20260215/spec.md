# Track: Local Test Scheduler (Önálló Teszt Automatizáció)

**Dátum:** 2026-02-15

**Prioritás:** HIGH (CI/CD Independence)

**Status:** IMPLEMENTATION IN PROGRESS

## 🎯 Célkitűzés

A Jules Async Tests GitHub Actions workflow-ot kiegészíteni egy lokális, Node.js-alapú test scheduler-rel, amely:
1. **Automatikusan futtatja a testeket** cron ütemezésen (napi/heti/havi)
2. **Tárolja az eredményeket** SQLite auditLog-ban vagy JSON fájlban
3. **Expozálja az eredményeket** REST API-n keresztül
4. **Integrálódik a Dashboard-val** TestResults widget-tel
5. **Biztosít CLI parancsokat** (`brunella tests ...`)
6. **Nem függ GitHub Actions-tól** - teljes autonomia

## 🛠️ Érintett Fájlok

### Kódbase

- `src/server/schedulers/testRunner.ts` (Node-cron scheduler logic)
- `src/server/routes/testScheduler.ts` (REST API endpoints)
- `src/tools/testSchedulerTool.ts` (MCP tool registration)
- `src/dashboard/components/dashboard/TestResultsWidget.tsx` (Dashboard widget)
- `src/cli.ts` (CLI commands: `brunella tests ...`)
- `schema.sql` (testRuns table definition)

### Configuration

- `.env` variables: `TEST_SCHEDULE` (cron expression), `TEST_LOG_DB` (optional override)

## 📅 Megvalósítási Terv (Phases)

### Phase 1: Database Schema ("A Múlt Rögzítése")

Kiterjesztés a `schema.sql`-ben:

```sql
CREATE TABLE testRuns (
    id TEXT PRIMARY KEY,
    scheduledTime TEXT NOT NULL,
    startedAt TEXT NOT NULL,
    endedAt TEXT,
    status TEXT DEFAULT 'running',  -- running, completed, failed
    totalTests INTEGER,
    passed INTEGER,
    failed INTEGER,
    skipped INTEGER,
    duration INTEGER,  -- milliseconds
    output TEXT,  -- captured test output
    errorLog TEXT,
    hostname TEXT DEFAULT 'local',
    triggerType TEXT DEFAULT 'scheduled',  -- scheduled, manual, api
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_testRuns_status ON testRuns(status);
CREATE INDEX idx_testRuns_createdAt ON testRuns(created_at);
```

### Phase 2: Test Runner Core ("Az Izomzat")

Implementáció: `src/server/schedulers/testRunner.ts`

```typescript
import cron from 'node-cron';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger.js';
import { saveTestRun } from '../core/testResultsService.js';

export interface TestRunConfig {
  schedule: string;  // cron expression
  enabled: boolean;
  triggerType: 'scheduled' | 'manual' | 'api';
}

export async function runTests(config: TestRunConfig): Promise<TestRun> {
  const runId = uuidv4();
  const startedAt = new Date();
  
  const run: TestRun = {
    id: runId,
    scheduledTime: startedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    status: 'running',
    triggerType: config.triggerType,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    output: '',
    errorLog: ''
  };

  try {
    logInfo('TestRunner', `Starting test run ${runId}...`);
    
    // Execute: npm test --run
    const { output, exitCode } = await executeTests();
    
    run.endedAt = new Date().toISOString();
    run.duration = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
    run.output = output;
    run.status = exitCode === 0 ? 'completed' : 'failed';
    
    // Parse vitest output for stats
    const stats = parseTestOutput(output);
    run.totalTests = stats.total;
    run.passed = stats.passed;
    run.failed = stats.failed;
    run.skipped = stats.skipped;
    
    await saveTestRun(run);
    logInfo('TestRunner', `Test run ${runId} completed. Status: ${run.status}`);
    
    return run;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    run.status = 'failed';
    run.errorLog = msg;
    run.endedAt = new Date().toISOString();
    run.duration = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
    await saveTestRun(run);
    logError('TestRunner', `Test run ${runId} failed: ${msg}`);
    return run;
  }
}

export function startScheduler() {
  const schedule = process.env.TEST_SCHEDULE || '0 2 * * *';  // 2 AM daily
  logInfo('TestScheduler', `Initializing test scheduler with cron: ${schedule}`);
  
  cron.schedule(schedule, async () => {
    logInfo('TestScheduler', 'Running scheduled test suite...');
    await runTests({ schedule, enabled: true, triggerType: 'scheduled' });
  });
  
  logInfo('TestScheduler', 'Test scheduler active');
}

async function executeTests(): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['test', '--run'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    proc.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });
    
    proc.stderr?.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ output, exitCode: code ?? 1 });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function parseTestOutput(output: string): { total: number; passed: number; failed: number; skipped: number } {
  // Parse vitest CLI output format
  const passedMatch = output.match(/✓.*?(\d+)/);
  const failedMatch = output.match(/×.*?(\d+)/);
  const skippedMatch = output.match(/⊙.*?(\d+)/);
  
  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
  
  return { total: passed + failed + skipped, passed, failed, skipped };
}
```

### Phase 3: Service Layer ("Az Tárlogató")

Implementáció: `src/core/testResultsService.ts`

- `saveTestRun()` - SQLite auditLog-ba írás
- `getTestRuns()` - List dengan paging
- `getTestRunById()` - Detail view
- `getTestStats()` - Aggregated stats (pass rate, trend)

### Phase 4: API Routes ("Az Interfész")

Implementáció: `src/server/routes/testScheduler.ts`

```
GET  /api/tests/schedule      - Current schedule config
POST /api/tests/schedule      - Update schedule (cron expression)
GET  /api/tests/results       - List test runs (paginated)
GET  /api/tests/results/:id   - Get specific test run
POST /api/tests/run           - Trigger manual test run
GET  /api/tests/stats         - Summary stats (7-day pass rate, etc.)
```

### Phase 5: MCP Tool ("Az Küls Csatorna")

Implementáció: `src/tools/testSchedulerTool.ts`

- Tool def: `test-scheduler-run`
- Tool def: `test-scheduler-status`

### Phase 6: Dashboard Widget ("Az Tükör")

Komponens: `src/dashboard/components/dashboard/TestResultsWidget.tsx`

Funkciók:
- Line chart: Pass rate trend (7 nap)
- Stats cards: Total runs, avg duration, latest status
- Recent runs table: Last 10 runs
- Manual trigger button
- Schedule config editor (CronGUI)

### Phase 7: CLI Integration ("Az Konzol")

Új parancsok a `src/cli.ts`-ben:

```
brunella tests status              - Current schedule & last run
brunella tests results [options]   - List recent test runs
brunella tests run                 - Trigger manual run
brunella tests schedule set        - Configure cron
```

### Phase 8: Validation & Testing ("Az Próba")

- Unit tests: `test/testRunner.test.ts`, `test/testResultsService.test.ts`
- Integration tests: Full cycle (schedule → execute → store → retrieve)
- Manual testing: Trigger via CLI, API, Dashboard

## ✅ Definition of Done

- [ ] `schema.sql` updated with testRuns table
- [ ] `testRunner.ts` implemented and tested
- [ ] `testResultsService.ts` saves/retrieves results
- [ ] `/api/tests/*` endpoints working
- [ ] MCP tool registered
- [ ] Dashboard widget renders
- [ ] CLI commands functional
- [ ] `npm test` passes (build + all test suites)
- [ ] GitHub Actions workflow can be **disabled** (not deleted)
- [ ] **0 failures** in local scheduler + Jules Async Tests
- [ ] Documentation updated (README.md, this track)

## 📊 Success Metrics

- ✅ Tests run on schedule without GitHub Actions
- ✅ Results persisted & retrievable (API + CLI + Dashboard)
- ✅ Pass rate tracking (7-day moving average)
- ✅ **No dependency on GitHub Actions** for test automation
- ✅ Manual triggering working

## 🎬 Implementation Order

1. ✅ Create track & spec (this file)
2. → Update schema.sql
3. → Implement testResultsService.ts
4. → Implement testRunner.ts
5. → Create /api/tests routes
6. → Register MCP tool
7. → Build Dashboard widget
8. → Add CLI commands
9. → Full test + build validation
10. → Documentation & commit

---

**Assignee:** Developer Agent / Claude Code
**Difficulty:** MEDIUM (Cron + API pattern exists, based on EV Hunter)
**Estimated Duration:** 4-6 hours
**Expected Commits:** 3-4
