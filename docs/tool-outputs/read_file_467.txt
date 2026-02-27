import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Plus, Trash2, Bell } from 'lucide-react';

interface ScrapeTarget {
  id: string;
  url: string;
  category: string;
  status: 'active' | 'paused' | 'error';
}

export const MarketWatcherConfig: React.FC = () => {
  const [targets, setTargets] = useState<ScrapeTarget[]>([
    { id: '1', url: 'https://example-shop.hu/electronics', category: 'Laptop', status: 'active' },
    { id: '2', url: 'https://another-site.com/deals', category: 'Hardware', status: 'paused' }
  ]);

  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const addTarget = () => {
    if (newUrl && newCategory) {
      const newTarget: ScrapeTarget = {
        id: Date.now().toString(),
        url: newUrl,
        category: newCategory,
        status: 'active'
      };
      setTargets([...targets, newTarget]);
      setNewUrl('');
      setNewCategory('');
    }
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Eye className="w-6 h-6 text-green-500" />
              Green Market Watcher
            </CardTitle>
            <CardDescription>
              Monitorozza a piacot és találja meg a legjobb ajánlatokat automatikusan.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Premium Service
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Új figyelési célpont hozzáadása</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="url">Weboldal URL</Label>
              <Input 
                id="url" 
                placeholder="https://..." 
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategória</Label>
              <Input 
                id="category" 
                placeholder="Pl. GPU, Ingatlan" 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addTarget} className="w-full gap-2">
                <Plus className="w-4 h-4" /> Hozzáadás
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Aktív figyelések</h3>
          <div className="border rounded-md divide-y">
            {targets.map(target => (
              <div key={target.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="space-y-1">
                  <div className="font-medium text-sm">{target.category}</div>
                  <div className="text-xs text-slate-500 truncate max-w-md">{target.url}</div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={target.status === 'active' ? 'default' : 'secondary'}>
                    {target.status === 'active' ? 'Aktív' : 'Szüneteltetve'}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => removeTarget(target.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-50 flex justify-between">
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Bell className="w-3 h-3" />
          Riasztások küldése: Slack (#market-alerts)
        </div>
        <Button variant="outline" size="sm">
          Workflow tesztelése
        </Button>
      </CardFooter>
    </Card>
  );
};

export default MarketWatcherConfig;
