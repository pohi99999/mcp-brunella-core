/**
 * SettingsPanel - Beállítások és parancsok interaktív kezelése
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ServiceControlWidget } from './ServiceControlWidget';
import { ModelSelector, type ModelProvider } from './ModelSelector';
import { PAIOSConfigDisplay } from './PAIOSConfigDisplay';
import { Settings, RefreshCw, Terminal, Zap, Brain, FileCode2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCloudflareConfig } from '@/lib/apiService';

export function SettingsPanel ()
{
  const [defaultModel, setDefaultModel] = useState<ModelProvider>( 'gemini' );

  const handleModelChange = ( provider: ModelProvider ) =>
  {
    setDefaultModel( provider );
    // Save to localStorage
    localStorage.setItem( 'paios_default_model', provider );
    toast.success( `Model provider changed to: ${ provider }` );
  };

  const openTunnelDashboard = async () =>
  {
    try
    {
      const config = await getCloudflareConfig();
      if ( !config.tunnel.enabled || !config.tunnel.dashboardUrl )
      {
        toast.error( 'Tunnel dashboard URL nincs beállítva (.env: CLOUDFLARE_TUNNEL_DASHBOARD_URL)' );
        return;
      }

      window.open( config.tunnel.dashboardUrl, '_blank', 'noopener,noreferrer' );
    } catch ( error: unknown )
    {
      const message = error instanceof Error ? error.message : String( error );
      toast.error( `Cloudflare config hiba: ${ message }` );
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-transparent border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium text-zinc-200">
            <Settings size={ 18 } className="text-emerald-500" />
            Rendszerbeállítások
          </CardTitle>
          <p className="text-sm text-zinc-500">
            Szolgáltatások indítása/leállítása és gyors parancsok
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ServiceControlWidget />

          <Separator className="bg-zinc-800" />

          {/* PAIOS Model Provider Selection */ }
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <Brain size={ 16 } className="text-blue-500" />
              PAIOS Model Provider
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Alapértelmezett LLM provider a PAIOS Orchestrator számára
            </p>
            <ModelSelector
              value={ defaultModel }
              onChange={ handleModelChange }
              showHealth={ true }
              className="max-w-sm"
            />
          </div>

          <Separator className="bg-zinc-800" />

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <Zap size={ 16 } />
              Gyors parancsok
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={ () => window.open( '/api-docs', '_blank' ) }
              >
                <Terminal size={ 14 } className="mr-1" />
                API Docs
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={ () => window.location.reload() }
              >
                <RefreshCw size={ 14 } className="mr-1" />
                Oldal frissítés
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={ openTunnelDashboard }
              >
                <Terminal size={ 14 } className="mr-1" />
                Tunnel Dashboard
              </Button>
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* PAIOS Unified Config Display */ }
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
              <FileCode2 size={ 16 } className="text-cyan-500" />
              PAIOS Unified Config
            </h3>
            <p className="text-xs text-zinc-500 mb-3">
              Betöltött konfiguráció: paios.config.yaml
            </p>
            <PAIOSConfigDisplay />
          </div>

          <Separator className="bg-zinc-800" />

          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">Beágyazott szolgáltatások</h3>
            <p className="text-xs text-zinc-500 mb-2">
              n8n és Langflow URL-jei (ha nem localhost):
            </p>
            <div className="space-y-2 text-sm text-zinc-400">
              <p className="font-mono">n8n: localhost:5678</p>
              <p className="font-mono">Langflow: localhost:7860</p>
              <p className="text-xs text-zinc-600 mt-2">
                A .env-ben N8N_TEST_URL, LANGFLOW_URL állítható (ha szükséges).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
