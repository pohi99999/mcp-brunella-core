/**
 * Service Control Widget - Mission Control 2.0
 * Kapcsolók: Ollama, AnythingLLM, Python Subsystem
 * Státusz: 🟢 Online / 🔴 Offline / 🟡 Starting
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowsClockwise } from '@phosphor-icons/react';
import * as api from '@/lib/apiService';
import type { ServiceState } from '@/lib/apiService';
import { toast } from 'sonner';

const SERVICE_LABELS: Record<string, string> = {
  ollama: 'Ollama',
  anythingllm: 'AnythingLLM',
  python: 'Python Subsystem',
};

const STATUS_EMOJI: Record<string, string> = {
  online: '🟢',
  offline: '🔴',
  starting: '🟡',
  stopping: '🟡',
  unknown: '⚪',
};

export function ServiceControlWidget() {
  const [services, setServices] = useState<ServiceState[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const states = await api.getServiceStatus();
      setServices(states);
    } catch (e) {
      toast.error('Státusz lekérés sikertelen');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (serviceId: string, currentlyOnline: boolean) => {
    if (loading[serviceId]) return;
    setLoading((prev) => ({ ...prev, [serviceId]: true }));

    try {
      if (currentlyOnline) {
        if (serviceId === 'anythingllm') {
          toast.info('AnythingLLM Desktop app – manuálisan zárd be');
          return;
        }
        const result = await api.stopService(serviceId as 'ollama' | 'python');
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await api.startService(serviceId as 'ollama' | 'python' | 'anythingllm');
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      }
      await fetchStatus();
    } catch (e: any) {
      toast.error(e.message || 'Művelet sikertelen');
    } finally {
      setLoading((prev) => ({ ...prev, [serviceId]: false }));
    }
  };

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-zinc-200">
          Rendszervezérlő
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStatus}
          disabled={isRefreshing}
          className="text-zinc-400 hover:text-zinc-200"
        >
          <ArrowsClockwise size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {services.map((svc) => {
          const isOnline = svc.status === 'online';
          const isStarting = svc.status === 'starting' || svc.status === 'stopping';
          const canStop = svc.id !== 'anythingllm' && isOnline;

          return (
            <div
              key={svc.id}
              className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{STATUS_EMOJI[svc.status] || '⚪'}</span>
                <span className="font-mono text-sm text-zinc-300">
                  {SERVICE_LABELS[svc.id] || svc.id}
                </span>
                {isStarting && (
                  <Badge variant="secondary" className="text-xs">
                    {svc.status === 'starting' ? 'Indul...' : 'Leáll...'}
                  </Badge>
                )}
              </div>
              <Switch
                checked={isOnline}
                disabled={loading[svc.id] || isStarting}
                onCheckedChange={() => handleToggle(svc.id, isOnline)}
              />
            </div>
          );
        })}
        {services.length === 0 && (
          <p className="text-sm text-zinc-500">Szolgáltatások betöltése...</p>
        )}
      </CardContent>
    </Card>
  );
}
