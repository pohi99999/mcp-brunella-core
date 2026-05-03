import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Cloud, Globe, RefreshCcw, LayoutGrid, List, Activity, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface WorkerStatus {
  id: string;
  name: string;
  url?: string;
  customDomain?: string;
  status: 'online' | 'offline' | 'unknown';
  latencyMs?: number;
}

interface WorkerTask {
  id: string;
  agent_name?: string;
  instruction?: string;
  task?: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

interface WorkersResponse {
  workers?: WorkerStatus[];
}

interface HistoryResponse {
  tasks?: WorkerTask[];
}

export function CloudflareOrchestrator() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [tasks, setTasks] = useState<WorkerTask[]>([])
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [instruction, setInstruction] = useState('')

  const fetchData = async () => {
    try {
      const [workersRes, tasksRes] = await Promise.all([
        fetch('/api/v1/cloudflare/agents'),
        fetch('/api/v1/cloudflare/history?limit=10')
      ]);

      if (workersRes.ok) {
        const data = await workersRes.json() as WorkersResponse;
        const nextWorkers = data.workers || [];
        setWorkers(nextWorkers);
        setSelectedAgent((current) => current || nextWorkers[0]?.id || '');
      }
      if (tasksRes.ok) {
        const data = await tasksRes.json() as HistoryResponse;
        setTasks(data.tasks || []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült lekérni az Edge adatokat');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDispatch = async () => {
    if (!instruction.trim()) {
      toast.error('Adj meg egy feladatot!');
      return;
    }

    if (!selectedAgent) {
      toast.error('Nincs kiválasztott Cloudflare worker.');
      return;
    }

    setDispatching(selectedAgent);
    try {
      const res = await fetch(`/api/v1/cloudflare/agents/${encodeURIComponent(selectedAgent)}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, context: { source: 'dashboard' } })
      });

      if (res.ok) {
        toast.success(`Feladat elküldve az Edge-re (${selectedAgent})`);
        setInstruction('');
        fetchData();
      } else {
        throw new Error('Dispatch failed');
      }
    } catch (e) {
      toast.error('Hiba a küldés során');
    } finally {
      setDispatching(null);
    }
  }

  if (loading && workers.length === 0) {
    return <Skeleton className="h-[400px] w-full mt-4" />;
  }

  return (
    <Card className="glass-card border-white/[0.04] overflow-hidden mt-4">
      <CardHeader className="pb-3 border-b border-white/[0.04] bg-white/[0.04] flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider uppercase text-zinc-500">
            <Cloud size={16} className="text-cyan-400" />
            Cloudflare Edge Orchestrator v2
          </CardTitle>
          <CardDescription className="text-[10px]">CEAN - Cloudflare Edge Agents Network Control</CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="fleet" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-white/[0.04] bg-transparent h-10 px-4">
            <TabsTrigger value="fleet" className="text-xs data-[state=active]:bg-white/[0.05]">
              <LayoutGrid size={14} className="mr-2" />
              Flotta (16 Agent)
            </TabsTrigger>
            <TabsTrigger value="dispatch" className="text-xs data-[state=active]:bg-white/[0.05]">
              <Zap size={14} className="mr-2" />
              Közvetlen Dispatch
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs data-[state=active]:bg-white/[0.05]">
              <List size={14} className="mr-2" />
              Utolsó Taskok
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fleet" className="m-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y divide-white/5">
                {workers.map(w => (
                  <div key={w.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <Globe size={16} className={w.status === "online" ? "text-green-400" : w.status === "unknown" ? "text-amber-300" : "text-red-400"} />
                      <div className="flex flex-col">
                        <span className="text-sm font-mono text-zinc-200">{w.name}</span>
                        <span className="text-[10px] text-zinc-500">{w.customDomain || w.url || 'URL nincs konfigurálva'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-zinc-400">Latency</span>
                        <span className="text-xs font-mono">{w.latencyMs || 0}ms</span>
                      </div>
                      <Badge variant={w.status === "online" ? "default" : "destructive"} className="text-[10px] h-5">
                        {w.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="dispatch" className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-zinc-500 font-bold">Cél Ágens</label>
              <select 
                className="w-full bg-zinc-900 border border-white/10 rounded h-8 text-xs px-2"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
              >
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-zinc-500 font-bold">Feladat (Task)</label>
              <Input 
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Pl.: Keress B2B leadeket..."
                className="h-10 text-xs bg-zinc-900 border-white/10"
              />
            </div>
            <Button 
              className="w-full h-10 text-xs gap-2"
              disabled={!!dispatching}
              onClick={handleDispatch}
            >
              {dispatching ? <RefreshCcw size={14} className="animate-spin" /> : <Zap size={14} />}
              Küldés az Edge-re
            </Button>
          </TabsContent>

          <TabsContent value="tasks" className="m-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y divide-white/5">
                {tasks.map(t => (
                  <div key={t.id} className="px-4 py-3 hover:bg-white/[0.03]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-cyan-400">{t.agent_name || t.id}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">{t.status}</Badge>
                    </div>
                    <p className="text-[11px] text-zinc-300 line-clamp-1">{t.instruction || t.task || 'Nincs feladatleírás'}</p>
                    <span className="text-[9px] text-zinc-500">{new Date(t.created_at || t.createdAt || Date.now()).toLocaleString()}</span>
                  </div>
                ))}
                {tasks.length === 0 && <div className="p-8 text-center text-xs text-zinc-500">Nincsenek rögzített feladatok.</div>}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
