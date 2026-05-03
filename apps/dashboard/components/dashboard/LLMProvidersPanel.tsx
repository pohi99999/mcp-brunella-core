import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Play, RefreshCcw, CheckCircle2, XCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import {
  getLLMProviderStatus,
  getLLMModelCatalog,
  getLLMOrchestrationReadiness,
  generateWithAnthropic,
  generateWithGemini,
  generateWithGithubModels,
  generateWithOllama,
  LLMProviderStatus,
  LLMCatalogProvider,
  LLMOrchestrationReadiness,
} from '@/lib/apiService';
import { useWebSocketEvents } from '@/lib/websocketClient';
import { toast } from 'sonner';

interface LLMTestResult {
  provider: string;
  model: string;
  response: string;
  error?: string;
  latency: number;
}

export function LLMProvidersPanel() {
  const [loading, setLoading] = useState(true);
  const [providerStatus, setProviderStatus] = useState<LLMProviderStatus | null>(null);
  const [modelCatalog, setModelCatalog] = useState<LLMCatalogProvider[] | null>(null);
  const [orchestrationReadiness, setOrchestrationReadiness] = useState<LLMOrchestrationReadiness | null>(null);
  const [testResults, setTestResults] = useState<LLMTestResult[]>([]);
  const [testPrompt, setTestPrompt] = useState('Mi a fővárosa Franciaországnak?');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, catalogRes] = await Promise.all([
        getLLMProviderStatus(),
        getLLMModelCatalog().catch(() => ({ providers: [] })),
      ]);
      const readinessRes = await getLLMOrchestrationReadiness().catch(() => null);
      setProviderStatus(statusRes);
      setModelCatalog(catalogRes.providers);
      setOrchestrationReadiness(readinessRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(fetchStatus, 30_000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useWebSocketEvents<LLMProviderStatus>(
    ['llm:provider_status_updated'],
    (message) => {
      setProviderStatus(message.payload);
      toast.info(`LLM szolgáltató státusz frissítve: ${message.payload.providers.map(p => p.name).join(', ')}`);
    }
  );

  const handleTestProvider = useCallback(async (providerId: string, modelId: string) => {
    setTestingProvider(providerId);
    const startTime = Date.now();
    try {
      let response = '';
      switch (providerId) {
        case 'ollama':
          response = await generateWithOllama(testPrompt, modelId);
          break;
        case 'gemini':
          response = await generateWithGemini(testPrompt, modelId);
          break;
        case 'github':
        case 'github-models':
          response = await generateWithGithubModels(testPrompt, modelId);
          break;
        case 'anthropic':
          response = await generateWithAnthropic(testPrompt, modelId);
          break;
        default:
          throw new Error('Ismeretlen LLM szolgáltató');
      }
      const latency = Date.now() - startTime;
      setTestResults(prev => [...prev, { provider: providerId, model: modelId, response, latency }]);
      toast.success(`Sikeres teszt (${providerId})!`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const latency = Date.now() - startTime;
      setTestResults(prev => [...prev, { provider: providerId, model: modelId, response: '', error: message, latency }]);
      toast.error(`Teszt hiba (${providerId}): ${message}`);
    } finally {
      setTestingProvider(null);
    }
  }, [testPrompt]);

  const getProviderModels = (providerId: string) => {
    return modelCatalog?.find(p => p.id === providerId)?.models || [];
  };

  const getProviderDefaultModel = (providerId: string) => {
    return modelCatalog?.find(p => p.id === providerId)?.defaultModel;
  };

  if (loading && !providerStatus) {
    return <div className="p-6 text-center text-zinc-400">Betöltés...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-700 rounded p-4 text-red-300">
          Hiba: {error}
          <Button onClick={fetchStatus} className="ml-4 underline">Újrapróbálás</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🧠 LLM Szolgáltatók és Modellek</h2>
        <Button onClick={fetchStatus} disabled={loading} className="gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          Frissítés
        </Button>
      </div>

      <Card className="glass-card border-white/[0.04] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="text-purple-400" size={20} />
            Teszt Prompt
          </CardTitle>
          <CardDescription className="text-zinc-500">Írj be egy teszt promptot az összes LLM modell kipróbálásához.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input 
            value={testPrompt} 
            onChange={(e) => setTestPrompt(e.target.value)} 
            placeholder="Mi a fővárosa Franciaországnak?" 
            className="bg-white/5 border-white/10 text-zinc-300"
          />
        </CardContent>
      </Card>

      {orchestrationReadiness && (
        <Card className="glass-card border-white/[0.04] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {orchestrationReadiness.summary.status === 'ready' ? (
                <CheckCircle2 className="text-green-500" size={20} />
              ) : (
                <AlertTriangle className="text-amber-400" size={20} />
              )}
              Fő LLM csatorna readiness
            </CardTitle>
            <CardDescription className="text-zinc-500">
              AnythingLLM brunella_main → GitHub Models GPT-4.1 elsődleges → Ollama fallback.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Primary</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{orchestrationReadiness.primary.label}</p>
              <p className="text-xs text-zinc-400">{orchestrationReadiness.primary.apiModel}</p>
              <Badge variant="outline" className={orchestrationReadiness.primary.configured ? 'mt-2 border-emerald-500/30 text-emerald-300' : 'mt-2 border-red-500/30 text-red-300'}>
                {orchestrationReadiness.primary.configured ? `configured (${orchestrationReadiness.primary.tokenEnv})` : 'missing token'}
              </Badge>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Fallback</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{orchestrationReadiness.fallback.label}</p>
              <p className="text-xs text-zinc-400">{orchestrationReadiness.fallback.model}</p>
              <Badge variant="outline" className={orchestrationReadiness.fallback.configured ? 'mt-2 border-emerald-500/30 text-emerald-300' : 'mt-2 border-amber-500/30 text-amber-300'}>
                {orchestrationReadiness.fallback.configured ? 'model available' : 'needs model'}
              </Badge>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">AnythingLLM</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{orchestrationReadiness.anythingllm.workspace.slug}</p>
              <p className="text-xs text-zinc-400">{orchestrationReadiness.anythingllm.baseUrl}</p>
              <Badge variant="outline" className={orchestrationReadiness.anythingllm.workspace.available ? 'mt-2 border-emerald-500/30 text-emerald-300' : 'mt-2 border-amber-500/30 text-amber-300'}>
                {orchestrationReadiness.anythingllm.workspace.available ? 'workspace ready' : 'workspace missing'}
              </Badge>
            </div>
            {orchestrationReadiness.summary.blockers.length > 0 && (
              <div className="md:col-span-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Blokkolók</p>
                <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                  {orchestrationReadiness.summary.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {providerStatus?.providers.map((provider) => (
          <Card key={provider.id} className="glass-card border-white/[0.04] bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {provider.status === 'online' ? <CheckCircle2 className="text-green-500" size={20} /> : <XCircle className="text-red-500" size={20} />}
                {provider.name}
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Státusz: {provider.status.toUpperCase()} | Latency: {provider.latency ?? 'N/A'}ms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-zinc-400">Modell</Label>
                <select 
                  className="mt-1 block w-full rounded-md border border-white/10 bg-white/5 py-2 pl-3 pr-10 text-zinc-300 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  value={getProviderDefaultModel(provider.id) || ''}
                  onChange={(e) => { /* Handle model selection if needed */ }}
                  disabled={!getProviderModels(provider.id).length}
                >
                  {getProviderModels(provider.id).length === 0 && <option value="">Nincs modell</option>}
                  {getProviderModels(provider.id).map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>
              <Button 
                onClick={() => handleTestProvider(provider.id, getProviderDefaultModel(provider.id) || '')}
                disabled={provider.status !== 'online' || testingProvider === provider.id || !getProviderDefaultModel(provider.id)}
                className="w-full gap-2"
              >
                {testingProvider === provider.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Teszt Futtatása
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {testResults.length > 0 && (
        <Card className="glass-card border-white/[0.04] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="text-cyan-400" size={20} />
              Teszt Eredmények
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {testResults.map((result, index) => (
              <div key={index} className={`rounded-md p-3 ${result.error ? 'bg-red-950/30 border border-red-900/40' : 'bg-green-950/30 border border-green-900/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">[{result.provider}] {result.model}</span>
                  <span className="text-xs text-zinc-400">{result.latency}ms</span>
                </div>
                {result.error ? (
                  <p className="mt-1 text-sm text-red-300">Hiba: {result.error}</p>
                ) : (
                  <p className="mt-1 text-sm text-green-300">Válasz: {result.response.slice(0, 150)}...</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default LLMProvidersPanel;
