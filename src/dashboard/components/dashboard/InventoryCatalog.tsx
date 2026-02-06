/**
 * Agent & Tool Catalog - Mission Control 2.0
 * Bento Grid: Agents + Tools, Test Run modal
 * Adatforrás: GET /api/agents, GET /api/tools
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Robot, Wrench, Play, MagnifyingGlass } from '@phosphor-icons/react';
import * as api from '@/lib/apiService';
import { toast } from 'sonner';

interface AgentDef {
  name: string;
  description?: string;
  role?: string;
  status?: string;
}

interface ToolDef {
  id?: string;
  name: string;
  description?: string;
  parameters?: { name: string; type: string; required?: boolean }[];
  category?: string;
}

export function InventoryCatalog() {
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [tools, setTools] = useState<ToolDef[]>([]);
  const [query, setQuery] = useState('');
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});
  const [runningTool, setRunningTool] = useState(false);

  useEffect(() => {
    api.getAgents().then(setAgents).catch(() => setAgents([]));
    api.getTools().then((data) => setTools(Array.isArray(data) ? data : data?.tools || [])).catch(() => setTools([]));
  }, []);

  const filteredAgents = agents.filter(
    (a) =>
      !query ||
      `${a.name} ${a.description || ''} ${a.role || ''}`.toLowerCase().includes(query.toLowerCase())
  );
  const filteredTools = tools.filter(
    (t) =>
      !query ||
      `${t.name} ${t.description || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const runTool = async () => {
    if (!activeTool) return;
    setRunningTool(true);
    try {
      const args: Record<string, unknown> = {};
      activeTool.parameters?.forEach((p) => {
        const v = toolArgs[p.name] ?? '';
        if (p.type === 'number') args[p.name] = Number(v) || 0;
        else if (p.type === 'boolean') args[p.name] = v === 'true';
        else args[p.name] = v;
      });
      const result = await api.executeTool(activeTool.name, args);
      toast.success('Tool lefuttatva', {
        description: typeof result === 'string' ? result.slice(0, 80) + '...' : JSON.stringify(result).slice(0, 80),
      });
      setActiveTool(null);
    } catch (e: any) {
      toast.error(e.message || 'Tool futtatás sikertelen');
    } finally {
      setRunningTool(false);
    }
  };

  const openToolModal = (tool: ToolDef) => {
    const init: Record<string, string> = {};
    tool.parameters?.forEach((p) => (init[p.name] = ''));
    setToolArgs(init);
    setActiveTool(tool);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés ügynök vagy eszköz..."
            className="pl-8 bg-zinc-900/60 border-zinc-800"
          />
        </div>
      </div>

      <Tabs defaultValue="agents" className="w-full">
        <TabsList className="bg-zinc-900/60 border border-zinc-800">
          <TabsTrigger value="agents" className="gap-2">
            <Robot size={16} />
            Ügynökök ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-2">
            <Wrench size={16} />
            Eszközök ({tools.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => (
              <Card key={agent.name} className="border-zinc-800/80 bg-zinc-950/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Robot size={16} className="text-emerald-400" />
                    </div>
                    <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2">{agent.description || agent.role}</p>
                  <Badge variant="outline" className="w-fit text-xs">
                    {agent.status || 'loaded'}
                  </Badge>
                </CardHeader>
              </Card>
            ))}
            {filteredAgents.length === 0 && (
              <p className="col-span-full text-sm text-zinc-500">Nincs ügynök</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tools" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTools.map((tool) => (
              <Card key={tool.id || tool.name} className="border-zinc-800/80 bg-zinc-950/60">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-medium">{tool.name}</CardTitle>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{tool.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {tool.category || 'tool'}
                    </Badge>
                  </div>
                  {tool.parameters && tool.parameters.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tool.parameters.map((p) => (
                        <Badge key={p.name} variant="outline" className="text-[10px]">
                          {p.name}: {p.type}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 gap-1"
                    onClick={() => openToolModal(tool)}
                  >
                    <Play size={12} />
                    Test Run
                  </Button>
                </CardHeader>
              </Card>
            ))}
            {filteredTools.length === 0 && (
              <p className="col-span-full text-sm text-zinc-500">Nincs eszköz</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!activeTool} onOpenChange={(o) => !o && setActiveTool(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle>{activeTool?.name}</DialogTitle>
            <DialogDescription>{activeTool?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeTool?.parameters?.map((p) => (
              <div key={p.name} className="space-y-1">
                <Label className="text-zinc-400">
                  {p.name} {p.required && '*'}
                </Label>
                <Input
                  value={toolArgs[p.name] ?? ''}
                  onChange={(e) => setToolArgs((prev) => ({ ...prev, [p.name]: e.target.value }))}
                  placeholder={`${p.type}`}
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
            ))}
            {activeTool && (!activeTool.parameters || activeTool.parameters.length === 0) && (
              <p className="text-sm text-zinc-500">Nincs paraméter</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveTool(null)}>
              Mégse
            </Button>
            <Button onClick={runTool} disabled={runningTool}>
              {runningTool ? 'Futtatás...' : 'Futtatás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
