// src/dashboard/components/dashboard/AnythingLLMActionBridgePanel.tsx
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import {
  executeAnythingLLMAction,
  getAnythingLLMActionAudit,
  type AnythingLLMActionAuditRecord,
} from '@/lib/apiService';
import { toast } from 'sonner';

const ACTIONS = [
  { value: 'email_triage',     label: 'Email Feldolgozás',       agent: 'InvoiceAutomation', risk: false },
  { value: 'calendar_check',   label: 'Naptár Ellenőrzés',       agent: 'Orchestrator',      risk: false },
  { value: 'document_summary', label: 'Dokumentum Összefoglaló', agent: 'Researcher',         risk: false },
  { value: 'browser_task',     label: 'Böngésző Feladat',        agent: 'RobotkezV2',         risk: true  },
  { value: 'agent_start',      label: 'Agent Indítás',           agent: 'AgentManager',       risk: true  },
];

export function AnythingLLMActionBridgePanel() {
  const [action, setAction] = useState('email_triage');
  const [task, setTask] = useState('');
  const [secret, setSecret] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [audit, setAudit] = useState<AnythingLLMActionAuditRecord[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const data = await getAnythingLLMActionAudit(secret || undefined);
      setAudit(data.records);
    } catch {
      // audit betöltési hiba nem kritikus
    } finally {
      setLoadingAudit(false);
    }
  }, [secret]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  const handleRun = async () => {
    if (!task.trim()) {
      toast.error('Add meg a feladatot');
      return;
    }
    setIsRunning(true);
    try {
      const res = await executeAnythingLLMAction(
        { action, payload: { task } },
        secret || undefined,
      );
      toast.success(`${action} kész`, { description: res.result?.slice(0, 100) });
      await loadAudit();
    } catch (e: unknown) {
      toast.error('Hiba', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsRunning(false);
    }
  };

  const selectedAction = ACTIONS.find((a) => a.value === action);

  return (
    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
        <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold tracking-[0.28em] uppercase text-zinc-400">
          <Zap size={18} />
          AnythingLLM Action Bridge
        </CardTitle>
        <p className="text-xs text-zinc-500 mt-1">
          Endpoint: <code className="text-zinc-300">POST /api/v1/anythingllm/action</code>
        </p>
      </CardHeader>

      <CardContent className="space-y-5 p-4 lg:p-5">
        {/* Secret */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
            BRUNELLA_ACTION_SECRET
          </label>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Hagyd üresen ha nincs beállítva"
            className="glass-card border-white/10 bg-white/[0.03] text-xs"
          />
        </div>

        {/* Action selector */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Action</label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="glass-card border-white/10 bg-white/[0.03]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  <span className="flex items-center gap-2">
                    {a.risk && <AlertTriangle size={12} className="text-orange-400" />}
                    {a.label}
                    <span className="text-xs text-zinc-500">→ {a.agent}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAction?.risk && (
            <p className="text-xs text-orange-400 flex items-center gap-1">
              <AlertTriangle size={12} /> HIGH_RISK művelet — auditban megjelölve
            </p>
          )}
        </div>

        {/* Task input */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Feladat</label>
          <Input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder="Pl.: Feldolgozd a mai emaileket"
            className="glass-card border-white/10 bg-white/[0.03] text-sm"
            disabled={isRunning}
          />
        </div>

        <Button
          onClick={handleRun}
          disabled={isRunning || !task.trim()}
          className="w-full rounded-full border border-white/10 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20"
        >
          <Zap size={16} className={isRunning ? 'animate-pulse' : ''} />
          <span className="ml-2">{isRunning ? 'Futtatás...' : 'Futtatás'}</span>
        </Button>

        {/* Audit log */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              Audit Log ({audit.length})
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadAudit}
              disabled={loadingAudit}
              className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <RefreshCw size={12} className={loadingAudit ? 'animate-spin' : ''} />
            </Button>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {audit.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-4">Nincs rekord</p>
            )}
            {audit.map((rec) => (
              <div
                key={rec.id}
                className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${
                  rec.riskLevel === 'high'
                    ? 'border-orange-500/20 bg-orange-500/[0.04]'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                {rec.success ? (
                  <CheckCircle size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-zinc-300">{rec.action}</span>
                    <span className="text-zinc-600">→ {rec.agent}</span>
                    {rec.riskLevel === 'high' && (
                      <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-[9px] px-1 py-0">
                        HIGH
                      </Badge>
                    )}
                    <span className="text-zinc-600 ml-auto">{rec.durationMs}ms</span>
                  </div>
                  <p className="text-zinc-500 truncate mt-0.5">{rec.resultSummary}</p>
                  <p className="text-zinc-700 text-[10px]">
                    {new Date(rec.timestamp).toLocaleTimeString('hu-HU')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
