#!/usr/bin/env node
/**
 * Copilot Dashboard Bridge v2 — FULL BAS System Control
 * 
 * Unified REST API wrapper giving Copilot CLI access to ALL 200+ BAS endpoints:
 * 53 MCP tools, 70+ agents, 18 enterprise modules, 6 SQLite DBs, RAG/Vector,
 * browser automation, LLM providers, Socket.IO events, and more.
 * 
 * Usage:
 *   node scripts/copilot-dashboard.js <domain> <action> [args...]
 *   node scripts/copilot-dashboard.js --help
 *   node scripts/copilot-dashboard.js --domains          # List all domains
 *   node scripts/copilot-dashboard.js --quick-status      # Full system overview
 * 
 * Examples:
 *   node scripts/copilot-dashboard.js health
 *   node scripts/copilot-dashboard.js agents execute lint_fixer "Fix ESLint errors"
 *   node scripts/copilot-dashboard.js paios chat "Analyze project health"
 *   node scripts/copilot-dashboard.js memory store default mykey "myvalue"
 *   node scripts/copilot-dashboard.js mcp execute knowledge_semantic_search '{"query":"auth"}'
 *   node scripts/copilot-dashboard.js enterprise execute finance_guardian "Check invoices"
 *   node scripts/copilot-dashboard.js robotkez exec "Navigate to google.com"
 *   node scripts/copilot-dashboard.js swarm dispatch "Research AI trends 2025"
 */

const BASE_URL = process.env.BAS_URL || 'http://localhost:3000';
const FASTAPI_URL = process.env.BAS_FASTAPI_URL || 'http://localhost:8000';

// --- HTTP Helper ---
async function api(method, path, body, baseUrl) {
  const url = `${baseUrl || BASE_URL}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, data: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, data: text };
    }
  } catch (err) {
    return { ok: false, status: 0, data: { error: `Connection failed: ${err.message}. Is BAS running? (npm run dev)` } };
  }
}

const GET = (path, base) => api('GET', path, null, base);
const POST = (path, body, base) => api('POST', path, body, base);
const PUT = (path, body, base) => api('PUT', path, body, base);
const DELETE = (path, base) => api('DELETE', path, null, base);

// --- Command Handlers (22 domains, 200+ actions) ---

const commands = {

  // ╔══════════════════════════════════════════════╗
  // ║  1. SYSTEM & HEALTH                          ║
  // ╚══════════════════════════════════════════════╝
  async health() { return GET('/api/health'); },
  async status() { return GET('/api/system/status'); },
  async architecture() { return GET('/api/system/architecture-status'); },
  
  async '--quick-status'() {
    const results = {};
    const [h, a, t] = await Promise.all([
      GET('/api/health'),
      GET('/api/agents/status'),
      GET('/api/v1/tasks/stats')
    ]);
    results.health = h.data;
    results.agents = a.data;
    results.tasks = t.data;
    return { ok: true, data: results };
  },

  // ╔══════════════════════════════════════════════╗
  // ║  2. AGENTS (70+ agents)                      ║
  // ╚══════════════════════════════════════════════╝
  async 'agents'(sub, ...args) {
    switch (sub) {
      case 'list': return GET('/api/agents');
      case 'status': return GET('/api/agents/status');
      case 'diagnostics': return GET('/api/agents/diagnostics');
      case 'registry': return GET('/api/agents/registry');
      case 'execute': {
        const [name, ...t] = args;
        const task = t.join(' ');
        if (!name || !task) return err('Usage: agents execute <name> <task>');
        return POST(`/api/agents/${name}/execute`, { task });
      }
      case 'orchestrate': case 'route': {
        const task = args.join(' ');
        if (!task) return err('Usage: agents orchestrate <task>');
        return POST('/api/agents/orchestrate', { task });
      }
      case 'create': {
        const [name, ...d] = args;
        if (!name) return err('Usage: agents create <name> [description]');
        return POST('/api/agents/create', { name, description: d.join(' ') });
      }
      default: return GET('/api/agents');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  3. TASKS (Queue, Execute, Stats)            ║
  // ╚══════════════════════════════════════════════╝
  async 'tasks'(sub, ...args) {
    switch (sub) {
      case 'list': return GET('/api/v1/tasks');
      case 'stats': return GET('/api/v1/tasks/stats');
      case 'execute': {
        const [id] = args;
        if (!id) return err('Usage: tasks execute <taskId>');
        return POST(`/api/v1/tasks/${id}/execute`);
      }
      case 'cancel': {
        const [id] = args;
        if (!id) return err('Usage: tasks cancel <taskId>');
        return DELETE(`/api/v1/tasks/${id}/cancel`);
      }
      case 'retry': {
        const [id] = args;
        if (!id) return err('Usage: tasks retry <taskId>');
        return POST(`/api/v1/tasks/${id}/retry`);
      }
      case 'suggested': return GET('/api/v1/tasks/suggested');
      case 'decompose': {
        const task = args.join(' ');
        if (!task) return err('Usage: tasks decompose <complex task>');
        return POST('/api/v1/tasks/decompose', { task });
      }
      default: return GET('/api/v1/tasks/stats');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  4. TRACKS (Project Management)              ║
  // ╚══════════════════════════════════════════════╝
  async 'tracks'(sub, ...args) {
    switch (sub) {
      case 'list': return GET('/api/v1/tracks/list');
      case 'todos': {
        const [id] = args;
        if (id) return GET(`/api/v1/tracks/${id}/todos`);
        return GET('/api/v1/tracks/todos/active');
      }
      case 'generate': {
        const idea = args.join(' ');
        if (!idea) return err('Usage: tracks generate <idea>');
        return POST('/api/v1/tracks/generate', { idea });
      }
      case 'toggle': {
        const [id, idx] = args;
        if (!id || idx === undefined) return err('Usage: tracks toggle <trackId> <todoIndex>');
        return POST(`/api/v1/tracks/${id}/todo/toggle`, { index: parseInt(idx) });
      }
      default: return GET('/api/v1/tracks/todos/active');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  5. PAIOS CHAT (5 LLM Providers)             ║
  // ╚══════════════════════════════════════════════╝
  async 'paios'(sub, ...args) {
    switch (sub) {
      case 'chat': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: paios chat <message>');
        return POST('/api/paios/chat', { message: msg, model: 'gpt-4.1', provider: 'github' });
      }
      case 'chat-gemini': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: paios chat-gemini <message>');
        return POST('/api/paios/chat', { message: msg, model: 'gemini-2.5-flash', provider: 'gemini' });
      }
      case 'chat-claude': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: paios chat-claude <message>');
        return POST('/api/paios/chat', { message: msg, model: 'claude-3-5-sonnet', provider: 'anthropic' });
      }
      case 'chat-ollama': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: paios chat-ollama <message>');
        return POST('/api/paios/chat', { message: msg, model: 'qwen2.5-coder:7b', provider: 'ollama' });
      }
      case 'providers': return GET('/api/paios/providers');
      default: return GET('/api/paios/providers');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  6. LLM MODELS (Ollama, Gemini, GitHub, etc) ║
  // ╚══════════════════════════════════════════════╝
  async 'llm'(sub, ...args) {
    switch (sub) {
      case 'catalog': return GET('/api/llm/catalog');
      case 'providers': return GET('/api/providers');
      case 'models': return GET('/api/ollama/models');
      case 'generate': {
        const [provider, ...p] = args;
        const prompt = p.join(' ');
        if (!provider || !prompt) return err('Usage: llm generate <provider> <prompt>');
        const routes = { gemini: '/api/gemini/generate', github: '/api/github-models/generate', ollama: '/api/ollama/generate' };
        if (!routes[provider]) return err(`Unknown provider: ${provider}. Use: gemini, github, ollama`);
        return POST(routes[provider], { prompt });
      }
      default: return GET('/api/llm/catalog');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  7. MCP TOOLS (53 tools)                     ║
  // ╚══════════════════════════════════════════════╝
  async 'mcp'(sub, ...args) {
    switch (sub) {
      case 'tools': return GET('/api/mcp/tools');
      case 'execute': {
        const [toolName, ...p] = args;
        if (!toolName) return err('Usage: mcp execute <toolName> [JSON params]');
        const params = p.length ? JSON.parse(p.join(' ')) : {};
        return POST(`/api/mcp/tools/${toolName}`, params);
      }
      case 'providers': return GET('/api/mcp/providers');
      case 'audit': return GET('/api/mcp/audit');
      case 'safezones': return GET('/api/mcp/safezones');
      default: return GET('/api/mcp/tools');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  8. ROBOTKEZ (Browser Automation)            ║
  // ╚══════════════════════════════════════════════╝
  async 'robotkez'(sub, ...args) {
    switch (sub) {
      case 'chat': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: robotkez chat <instruction>');
        return POST('/api/v1/robotkez/chat', { message: msg });
      }
      case 'plan': {
        const instr = args.join(' ');
        if (!instr) return err('Usage: robotkez plan <instruction>');
        return POST('/api/v1/robotkez/plan', { instruction: instr });
      }
      case 'exec': {
        const instr = args.join(' ');
        if (!instr) return err('Usage: robotkez exec <instruction>');
        return POST('/api/v1/robotkez/exec', { instruction: instr });
      }
      case 'status': return GET('/api/v1/robotkez/status');
      case 'tasks': return GET('/api/v1/robotkez/tasks');
      default: return GET('/api/v1/robotkez/status');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  9. BROWSER (Persistent + Copilot)           ║
  // ╚══════════════════════════════════════════════╝
  async 'browser'(sub, ...args) {
    switch (sub) {
      case 'navigate': {
        const [url] = args;
        if (!url) return err('Usage: browser navigate <url>');
        return POST('/api/mcp/tools/pb_navigate', { url });
      }
      case 'screenshot': return POST('/api/mcp/tools/pb_screenshot', {});
      case 'click': {
        const [sel] = args;
        if (!sel) return err('Usage: browser click <selector>');
        return POST('/api/mcp/tools/pb_click', { selector: sel });
      }
      case 'type': {
        const [sel, ...t] = args;
        if (!sel) return err('Usage: browser type <selector> <text>');
        return POST('/api/mcp/tools/pb_type', { selector: sel, text: t.join(' ') });
      }
      case 'content': return POST('/api/mcp/tools/pb_content', {});
      case 'copilot-chat': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: browser copilot-chat <message>');
        return POST('/api/browser-copilot/chat', { message: msg });
      }
      case 'copilot-status': return GET('/api/browser-copilot/status');
      default: return GET('/api/browser-copilot/status');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  10. ENTERPRISE (18 modules)                 ║
  // ╚══════════════════════════════════════════════╝
  async 'enterprise'(sub, ...args) {
    switch (sub) {
      case 'modules': return GET('/api/enterprise/modules');
      case 'stats': return GET('/api/enterprise/stats');
      case 'execute': {
        const [moduleId, ...t] = args;
        if (!moduleId) return err('Usage: enterprise execute <moduleId> [task]');
        return POST('/api/enterprise/execute', { moduleId, task: t.join(' ') });
      }
      case 'history': return GET('/api/enterprise/history');
      case 'analytics': {
        const [what] = args;
        if (what === 'events') return GET('/api/enterprise/analytics/events');
        if (what === 'stats') return GET('/api/enterprise/analytics/stats');
        return GET('/api/enterprise/analytics/stats');
      }
      default: return GET('/api/enterprise/modules');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  11. DEVELOPER (Git, Code, Scaffolding)      ║
  // ╚══════════════════════════════════════════════╝
  async 'developer'(sub, ...args) {
    switch (sub) {
      case 'execute': {
        const task = args.join(' ');
        if (!task) return err('Usage: developer execute <task>');
        return POST('/api/v1/developer/execute', { task });
      }
      case 'history': return GET('/api/v1/developer/history');
      case 'context': {
        const [fp] = args;
        if (!fp) return err('Usage: developer context <filePath>');
        return POST('/api/v1/developer/context', { filePath: fp });
      }
      case 'scaffold': {
        const type = args.join(' ');
        if (!type) return err('Usage: developer scaffold <type>');
        return POST('/api/v1/developer/scaffold', { type });
      }
      default: return GET('/api/v1/developer/history');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  12. KNOWLEDGE & RAG                         ║
  // ╚══════════════════════════════════════════════╝
  async 'knowledge'(sub, ...args) {
    switch (sub) {
      case 'search': {
        const q = args.join(' ');
        if (!q) return err('Usage: knowledge search <pattern>');
        return POST('/api/mcp/tools/knowledge_search', { pattern: q });
      }
      case 'semantic': {
        const q = args.join(' ');
        if (!q) return err('Usage: knowledge semantic <query>');
        return POST('/api/mcp/tools/knowledge_semantic_search', { query: q });
      }
      case 'index': {
        const [fp] = args;
        if (!fp) return err('Usage: knowledge index <file_path>');
        return POST('/api/mcp/tools/knowledge_index_file', { file_path: fp });
      }
      case 'context': {
        const fps = args;
        if (!fps.length) return err('Usage: knowledge context <file1> [file2] ...');
        return POST('/api/mcp/tools/knowledge_read_context', { file_paths: fps });
      }
      case 'rag-search': {
        const q = args.join(' ');
        if (!q) return err('Usage: knowledge rag-search <query>');
        return POST('/rag/search', { query: q }, FASTAPI_URL);
      }
      case 'rag-ingest': {
        const content = args.join(' ');
        if (!content) return err('Usage: knowledge rag-ingest <content>');
        return POST('/rag/ingest', { content }, FASTAPI_URL);
      }
      default: return { ok: true, data: { commands: ['search', 'semantic', 'index', 'context', 'rag-search', 'rag-ingest'] } };
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  13. MEMORY (User Preferences & Context)     ║
  // ╚══════════════════════════════════════════════╝
  async 'memory'(sub, ...args) {
    switch (sub) {
      case 'store': {
        const [userId, key, ...v] = args;
        if (!userId || !key || !v.length) return err('Usage: memory store <userId> <key> <value>');
        return POST('/api/mcp/tools/memory_store_preference', { user_id: userId, key, value: v.join(' ') });
      }
      case 'query': {
        const [userId, pattern] = args;
        if (!userId) return err('Usage: memory query <userId> [keyPattern]');
        const params = { user_id: userId };
        if (pattern) params.key_pattern = pattern;
        return POST('/api/mcp/tools/memory_query_preferences', params);
      }
      case 'context': {
        const [userId] = args;
        if (!userId) return err('Usage: memory context <userId>');
        return POST('/api/mcp/tools/memory_get_context', { user_id: userId || 'default' });
      }
      case 'delete': {
        const [userId, key] = args;
        if (!userId || !key) return err('Usage: memory delete <userId> <key>');
        return POST('/api/mcp/tools/memory_delete_preference', { user_id: userId, key });
      }
      default: return { ok: true, data: { commands: ['store', 'query', 'context', 'delete'] } };
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  14. FILES & WORKSPACE                       ║
  // ╚══════════════════════════════════════════════╝
  async 'files'(sub, ...args) {
    switch (sub) {
      case 'list': {
        const dir = args[0] || '.';
        return GET(`/api/files/list?dir=${encodeURIComponent(dir)}`);
      }
      case 'read': {
        const [fp] = args;
        if (!fp) return err('Usage: files read <path>');
        return POST('/api/files/read', { path: fp });
      }
      case 'search': {
        const q = args.join(' ');
        if (!q) return err('Usage: files search <query>');
        return POST('/api/files/search', { query: q });
      }
      default: return GET('/api/files/list');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  15. SWARM (Multi-Agent Colony)              ║
  // ╚══════════════════════════════════════════════╝
  async 'swarm'(sub, ...args) {
    switch (sub) {
      case 'status': return GET('/api/v1/swarm/status');
      case 'dispatch': {
        const task = args.join(' ');
        if (!task) return err('Usage: swarm dispatch <task>');
        return POST('/api/v1/swarm/dispatch', { task });
      }
      case 'checkpoints': return GET('/api/v1/swarm/checkpoints');
      case 'ingest': {
        const [url] = args;
        if (!url) return err('Usage: swarm ingest <url>');
        return POST('/api/mcp/tools/swarm_ingest', { url });
      }
      default: return GET('/api/v1/swarm/status');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  16. OBSERVABILITY & MONITORING              ║
  // ╚══════════════════════════════════════════════╝
  async 'observability'(sub) {
    switch (sub) {
      case 'stats': return GET('/api/v1/observability/stats');
      case 'calls': return GET('/api/v1/observability/calls');
      case 'timeline': return GET('/api/v1/observability/timeline');
      case 'metrics': return POST('/api/mcp/tools/monitor_get_metrics', {});
      case 'logs': return POST('/api/mcp/tools/monitor_tail_logs', { log_file: 'brunella.log', lines: 50 });
      default: return GET('/api/v1/observability/stats');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  17. SECURITY                                ║
  // ╚══════════════════════════════════════════════╝
  async 'security'(sub) {
    switch (sub) {
      case 'audit': return GET('/api/security/audit');
      case 'threats': return GET('/api/security/threats');
      case 'guardrails': return GET('/api/guardrails/status');
      default: return GET('/api/security/audit');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  18. CLOUDFLARE & EDGE                       ║
  // ╚══════════════════════════════════════════════╝
  async 'cloudflare'(sub) {
    switch (sub) {
      case 'status': return GET('/api/cloudflare/status');
      case 'workers': return GET('/api/cloudflare/workers');
      case 'edge': return GET('/api/edge/status');
      default: return GET('/api/cloudflare/status');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  19. CEAN ORCHESTRATOR                       ║
  // ╚══════════════════════════════════════════════╝
  async 'cean'(sub, ...args) {
    switch (sub) {
      case 'execute': {
        const task = args.join(' ');
        if (!task) return err('Usage: cean execute <task>');
        return POST('/api/cean/execute', { task });
      }
      case 'status': {
        const [taskId] = args;
        if (!taskId) return err('Usage: cean status <taskId>');
        return GET(`/api/cean/pipeline/${taskId}`);
      }
      case 'chat': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: cean chat <message>');
        return POST('/api/cean/chat/save', { message: msg });
      }
      default: return { ok: true, data: { commands: ['execute', 'status', 'chat'] } };
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  20. PYTHON SUBSYSTEM (FastAPI)              ║
  // ╚══════════════════════════════════════════════╝
  async 'python'(sub, ...args) {
    switch (sub) {
      case 'health': return GET('/health', FASTAPI_URL);
      case 'execute': {
        const code = args.join(' ');
        if (!code) return err('Usage: python execute <code>');
        return POST('/execute', { code }, FASTAPI_URL);
      }
      case 'refine': {
        const content = args.join(' ');
        if (!content) return err('Usage: python refine <content>');
        return POST('/refine', { content }, FASTAPI_URL);
      }
      case 'harvest': {
        const [url] = args;
        if (!url) return err('Usage: python harvest <url>');
        return POST('/harvest', { url }, FASTAPI_URL);
      }
      case 'comet': {
        const task = args.join(' ');
        if (!task) return err('Usage: python comet <task>');
        return POST('/comet/execute', { task }, FASTAPI_URL);
      }
      case 'workers': return GET('/api/python-workers/list');
      case 'run': {
        const [script] = args;
        if (!script) return err('Usage: python run <script>');
        return POST('/api/python-workers/run', { script });
      }
      default: return GET('/health', FASTAPI_URL);
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  21. INVOICE & FINANCE                       ║
  // ╚══════════════════════════════════════════════╝
  async 'invoice'(sub, ...args) {
    switch (sub) {
      case 'list': return POST('/api/mcp/tools/get_szamlazz_invoices', { limit: parseInt(args[0]) || 20 });
      case 'unpaid': return POST('/api/mcp/tools/get_szamlazz_invoices', { include_unpaid_only: true });
      case 'overdue': return POST('/api/mcp/tools/get_szamlazz_invoices', { get_overdue: true });
      case 'sheets': {
        const invoices = args[0] ? JSON.parse(args[0]) : [];
        return POST('/api/mcp/tools/write_sheets_invoices', { invoices });
      }
      default: return { ok: true, data: { commands: ['list', 'unpaid', 'overdue', 'sheets'] } };
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  22. GOOGLE WORKSPACE                        ║
  // ╚══════════════════════════════════════════════╝
  async 'google'(sub, ...args) {
    switch (sub) {
      case 'gmail': return POST('/api/mcp/tools/gmail_list_messages', { maxResults: parseInt(args[0]) || 10 });
      case 'calendar': return POST('/api/mcp/tools/calendar_list_events', { maxResults: parseInt(args[0]) || 10 });
      case 'sheets-create': {
        const title = args.join(' ');
        if (!title) return err('Usage: google sheets-create <title>');
        return POST('/api/mcp/tools/sheets_create_spreadsheet', { title });
      }
      case 'sheets-append': {
        const [id, range, ...d] = args;
        if (!id) return err('Usage: google sheets-append <spreadsheetId> <range> <JSON values>');
        return POST('/api/mcp/tools/sheets_append_data', { spreadsheetId: id, range: range || 'Sheet1!A1', values: JSON.parse(d.join(' ')) });
      }
      default: return { ok: true, data: { commands: ['gmail', 'calendar', 'sheets-create', 'sheets-append'] } };
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  23. CRAWL4AI (Web Crawling)                 ║
  // ╚══════════════════════════════════════════════╝
  async 'crawl'(sub, ...args) {
    switch (sub) {
      case 'fetch': case undefined: {
        const [url] = (sub === 'fetch') ? args : [sub, ...args];
        if (!url) return err('Usage: crawl fetch <url>');
        return POST('/api/mcp/tools/crawl4ai_crawl', { url });
      }
      case 'batch': {
        const urls = args;
        if (!urls.length) return err('Usage: crawl batch <url1> <url2> ...');
        return POST('/api/mcp/tools/crawl4ai_batch', { urls });
      }
      default: {
        return POST('/api/mcp/tools/crawl4ai_crawl', { url: sub });
      }
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  24. ASSISTANT & CHAT                        ║
  // ╚══════════════════════════════════════════════╝
  async 'assistant'(sub, ...args) {
    switch (sub) {
      case 'blueprint': return GET('/api/assistant/blueprint');
      case 'message': {
        const msg = args.join(' ');
        if (!msg) return err('Usage: assistant message <text>');
        return POST('/api/assistant/message', { message: msg });
      }
      case 'hyperkernel': return POST('/api/assistant/hyperkernel/cycle', {});
      default: return GET('/api/assistant/blueprint');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  25. EV HUNTER (Electric Vehicle Search)     ║
  // ╚══════════════════════════════════════════════╝
  async 'evhunter'(sub) {
    switch (sub) {
      case 'search': return POST('/api/mcp/tools/ev_hunter_search', {});
      case 'status': return POST('/api/mcp/tools/ev_hunter_status', {});
      default: return POST('/api/mcp/tools/ev_hunter_status', {});
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  26. SALES & LEADS                           ║
  // ╚══════════════════════════════════════════════╝
  async 'sales'(sub, ...args) {
    switch (sub) {
      case 'leads': return GET('/api/sales/leads');
      case 'campaigns': return GET('/api/sales/campaigns');
      case 'mine': {
        const query = args.join(' ');
        if (!query) return err('Usage: sales mine <query>');
        return POST('/api/sales/mine', { query });
      }
      default: return GET('/api/sales/leads');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  27. TESTS & CODE PIPELINE                   ║
  // ╚══════════════════════════════════════════════╝
  async 'tests'(sub) {
    switch (sub) {
      case 'run': return POST('/api/mcp/tools/test-scheduler-run', {});
      case 'status': return POST('/api/mcp/tools/test-scheduler-status', { includeDetails: true });
      default: return POST('/api/mcp/tools/test-scheduler-status', {});
    }
  },

  async 'pipeline'(sub, ...args) {
    switch (sub) {
      case 'generate': {
        const task = args.join(' ');
        if (!task) return err('Usage: pipeline generate <task>');
        return POST('/api/mcp/tools/pipeline_self_healing_gen', { task });
      }
      default: return { ok: true, data: { commands: ['generate'] } };
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  28. WORKFLOW & FLEET                        ║
  // ╚══════════════════════════════════════════════╝
  async 'workflow'(sub) {
    switch (sub) {
      case 'list': return GET('/api/v1/workflow/list');
      case 'status': return GET('/api/v1/workflow/status');
      default: return GET('/api/v1/workflow/status');
    }
  },

  async 'fleet'(sub) {
    switch (sub) {
      case 'status': return GET('/api/v1/fleet/status');
      case 'agents': return GET('/api/v1/fleet/agents');
      default: return GET('/api/v1/fleet/status');
    }
  },

  // ╔══════════════════════════════════════════════╗
  // ║  DOMAINS LIST                                ║
  // ╚══════════════════════════════════════════════╝
  async '--domains'() {
    return { ok: true, data: {
      domains: [
        'health', 'status', 'architecture',
        'agents      — 70+ agents (list/status/execute/orchestrate/create)',
        'tasks       — Task queue (list/stats/execute/cancel/retry/decompose)',
        'tracks      — Project tracks (list/todos/generate/toggle)',
        'paios       — PAIOSZ chat (chat/chat-gemini/chat-claude/chat-ollama/providers)',
        'llm         — LLM models (catalog/providers/models/generate)',
        'mcp         — 53 MCP tools (tools/execute/audit/safezones)',
        'robotkez    — Browser automation (chat/plan/exec/status/tasks)',
        'browser     — Persistent browser (navigate/screenshot/click/type/copilot-chat)',
        'enterprise  — 18 enterprise modules (modules/stats/execute/history/analytics)',
        'developer   — Dev pipeline (execute/history/context/scaffold)',
        'knowledge   — RAG/Vector DB (search/semantic/index/context/rag-search/rag-ingest)',
        'memory      — User preferences (store/query/context/delete)',
        'files       — Workspace files (list/read/search)',
        'swarm       — Multi-agent colony (status/dispatch/checkpoints/ingest)',
        'observability — Metrics (stats/calls/timeline/metrics/logs)',
        'security    — Audit & threats (audit/threats/guardrails)',
        'cloudflare  — Edge workers (status/workers/edge)',
        'cean        — CEAN orchestrator (execute/status/chat)',
        'python      — FastAPI subsystem (health/execute/refine/harvest/comet/workers/run)',
        'invoice     — Szamlazz.hu (list/unpaid/overdue/sheets)',
        'google      — Google Workspace (gmail/calendar/sheets-create/sheets-append)',
        'crawl       — Crawl4AI (fetch/batch)',
        'assistant   — AI assistant (blueprint/message/hyperkernel)',
        'evhunter    — EV search (search/status)',
        'sales       — Sales & leads (leads/campaigns/mine)',
        'tests       — Test scheduler (run/status)',
        'pipeline    — Code pipeline (generate)',
        'workflow    — Workflow engine (list/status)',
        'fleet       — Agent fleet (status/agents)',
      ]
    }};
  },

  // ╔══════════════════════════════════════════════╗
  // ║  HELP                                        ║
  // ╚══════════════════════════════════════════════╝
  async '--help'() {
    return {
      ok: true,
      data: {
        title: '🧠 Copilot Dashboard Bridge v2 — Full BAS System Control',
        description: 'Gives Copilot CLI access to ALL 200+ BAS endpoints',
        stats: {
          mcp_tools: 53,
          agents: '70+',
          rest_endpoints: '200+',
          dashboard_panels: '70+',
          enterprise_modules: 18,
          llm_providers: 5,
          databases: 6,
          domains: 28
        },
        usage: 'node scripts/copilot-dashboard.js <domain> <action> [args...]',
        quickstart: [
          'node scripts/copilot-dashboard.js --quick-status',
          'node scripts/copilot-dashboard.js --domains',
          'node scripts/copilot-dashboard.js agents list',
          'node scripts/copilot-dashboard.js agents execute lint_fixer "Fix errors"',
          'node scripts/copilot-dashboard.js paios chat "Analyze health"',
          'node scripts/copilot-dashboard.js mcp execute knowledge_semantic_search \'{"query":"auth"}\'',
          'node scripts/copilot-dashboard.js enterprise execute finance_guardian "Check invoices"',
          'node scripts/copilot-dashboard.js swarm dispatch "Research AI trends"',
          'node scripts/copilot-dashboard.js robotkez exec "Navigate to google.com"',
          'node scripts/copilot-dashboard.js memory store default pref_theme "dark"',
        ]
      }
    };
  }
};

// --- Helpers ---
function err(message) { return { ok: false, data: { error: message } }; }

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '-h') args[0] = '--help';

  const command = args[0];
  const subArgs = args.slice(1);

  const handler = commands[command];
  if (!handler) {
    console.error(JSON.stringify({ error: `Unknown domain: ${command}. Use --domains for available domains, --help for full help.` }));
    process.exit(1);
  }

  const result = await handler(...subArgs);
  console.log(JSON.stringify(result.data, null, 2));
  
  if (!result.ok) process.exit(1);
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
