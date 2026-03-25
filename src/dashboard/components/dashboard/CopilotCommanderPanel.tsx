/**
 * CopilotCommanderPanel — Layer 2: Dashboard panel for Copilot CLI integration
 * 
 * Real-time view of Copilot CLI activity, agent dispatch, task management,
 * and system health — all from the Dashboard UI.
 * 
 * Features:
 * - System Overview: health, agent stats, task queue summary
 * - Agent Dispatch: send tasks to BAS agents from the dashboard
 * - Activity Log: recent Copilot commands and results
 * - Quick Commands: common operations grid
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal, Activity, Send, RefreshCw, AlertCircle, CheckCircle2,
  Clock, Zap, Users, Cpu, Database, ArrowRight, Play, XCircle,
  BarChart3, Loader2, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

// ---------- Types ----------

interface HealthData {
  status: string;
  version?: string;
  uptime?: number;
  agents?: { total: number; active: number; idle: number };
  taskQueue?: { pending: number; running: number; completed: number };
  llm?: { provider: string; model: string; available: boolean };
  memory?: { rss: number; heapUsed: number };
}

interface AgentStatus {
  name: string;
  status: string;
  currentTask?: string;
  lastActivity?: string;
}

interface BridgeCommand {
  id: string;
  timestamp: string;
  domain: string;
  action: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  durationMs?: number;
}

interface BridgeStats {
  totalCommands: number;
  successCount: number;
  errorCount: number;
  lastCommandAt: string | null;
  activeDispatches: number;
  uptimeSince: string;
}

interface QuickCommand {
  label: string;
  icon: React.ReactNode;
  description: string;
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
}

// ---------- Constants ----------

const QUICK_COMMANDS: QuickCommand[] = [
  { label: 'Health Check', icon: <Activity className="w-4 h-4" />, description: 'Rendszer állapot lekérése', endpoint: '/api/health' },
  { label: 'Agent Lista', icon: <Users className="w-4 h-4" />, description: 'Összes agent állapota', endpoint: '/api/agents/status' },
  { label: 'Task Queue', icon: <Clock className="w-4 h-4" />, description: 'Feladat sor állapota', endpoint: '/api/tasks/queue' },
  { label: 'MCP Tools', icon: <Zap className="w-4 h-4" />, description: 'Elérhető MCP eszközök', endpoint: '/api/tools' },
  { label: 'LLM Status', icon: <Cpu className="w-4 h-4" />, description: 'LLM provider állapot', endpoint: '/api/llm/status' },
  { label: 'Memory Stats', icon: <Database className="w-4 h-4" />, description: 'Memória statisztika', endpoint: '/api/memory/stats' },
  { label: 'Phoenix Events', icon: <AlertCircle className="w-4 h-4" />, description: 'Utolsó phoenix események', endpoint: '/api/phoenix/events' },
  { label: 'Track Status', icon: <BarChart3 className="w-4 h-4" />, description: 'Aktív trackek', endpoint: '/api/tracks/status' },
];

// ---------- Helpers ----------

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    idle: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    working: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    ok: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  const cls = colors[status.toLowerCase()] ?? colors.idle;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

// ---------- Sub-components ----------

function OverviewTab({ health, agents, bridgeStats, loading, onRefresh }: {
  health: HealthData | null;
  agents: AgentStatus[];
  bridgeStats: BridgeStats | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const activeAgents = agents.filter(a => a.status === 'working' || a.status === 'active').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Rendszer"
          value={health?.status === 'ok' ? '✅ OK' : health?.status ?? '—'}
          sub={health?.version ? `v${health.version}` : ''}
          icon={<Activity className="w-4 h-4 text-green-400" />}
        />
        <StatCard
          label="Ügynökök"
          value={`${activeAgents} / ${agents.length}`}
          sub={`${idleAgents} idle`}
          icon={<Users className="w-4 h-4 text-blue-400" />}
        />
        <StatCard
          label="Bridge Parancsok"
          value={String(bridgeStats?.totalCommands ?? 0)}
          sub={bridgeStats?.lastCommandAt ? relativeTime(bridgeStats.lastCommandAt) : 'nincs még'}
          icon={<Terminal className="w-4 h-4 text-purple-400" />}
        />
        <StatCard
          label="Memória"
          value={health?.memory ? formatBytes(health.memory.heapUsed) : '—'}
          sub={health?.memory ? `RSS: ${formatBytes(health.memory.rss)}` : ''}
          icon={<Database className="w-4 h-4 text-amber-400" />}
        />
      </div>

      {/* Active Agents */}
      {activeAgents > 0 && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Aktív Ügynökök
          </h3>
          <div className="space-y-2">
            {agents.filter(a => a.status === 'working' || a.status === 'active').map(agent => (
              <div key={agent.name} className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-mono text-sm">{agent.name}</span>
                </div>
                <span className="text-xs text-gray-400 truncate max-w-[200px]">{agent.currentTask ?? '...'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LLM Status */}
      {health?.llm && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" /> LLM Provider
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">Provider:</span>
            <span className="font-mono">{health.llm.provider}</span>
            <span className="text-gray-400">Model:</span>
            <span className="font-mono">{health.llm.model}</span>
            {statusBadge(health.llm.available ? 'active' : 'error')}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <div className="text-lg font-bold font-mono">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function DispatchTab({ agents, onDispatch }: {
  agents: AgentStatus[];
  onDispatch: (agentName: string, task: string) => Promise<void>;
}) {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [dispatching, setDispatching] = useState(false);

  const handleDispatch = async () => {
    if (!selectedAgent || !taskInput.trim()) {
      toast.error('Válassz ügynököt és adj meg feladatot!');
      return;
    }
    setDispatching(true);
    try {
      await onDispatch(selectedAgent, taskInput);
      toast.success(`Feladat elküldve: ${selectedAgent}`);
      setTaskInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Dispatch hiba: ${msg}`);
    } finally {
      setDispatching(false);
    }
  };

  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      {/* Agent selector */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Ügynök kiválasztása</label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="">— Válassz ügynököt —</option>
          {sortedAgents.map(a => (
            <option key={a.name} value={a.name}>
              {a.name} ({a.status})
            </option>
          ))}
        </select>
      </div>

      {/* Task input */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Feladat leírása</label>
        <textarea
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          placeholder="Írd le a feladatot amit az ügynöknek kell végrehajtania..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Dispatch button */}
      <button
        onClick={() => void handleDispatch()}
        disabled={dispatching || !selectedAgent || !taskInput.trim()}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
      >
        {dispatching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {dispatching ? 'Küldés...' : 'Feladat Indítása'}
      </button>

      {/* Agent quick-info */}
      {selectedAgent && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-1">
            <ChevronRight className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm">{selectedAgent}</span>
            {statusBadge(agents.find(a => a.name === selectedAgent)?.status ?? 'unknown')}
          </div>
          <p className="text-xs text-gray-400">
            {agents.find(a => a.name === selectedAgent)?.currentTask
              ? `Jelenlegi: ${agents.find(a => a.name === selectedAgent)?.currentTask}`
              : 'Várakozik feladatra'}
          </p>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ commands, loading }: { commands: BridgeCommand[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Betöltés...
      </div>
    );
  }

  if (commands.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Még nincs Copilot parancs az Activity Log-ban.</p>
        <p className="text-xs mt-1">Futtass egy parancsot a Copilot CLI-ből!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {commands.map(cmd => (
        <div key={cmd.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-blue-300">{cmd.domain}</span>
              <ArrowRight className="w-3 h-3 text-gray-500" />
              <span className="font-mono text-sm">{cmd.action}</span>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(cmd.status)}
              <span className="text-xs text-gray-500">{relativeTime(cmd.timestamp)}</span>
            </div>
          </div>
          {cmd.error && (
            <div className="mt-1 text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
              {cmd.error}
            </div>
          )}
          {cmd.durationMs != null && (
            <span className="text-xs text-gray-500">{cmd.durationMs}ms</span>
          )}
        </div>
      ))}
    </div>
  );
}

function QuickCommandsTab({ onExecute }: { onExecute: (cmd: QuickCommand) => Promise<void> }) {
  const [results, setResults] = useState<Record<string, { loading: boolean; data?: unknown; error?: string }>>({});

  const execute = async (cmd: QuickCommand) => {
    setResults(prev => ({ ...prev, [cmd.label]: { loading: true } }));
    try {
      await onExecute(cmd);
      setResults(prev => ({ ...prev, [cmd.label]: { loading: false, data: 'OK' } }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResults(prev => ({ ...prev, [cmd.label]: { loading: false, error: msg } }));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {QUICK_COMMANDS.map(cmd => {
        const r = results[cmd.label];
        return (
          <button
            key={cmd.label}
            onClick={() => void execute(cmd)}
            disabled={r?.loading}
            className="flex items-start gap-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg p-3 text-left transition-colors"
          >
            <div className="mt-0.5 text-blue-400">{cmd.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{cmd.label}</span>
                {r?.loading && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                {r?.data && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                {r?.error && <XCircle className="w-3 h-3 text-red-400" />}
              </div>
              <span className="text-xs text-gray-400">{cmd.description}</span>
              {r?.error && <div className="text-xs text-red-400 mt-1 truncate">{r.error}</div>}
            </div>
            <Play className="w-4 h-4 text-gray-500 mt-0.5" />
          </button>
        );
      })}
    </div>
  );
}

// ---------- Main Component ----------

type TabId = 'overview' | 'dispatch' | 'activity' | 'quick';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Áttekintés', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'dispatch', label: 'Agent Dispatch', icon: <Send className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity Log', icon: <Terminal className="w-4 h-4" /> },
  { id: 'quick', label: 'Gyors Parancsok', icon: <Zap className="w-4 h-4" /> },
];

export function CopilotCommanderPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [commands, setCommands] = useState<BridgeCommand[]>([]);
  const [bridgeStats, setBridgeStats] = useState<BridgeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, agentsRes, bridgeRes] = await Promise.allSettled([
        fetch('/api/health').then(r => r.ok ? r.json() : null),
        fetch('/api/agents/status').then(r => r.ok ? r.json() : []),
        fetch('/api/copilot-bridge/stats').then(r => r.ok ? r.json() : null),
      ]);

      if (healthRes.status === 'fulfilled') setHealth(healthRes.value as HealthData);
      if (agentsRes.status === 'fulfilled') {
        const data = agentsRes.value;
        setAgents(Array.isArray(data) ? data as AgentStatus[] : []);
      }
      if (bridgeRes.status === 'fulfilled' && bridgeRes.value) {
        setBridgeStats(bridgeRes.value as BridgeStats);
      }
    } catch {
      // silent — individual fetches handle their own errors
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/copilot-bridge/commands?limit=50');
      if (res.ok) {
        const data = await res.json();
        setCommands(Array.isArray(data) ? data as BridgeCommand[] : []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    void fetchActivity();
    const interval = setInterval(() => {
      void fetchAll();
      void fetchActivity();
    }, 15_000);
    return () => clearInterval(interval);
  }, [fetchAll, fetchActivity]);

  const handleDispatch = async (agentName: string, task: string) => {
    const res = await fetch('/api/agents/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName, task }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    void fetchAll();
    void fetchActivity();
  };

  const handleQuickCommand = async (cmd: QuickCommand) => {
    const res = await fetch(cmd.endpoint, {
      method: cmd.method ?? 'GET',
      headers: cmd.body ? { 'Content-Type': 'application/json' } : undefined,
      body: cmd.body ? JSON.stringify(cmd.body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    toast.success(`${cmd.label}: OK`, { description: JSON.stringify(data).slice(0, 120) });
  };

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Copilot Commander</h2>
            <p className="text-xs text-gray-400">Copilot CLI ↔ BAS Dashboard Bridge • Layer 2</p>
          </div>
        </div>
        <button
          onClick={() => { void fetchAll(); void fetchActivity(); }}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Frissítés"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <OverviewTab
            health={health}
            agents={agents}
            bridgeStats={bridgeStats}
            loading={loading}
            onRefresh={() => void fetchAll()}
          />
        )}
        {activeTab === 'dispatch' && (
          <DispatchTab agents={agents} onDispatch={handleDispatch} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab commands={commands} loading={loading} />
        )}
        {activeTab === 'quick' && (
          <QuickCommandsTab onExecute={handleQuickCommand} />
        )}
      </div>

      {/* Footer status bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700 pt-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${health?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
            Backend {health?.status === 'ok' ? 'online' : 'offline'}
          </span>
          <span>{agents.length} agent regisztrálva</span>
          {bridgeStats && <span>{bridgeStats.totalCommands} bridge parancs</span>}
        </div>
        <span>Auto-refresh: 15s</span>
      </div>
    </div>
  );
}

export default CopilotCommanderPanel;
