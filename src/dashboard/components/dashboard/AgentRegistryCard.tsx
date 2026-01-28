import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import agentsRegistry from '../../../agents/registry.json';
import { FunnelSimple, MagnifyingGlass, CheckCircle, XCircle } from '@phosphor-icons/react';

type AgentItem = (typeof agentsRegistry)['agents'][number];

export function AgentRegistryCard() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const set = new Set<string>();
    agentsRegistry.agents.forEach(a => a.category && set.add(a.category));
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    return agentsRegistry.agents.filter(agent => {
      if (showOnlyActive && (disabled[agent.name] || agent.status === 'planned')) return false;
      if (category !== 'all' && agent.category !== category) return false;
      if (!query) return true;
      const hay = `${agent.name} ${agent.title ?? ''} ${agent.description ?? ''} ${agent.tags?.join(' ')}`.toLowerCase();
      return hay.includes(query.toLowerCase());
    });
  }, [category, query, showOnlyActive, disabled]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FunnelSimple size={22} className="text-primary" />
          <div>
            <CardTitle>Agypiac – Ügynökök</CardTitle>
            <CardDescription>Ügynök-regiszter: keresés, szűrés, státusz jelzés</CardDescription>
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
              placeholder="Keresés név, szerepkör vagy tag alapján..."
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
                checked={showOnlyActive}
                onCheckedChange={(v) => setShowOnlyActive(v)}
                id="only-active"
              />
              <label htmlFor="only-active" className="cursor-pointer">Csak aktív</label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(agent => {
            const isDisabled = disabled[agent.name] ?? (agent.status === 'planned');
            return (
              <div
                key={agent.name}
                className={`p-4 border rounded-lg bg-card flex flex-col gap-2 ${isDisabled ? 'opacity-70' : ''}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-semibold">{agent.title ?? agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.description ?? ''}</p>
                  </div>
                  <Badge variant="outline" className={isDisabled ? 'text-muted-foreground border-muted-foreground/30' : 'text-green-500 border-green-500/30'}>
                    {isDisabled ? 'Inaktív' : 'Aktív'}
                  </Badge>
                </div>
                <div className="flex gap-2 flex-wrap text-xs">
                  {agent.category && <Badge variant="secondary">{agent.category}</Badge>}
                  {agent.tags?.map(tag => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant={isDisabled ? 'secondary' : 'outline'}
                    className="flex-1 gap-1"
                    onClick={() => setDisabled(prev => ({ ...prev, [agent.name]: !isDisabled }))}
                  >
                    {isDisabled ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {isDisabled ? 'Engedélyezés' : 'Tiltás (lokális)'}
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-muted-foreground text-sm border border-dashed rounded-md p-6">
              Nincs találat a megadott szűrőkkel.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
