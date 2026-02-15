/**
 * Constants for CEAN Operations Center
 */

export const CEAN_TABS = {
  DASHBOARD: 'dashboard',
  WORKERS: 'workers',
  TASKS: 'tasks',
  DATA: 'data',
  SETTINGS: 'settings',
} as const;

export const WORKER_STATUS_COLORS = {
  RUNNING: 'text-green-500 bg-green-50',
  IDLE: 'text-yellow-500 bg-yellow-50',
  ERROR: 'text-red-500 bg-red-50',
} as const;

export const WORKER_STATUS_ICON = {
  RUNNING: '🟢',
  IDLE: '🟡',
  ERROR: '🔴',
} as const;

export const TASK_STATUS_COLORS = {
  QUEUED: 'text-blue-500 bg-blue-50',
  RUNNING: 'text-cyan-500 bg-cyan-50',
  COMPLETED: 'text-green-500 bg-green-50',
  FAILED: 'text-red-500 bg-red-50',
  CANCELLED: 'text-gray-500 bg-gray-50',
} as const;

export const TASK_STATUS_ICON = {
  QUEUED: '⏳',
  RUNNING: '⚙️',
  COMPLETED: '✅',
  FAILED: '❌',
  CANCELLED: '🚫',
} as const;

export const API_ENDPOINTS = {
  WORKERS: '/api/cean/workers',
  TASKS: '/api/cean/tasks',
  D1_TABLES: '/api/cean/d1/tables',
  D1_QUERY: '/api/cean/d1/query',
  R1_INDEXES: '/api/cean/r1/indexes',
  METRICS: '/api/cean/metrics',
} as const;

export const SOCKET_EVENTS = {
  // Client -> Server
  ORCHESTRATOR_PROMPT: 'cean:orchestrator:prompt',
  WORKER_TAIL_LOGS: 'cean:worker:tail-logs',
  TASK_CANCEL: 'cean:task:cancel',

  // Server -> Client
  WORKER_STATUS: 'cean:worker:status',
  ORCHESTRATOR_RESPONSE: 'cean:orchestrator:response',
  TASK_UPDATE: 'cean:task:update',
  LOGS_APPEND: 'cean:logs:append',
} as const;

export const TASK_TEMPLATES = [
  {
    id: 'research',
    label: 'Research Ügynök futtatása',
    text: 'Kérlek futtass egy research-agent-et az AI grant-okra',
  },
  {
    id: 'grant-monitor',
    label: 'Grant Figyelés (napi)',
    text: 'Futtass egy napi grant monitoring scan-t',
  },
  {
    id: 'harvester',
    label: 'Adat Betakarítás',
    text: 'Szedj adatokat [URL]-ról az adatgyűjtő ügynökkel',
  },
  {
    id: 'extractor',
    label: 'Adat Kinyerés',
    text: 'Bontsd ki [adattípus]-t az [input]-ből',
  },
  {
    id: 'builder',
    label: 'Build & Deploy',
    text: 'Fordítsd [repo]-t, output: [formátum]',
  },
  {
    id: 'status',
    label: 'Worker Státusz',
    text: 'Mi az összes worker-nek a státusza?',
  },
  {
    id: 'queue',
    label: 'Task Queue Info',
    text: 'Hány task van várakozásban?',
  },
] as const;

export const REFRESH_INTERVALS = {
  METRICS: 30000, // 30s
  WORKERS: 10000, // 10s
  TASKS: 5000, // 5s
} as const;

export const MAX_CHAT_MESSAGES = 200;
export const DEFAULT_ROWS_PER_PAGE = 50;
