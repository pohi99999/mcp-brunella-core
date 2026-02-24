# Specification: Dashboard V2 Robotkez Control (2026-02-08)

## 1. Overview
Deliver a multi-panel Dashboard V2 extension that adds Robotkez control, agent management, task queue monitoring, and LLM provider status tooling. The system must use real backend data only and provide real-time visibility via Socket.IO and SSE.

## 2. Scope and Phases
### Phase 1: Robotkez Control Panel
- Start/Stop browser sessions
- Live status, current URL, and screenshot preview
- Run L1/L2/L3 tests with real-time log streaming
- n8n workflow status summary

### Phase 2: Agent Management
- Registry display from src/agents/registry.json
- Execute agent tasks and observe live status and logs

### Phase 3: Task Queue + LLM Providers
- Task queue from data/tasks.db
- Task actions and statistics
- Provider health, model selection, quick test prompt, usage stats

## 3. Non-Goals
- No mock data, no placeholder buttons, no fake updates
- No redesign of existing Dashboard V2 navigation outside new panels
- No data export features beyond specified log download

## 4. Backend Requirements

### 4.1 Python FastAPI (Robotkez)
Implement or extend endpoints in myai/server.py:

#### POST /browser/start
- Purpose: Start a Robotkez browser session
- Request JSON:
```json
{
  "headless": true,
  "startUrl": "https://example.com",
  "sessionName": "optional-string"
}
```
- Response JSON:
```json
{
  "status": "started",
  "sessionId": "string",
  "pid": 1234
}
```

#### POST /browser/stop
- Purpose: Stop active session
- Request JSON:
```json
{
  "sessionId": "string"
}
```
- Response JSON:
```json
{
  "status": "stopped",
  "sessionId": "string"
}
```

#### GET /browser/status
- Purpose: Current Robotkez state
- Response JSON:
```json
{
  "active": true,
  "sessionId": "string",
  "currentUrl": "https://...",
  "startedAt": "2026-02-08T12:00:00Z",
  "lastScreenshotAt": "2026-02-08T12:00:05Z"
}
```

#### GET /browser/screenshot/latest
- Purpose: Latest screenshot for active session
- Response: image/png (binary), or 404 if none

#### POST /test/run
- Purpose: Run Robotkez test level
- Request JSON:
```json
{
  "level": 1,
  "sessionName": "optional-string"
}
```
- Response JSON:
```json
{
  "status": "started",
  "sessionId": "string",
  "level": 1
}
```
- Must run scripts:
  - scripts/robotkez_test_level1.py
  - scripts/robotkez_test_level2_n8n.py
  - scripts/robotkez_test_level3_monitoring.py

#### GET /test/logs/:sessionId (SSE)
- Purpose: Stream test logs in real time
- SSE event shape:
```
event: log
data: {"ts":"2026-02-08T12:00:10Z","level":"info","message":"..."}
```
```
event: done
data: {"status":"success","durationMs":12345}
```

#### Additional requirement: n8n status proxy (recommended)
- Use https://n8n-latest-fulv.onrender.com/api/v1/workflows
- Provide a server-side passthrough to avoid CORS issues (or ensure CORS is handled).

### 4.2 Node Backend (Dashboard API)
Extend endpoints in src/server/web.ts:

#### Existing (use)
- GET /api/agents
- POST /api/agents/:name/execute
- POST /api/ollama/generate
- POST /api/gemini/generate

#### New
##### GET /api/agents/status
- Purpose: aggregated agent status, last task timestamp, success/error counts
- Response JSON:
```json
{
  "agents": [
    {
      "name": "AgentName",
      "status": "idle",
      "lastTaskAt": "2026-02-08T12:00:00Z",
      "successCount": 10,
      "errorCount": 2
    }
  ]
}
```

##### GET /api/agents/:name/logs (SSE)
- Purpose: real-time logs from src/utils/logger.ts
- SSE event shape:
```
event: log
data: {"ts":"...","agent":"AgentName","level":"info","message":"..."}
```

##### GET /api/providers/status
- Purpose: provider health checks
- Response JSON:
```json
{
  "ollama": {"ok": true, "models": 12},
  "gemini": {"ok": true},
  "github": {"ok": false, "error": "missing token"}
}
```

##### Task Queue actions
- POST /api/tasks/execute
- POST /api/tasks/cancel
- POST /api/tasks/retry
- GET /api/tasks
- GET /api/tasks/:id
- These must use SQLite at data/tasks.db and AgentManager methods (no mock).

### 4.3 Socket.IO
- Real-time log streaming for:
  - Robotkez logs
  - Agent logs
  - Task queue updates
- Event names (canonical):
  - log (payload includes source, level, message, ts)
  - agent_status (payload includes name, status, lastTaskAt)
  - task_update (payload includes id, status, updatedAt)

## 5. Frontend Requirements

### Common UI Requirements
- TanStack Query for API state and caching
- sonner for user-facing errors and success notifications
- Loading states for all API calls and SSE/Socket connections
- Error boundaries or explicit error views for data fetch failures
- No placeholder UI; disable or hide actions when not available

### 5.1 RobotkezPanel
- Start/Stop buttons (POST /browser/start|stop)
- Status indicator (green = active, red = inactive)
- Current URL display (from GET /browser/status)
- Run L1/L2/L3 tests (POST /test/run)
- Real-time log tail (SSE /test/logs/:sessionId + Socket.IO logs)
- Screenshot preview (GET /browser/screenshot/latest), auto-refresh every 5s when active
- Click screenshot to open fullscreen modal
- n8n status:
  - Show workflow count
  - Last 5 workflows: name, status, last run
- All actions must show toasts on success/failure

### 5.2 AgentManagementPanel
- Registry display from src/agents/registry.json
- Execute agent task (POST /api/agents/:name/execute)
- Status monitor from GET /api/agents and GET /api/agents/status
- Color-coded status, last task timestamp, success/error counts
- Logs panel with filters (agent, level) from SSE /api/agents/:name/logs
- Download logs as JSON

### 5.3 TaskQueueMonitor
- List tasks from data/tasks.db
- Columns: id, agent, task, status, created_at, completed_at
- Filters: status
- Pagination: 20/page
- Actions:
  - Execute pending task (AgentManager.processPendingTasks)
  - Cancel running
  - Retry failed
  - View full JSON
- Stats:
  - total
  - success rate
  - avg execution time
  - failed breakdown by agent

### 5.4 LLMProvidersPanel
- Status checks:
  - Ollama: GET http://localhost:11434/api/tags
  - Gemini/GitHub: key test via /api/providers/status
- Model selector (provider-specific)
- Quick test prompt with response display
- Token usage stats when supported (show "not supported" otherwise)

## 6. Data and State

### Task Queue
- SQLite path: data/tasks.db
- Table schema (expected):
  - id
  - agent
  - task
  - status
  - created_at
  - completed_at

### Logging
- Use src/utils/logger.ts for log writes
- Logs must be streamable via Socket.IO and SSE

## 7. Error Handling and Loading
- All requests must show a loading indicator
- All failures must raise a sonner toast with actionable text
- SSE disconnections must auto-retry with backoff and show status indicator
- Screenshot fetch failure shows "no screenshot available" with retry

## 8. Acceptance Criteria
- RobotkezPanel starts/stops sessions and displays live status, URL, logs, and screenshots without mock data
- Test runs for levels 1/2/3 execute real scripts and show streaming logs
- n8n workflows show real count and last 5 items
- AgentManagementPanel shows real registry and status, executes agent tasks, and streams logs
- TaskQueueMonitor reads real tasks from data/tasks.db, supports actions, and displays stats
- LLMProvidersPanel shows real health checks, model list, and test responses
- Socket.IO logs stream in real time and remain stable under reconnect
- TanStack Query and sonner are used across panels
- No placeholder buttons or fake updates anywhere

## 9. API Payloads Summary
- /browser/start: { headless, startUrl, sessionName }
- /browser/stop: { sessionId }
- /browser/status: { active, sessionId, currentUrl, startedAt, lastScreenshotAt }
- /test/run: { level, sessionName }
- /test/logs/:sessionId SSE: event log|done
- /api/agents/status: { agents: [...] }
- /api/agents/:name/logs SSE: event log
- /api/providers/status: { ollama, gemini, github }
- /api/tasks: { items, page, pageSize, total }
- /api/tasks/:id: { task, metadata }

## 10. Testing Checklist
- [ ] POST /browser/start returns sessionId and status
- [ ] GET /browser/status reflects active session and current URL
- [ ] Screenshot auto-refresh every 5s during active session
- [ ] L1/L2/L3 test runs start and stream logs via SSE
- [ ] SSE reconnects after network loss and resumes streaming
- [ ] n8n workflows list shows real count and last 5 entries
- [ ] /api/agents lists all agents and status is color-coded
- [ ] /api/agents/:name/execute triggers execution and logs
- [ ] /api/agents/:name/logs SSE streams logs with filters
- [ ] Task queue pagination and filters return consistent results
- [ ] Execute/cancel/retry actions update task status
- [ ] Provider health checks reflect actual runtime state
- [ ] Quick test prompt returns response or proper error toast
