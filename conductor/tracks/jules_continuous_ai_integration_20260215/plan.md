# Jules Continuous AI - Detailed Plan

## PHASE 1: Suggested Tasks Scanner (Day 1-2)

### PHASE 1A: Code Scanner (Day 1 Morning)

- [ ] **1.1** Create `src/core/suggestedTasksScanner.ts`
  - [ ] Parse TODO/FIXME comments
  - [ ] Extract context (file, line, surrounding code)
  - [ ] Calculate confidence score (trust %)
  - [ ] Return structured TaskSuggestion array

- [ ] **1.2** Create database schema for suggested_tasks
  ```sql
  CREATE TABLE suggested_tasks (
    id INTEGER PRIMARY KEY,
    file_path TEXT,
    line_number INTEGER,
    todo_text TEXT,
    context TEXT,
    confidence_score REAL,
    status TEXT,        -- pending, in_progress, completed
    created_at DATETIME,
    updated_at DATETIME
  )
  ```

- [ ] **1.3** Test scanner
  - `npm test -- src/core/suggestedTasksScanner.test.ts`
  - Expect: ≥40 TODOs found

### PHASE 1B: API Endpoints (Day 1 Afternoon)

- [ ] **1.4** Create `src/server/routes/suggestedTasks.ts`
  - [ ] GET `/api/v1/suggested-tasks` - list all
  - [ ] GET `/api/v1/suggested-tasks?status=pending` - filter
  - [ ] POST `/api/v1/suggested-tasks/:id/assign` - assign to profile
  - [ ] PATCH `/api/v1/suggested-tasks/:id` - update status
  - [ ] POST `/api/v1/suggested-tasks/scan` - force rescan

- [ ] **1.5** Register routes in `src/server/web.ts`
  ```typescript
  import { createSuggestedTasksRoutes } from './routes/suggestedTasks.js';
  app.use('/api/v1/suggested-tasks', createSuggestedTasksRoutes());
  ```

- [ ] **1.6** Test endpoints with curl/Postman
  ```bash
  curl http://localhost:3000/api/v1/suggested-tasks
  ```

### PHASE 1C: Dashboard Widget (Day 2)

- [ ] **1.7** Create `src/dashboard/components/dashboard/SuggestedTasksPanel.tsx`
  - [ ] Display task list (file, line, text, confidence)
  - [ ] Filter by status (pending, in_progress, completed)
  - [ ] Sort by confidence score
  - [ ] Click → assign to track
  - [ ] Progress bar (N/M completed)

- [ ] **1.8** Integrate into Dashboard
  - [ ] Add tab to MissionControlLayout.tsx
  - [ ] Wire API calls
  - [ ] Auto-refresh (30s)

- [ ] **1.9** Test in browser
  - `npm run dev:ui`
  - Check dashboard loads tasks
  - Click tasks → assign

### PHASE 1D: CLI Command (Day 2)

- [ ] **1.10** Add CLI command `brunella tasks suggest`
  - [ ] `brunella tasks suggest` - list all
  - [ ] `brunella tasks suggest --scan` - force rescan
  - [ ] `brunella tasks suggest --status pending` - filter
  - [ ] Output: table format (file | line | text | confidence)

---

## PHASE 2: Scheduled Tasks Engine (Day 3-4)

### PHASE 2A: Database & Service (Day 3)

- [ ] **2.1** Create database schema for scheduled_tasks
  ```sql
  CREATE TABLE scheduled_tasks (
    id INTEGER PRIMARY KEY,
    title TEXT,
    prompt TEXT,
    cron_expression TEXT,      -- "0 2 * * *" = 2 AM daily
    handler TEXT,              -- test|build|lint|scan|custom
    enabled BOOLEAN,
    last_run_at DATETIME,
    next_run_at DATETIME,
    last_status TEXT,          -- success|failed|pending
    last_result TEXT,          -- JSON output
    created_at DATETIME,
    updated_at DATETIME
  )
  ```

- [ ] **2.2** Create `src/core/scheduledTasksService.ts`
  - [ ] CRUD operations (create, read, update, delete)
  - [ ] Calculate next run time (cron logic)
  - [ ] Store results

- [ ] **2.3** Create `src/server/schedulers/scheduledTasksRunner.ts`
  - [ ] Initialize node-schedule (or implement cron)
  - [ ] Load all enabled tasks from DB
  - [ ] Schedule each with cron expression
  - [ ] Execute handler (test/build/lint/etc)
  - [ ] Store result in DB
  - [ ] Send notification (email/Slack)
  - [ ] Auto-restart on app startup

- [ ] **2.4** Test scheduler
  - Create task: "Test every 1 minute" (for testing)
  - Check runs in DB
  - Verify notifications

### PHASE 2B: API Endpoints (Day 3-4)

- [ ] **2.5** Create `src/server/routes/scheduledTasks.ts`
  - [ ] GET `/api/v1/scheduled-tasks` - list all
  - [ ] POST `/api/v1/scheduled-tasks` - create
  - [ ] PATCH `/api/v1/scheduled-tasks/:id` - update
  - [ ] DELETE `/api/v1/scheduled-tasks/:id` - remove
  - [ ] POST `/api/v1/scheduled-tasks/:id/run` - manual trigger
  - [ ] GET `/api/v1/scheduled-tasks/:id/results` - view results

- [ ] **2.6** Register routes in web.ts

- [ ] **2.7** Test endpoints
  - Create task via API
  - Manual trigger
  - Check results

### PHASE 2C: Dashboard Widget (Day 4)

- [ ] **2.8** Create `src/dashboard/components/dashboard/ScheduledTasksPanel.tsx`
  - [ ] List scheduled tasks (title, cron, enabled, last_run, status)
  - [ ] Create new task form (title, cron expression picker, handler)
  - [ ] Enable/disable toggle
  - [ ] Manual trigger button
  - [ ] Results history (last 10 runs)

- [ ] **2.9** Integrate into Dashboard
  - [ ] Add tab to MissionControlLayout.tsx

- [ ] **2.10** Test in browser

### PHASE 2D: CLI Commands (Day 4)

- [ ] **2.11** Add CLI commands
  - [ ] `brunella schedule list` - list all
  - [ ] `brunella schedule add` - interactive prompt
  - [ ] `brunella schedule remove <id>` - delete
  - [ ] `brunella schedule run <id>` - manual trigger
  - [ ] `brunella schedule results <id>` - view results

---

## PHASE 3: GitHub Deploy Integration (Day 5-6)

### PHASE 3A: Webhook Handler (Day 5)

- [ ] **3.1** Create `src/server/routes/githubWebhook.ts`
  - [ ] POST `/api/github/webhook` - webhook endpoint
  - [ ] Verify GitHub signature (HMAC-SHA256)
  - [ ] Handle events:
    - `workflow_run` (failed)
    - `pull_request` (opened)
  - [ ] Extract error logs from failed workflow

- [ ] **3.2** Create `src/tools/deploymentAnalyzer.ts`
  - [ ] Parse GitHub workflow error logs
  - [ ] Identify error type (build, test, lint, deploy)
  - [ ] Extract relevant code section
  - [ ] Generate fix prompt for Jules

- [ ] **3.3** GitHub Setup
  - [ ] Create webhook in GitHub repo settings
  - [ ] URL: `https://your-domain/api/github/webhook`
  - [ ] Events: workflow_run, pull_request
  - [ ] Secret: env var GITHUB_WEBHOOK_SECRET

- [ ] **3.4** Test webhook
  - [ ] Trigger workflow (make it fail intentionally)
  - [ ] Check webhook fires in logs
  - [ ] Verify error analysis

### PHASE 3B: Jules Integration (Day 5-6)

- [ ] **3.5** Create `scripts/deploy_fixer_prompt.md`
  - [ ] Template prompt for Jules
  - [ ] Include: error logs, file context, fix expectations

- [ ] **3.6** Implement auto-fix flow
  - [ ] Webhook receives error
  - [ ] Analysis → prompt generation
  - [ ] Send to Jules via Python wrapper
  - [ ] Jules creates PR with fix

- [ ] **3.7** Git operations
  - [ ] Create branch: `fix/gh-workflow-error-<timestamp>`
  - [ ] Commit changes
  - [ ] Push + open PR
  - [ ] Monitor PR status

- [ ] **3.8** Notification
  - [ ] Slack: "Build failed, Jules analyzing..."
  - [ ] Slack: "Fix committed, rerunning..."
  - [ ] Slack: "✅ Fixed and merged!"

### PHASE 3C: Auto-Merge Logic (Day 6)

- [ ] **3.9** Implement auto-merge (if fix passes)
  - [ ] Wait for all checks to pass
  - [ ] Auto-merge with "squash" strategy
  - [ ] Delete fix branch

- [ ] **3.10** Fallback: Manual review
  - [ ] If confidence <70%, require manual review
  - [ ] Create issue: "Jules fix needs review"
  - [ ] Tag maintainers

---

## PHASE 4: Integration & Testing (Day 7)

### PHASE 4A: End-to-End Testing

- [ ] **4.1** Create `test/jcai_integration.test.ts`
  - [ ] Test suggested tasks flow
  - [ ] Test scheduled tasks execution
  - [ ] Test GitHub webhook + fix
  - [ ] Expect: all flows complete <5s

- [ ] **4.2** Integration test
  - [ ] Run all 3 components together
  - [ ] Verify data flows correctly
  - [ ] Check dashboard updates in real-time

### PHASE 4B: Documentation

- [ ] **4.3** Update README.md
  - [ ] Add section: "Jules Continuous AI"
  - [ ] Explain all 3 features
  - [ ] Examples for CLI commands

- [ ] **4.4** Update CLAUDE.md
  - [ ] Add "Jules JCAI Integration" section
  - [ ] Quick start guide

### PHASE 4C: Final Checks

- [ ] **4.5** Run full validation
  - [ ] `npm run build` - 0 errors
  - [ ] `npm test` - ≥539+ pass
  - [ ] `npm run lint` - 0 errors

- [ ] **4.6** Manual testing
  - [ ] Dashboard loads all tabs
  - [ ] CLI commands work
  - [ ] GitHub webhook fires correctly

### PHASE 4D: Track Completion

- [ ] **4.7** Update track metadata
  - [ ] Status: `completed`
  - [ ] Progress: 100%
  - [ ] Date completed: 2026-02-22

- [ ] **4.8** Final commit & push
  - [ ] `git add -A`
  - [ ] `git commit -m "feat(jcai): Full Jules Continuous AI integration"`
  - [ ] `git push origin/main`

---

## 🎯 DAILY CHECKLIST

**Day 1 (Phase 1A + 1B):**
- [ ] Scanner implemented
- [ ] API endpoints tested
- [ ] ≥40 TODOs detected

**Day 2 (Phase 1C + 1D):**
- [ ] Dashboard widget working
- [ ] CLI command operational

**Day 3 (Phase 2A + 2B):**
- [ ] Scheduler engine running
- [ ] API endpoints working

**Day 4 (Phase 2C + 2D):**
- [ ] Dashboard scheduled tasks widget
- [ ] CLI schedule commands

**Day 5 (Phase 3A + 3B):**
- [ ] GitHub webhook configured
- [ ] Jules integration initiated

**Day 6 (Phase 3C):**
- [ ] Auto-merge logic implemented

**Day 7 (Phase 4):**
- [ ] All tests green
- [ ] Documentation updated
- [ ] Track marked completed

---

## 🚨 BLOCKERS / RISKS

- **GitHub webhook:** Requires public URL (ngrok for local testing)
- **Jules integration:** Requires Jules API access (already set up)
- **Scheduling:** node-schedule may conflict with Local Test Scheduler
- **Database:** SQLite locks if 2+ processes access simultaneously

## RISK MITIGATION

- Use separate DB for scheduled tasks (or transactions)
- Test webhook locally with ngrok
- Stagger scheduler intervals

---

**Status:** `pending_approval`  
**Author:** Copilot  
**Created:** 2026-02-15
