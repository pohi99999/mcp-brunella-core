import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { useMcpStore } from '@/lib/mcpStore';
import { useMCP } from '@/hooks/useMCP';
import { AgentTool } from '@/lib/types';
import { FunnelSimple, MagnifyingGlass, Play } from '@phosphor-icons/react';
import { toast } from 'sonner';

export function ToolsCard() {
  const { agentTools } = useMcpStore();
  const { runTool } = useMCP();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [onlyNoParams, setOnlyNoParams] = useState(false);
  const [activeTool, setActiveTool] = useState<AgentTool | null>(null);
  const [formValue, setFormValue] = useState<Record<string, string>>({});
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    agentTools.forEach((t) => t.category && set.add(t.category));
    return Array.from(set);
  }, [agentTools]);

  const filtered = useMemo(() => {
    const priority = (t: AgentTool) => {
      const label = t.category?.toLowerCase() ?? '';
      const name = t.name.toLowerCase();
      if (label.includes('github') || name.includes('github')) return 0;
      if (label.includes('a2a') || name.includes('a2a')) return 1;
      if (label.includes('adk') || name.includes('adk') || name.includes('copilot')) return 2;
      if (label.includes('mcp')) return 3;
      if (label.includes('native')) return 4;
      return 5;
    };

    return agentTools
      .filter((tool) => {
        if (category !== 'all' && tool.category !== category) return false;
        if (onlyNoParams && tool.parameters && tool.parameters.length > 0) return false;
        if (quickFilter) {
          const lname = tool.name.toLowerCase();
          const lcat = tool.category?.toLowerCase() ?? '';
          if (quickFilter === 'github' && !(lname.includes('github') || lcat.includes('github'))) return false;
          if (quickFilter === 'a2a' && !(lname.includes('a2a') || lcat.includes('a2a'))) return false;
          if (quickFilter === 'adk' && !(lname.includes('adk') || lname.includes('copilot') || lcat.includes('adk'))) return false;
          if (quickFilter === 'mcp' && !lcat.includes('mcp')) return false;
          if (quickFilter === 'native' && !lcat.includes('native')) return false;
        }
        if (!query) return true;
        const hay = `${tool.name} ${tool.description ?? ''}`.toLowerCase();
        return hay.includes(query.toLowerCase());
      })
      .sort((a, b) => priority(a) - priority(b));
  }, [agentTools, category, query, onlyNoParams]);

  const tagLabel = (tool: AgentTool) => {
    const label = tool.category?.toLowerCase() ?? '';
    const name = tool.name.toLowerCase();
    if (label.includes('a2a') || name.includes('a2a')) return 'a2a';
    if (label.includes('adk') || name.includes('adk') || name.includes('copilot')) return 'ADK';
    if (label.includes('github') || name.includes('github')) return 'GitHub';
    if (label.includes('mcp')) return 'MCP';
    if (label.includes('native')) return 'native';
    return tool.category ?? 'tool';
  };

  const invoke = (tool: AgentTool) => {
    if (tool.parameters && tool.parameters.length > 0) {
      const initVal: Record<string, string> = {};
      tool.parameters.forEach((p) => {
        initVal[p.name] = '';
      });
      setFormValue(initVal);
      setActiveTool(tool);
    } else {
      const id = runTool(tool.name, {});
      toast.info(`Tool elküldve: ${tool.name}`, { description: id ? `id=${id}` : '' });
    }
  };

  const submitForm = () => {
    if (!activeTool) return;
    try {
      const args: any = {};
      activeTool.parameters?.forEach((p) => {
        const raw = formValue[p.name] ?? '';
        if (p.type === 'number') {
          const num = Number(raw);
          if (Number.isNaN(num)) throw new Error(`A(z) ${p.name} számot vár.`);
          args[p.name] = num;
        } else if (p.type === 'boolean') {
          args[p.name] = raw === 'true';
        } else {
          args[p.name] = raw;
        }
      });
      const id = runTool(activeTool.name, args);
      toast.info(`Tool elküldve: ${activeTool.name}`, { description: id ? `id=${id}` : '' });
      setActiveTool(null);
    } catch (e: any) {
      toast.error(e.message || 'Hibás paraméter.');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FunnelSimple size={22} className="text-primary" />
          <div>
            <CardTitle>Tools (ADK / MCP / native)</CardTitle>
            <CardDescription>Elérhető eszközök listázása, gyors futtatás</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlass size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés név vagy leírás alapján..."
              className="pl-7"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded-md px-2 py-1 text-sm bg-background"
            >
              <option value="all">Minden kategória</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={onlyNoParams}
                onCheckedChange={(v) => setOnlyNoParams(v)}
                id="only-no-params"
              />
              <label htmlFor="only-no-params" className="cursor-pointer">Csak paraméter nélküli</label>
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              {['github','a2a','adk','mcp','native'].map(tag => (
                <Button
                  key={tag}
                  size="xs"
                  variant={quickFilter === tag ? 'default' : 'outline'}
                  onClick={() => setQuickFilter(prev => prev === tag ? null : tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((tool) => (
            <div key={tool.id ?? tool.name} className="p-4 border rounded-lg bg-card flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.description ?? ''}</p>
                </div>
                <Badge variant="secondary">{tagLabel(tool)}</Badge>
              </div>
              {tool.parameters && tool.parameters.length > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Paraméterek: {tool.parameters.map(p => p.name).join(', ')}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Nincs paraméter</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-1 gap-2"
                onClick={() => invoke(tool)}
              >
                <Play size={14} /> Futtatás
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-muted-foreground text-sm border border-dashed rounded-md p-6">
              Nincs találat a megadott szűrőkkel.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
      <Dialog open={!!activeTool} onOpenChange={(open) => { if (!open) setActiveTool(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{activeTool?.name}</DialogTitle>
            <DialogDescription>{activeTool?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeTool?.parameters?.map((p) => (
              <div key={p.name} className="space-y-1">
                <Label htmlFor={`param-${p.name}`}>
                  {p.name} {p.required ? '*' : ''} <span className="text-xs text-muted-foreground">({p.type})</span>
                </Label>
                {p.type === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`param-${p.name}`}
                      checked={(formValue[p.name] ?? 'false') === 'true'}
                      onCheckedChange={(v) => setFormValue(prev => ({ ...prev, [p.name]: v ? 'true' : 'false' }))}
                    />
                    <span className="text-sm text-muted-foreground">{(formValue[p.name] ?? 'false') === 'true' ? 'true' : 'false'}</span>
                  </div>
                ) : (p as any).enum && Array.isArray((p as any).enum) ? (
                  <Select
                    value={formValue[p.name] ?? ''}
                    onValueChange={(v) => setFormValue(prev => ({ ...prev, [p.name]: v }))}
                  >
                    <SelectTrigger id={`param-${p.name}`} className="w-full">
                      <SelectValue placeholder="Válassz" />
                    </SelectTrigger>
                    <SelectContent>
                      {(p as any).enum.map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`param-${p.name}`}
                    value={formValue[p.name] ?? ''}
                    onChange={(e) => setFormValue((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    placeholder={p.description || ''}
                  />
                )}
              </div>
            ))}
            {activeTool && (!activeTool.parameters || activeTool.parameters.length === 0) && (
              <p className="text-sm text-muted-foreground">Nincs paraméter ehhez a toolhoz.</p>
            )}
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActiveTool(null)}>Mégse</Button>
            <Button onClick={submitForm}>Futtatás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
