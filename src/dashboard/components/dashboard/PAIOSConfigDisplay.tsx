/**
 * PAIOS Config Display - Read-only view of paios.config.yaml
 * 
 * Displays current PAIOS configuration loaded from paios.config.yaml.
 * Shows orchestrator settings, enabled providers, and Phoenix config.
 * 
 * @track paios_unified_config_20260223
 */

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileCode2, CheckCircle2, XCircle } from 'lucide-react';

interface PAIOSConfigData {
    orchestrator: {
        default_model: string;
        max_tasks_per_request: number;
    };
    providers: Record<string, {
        enabled: boolean;
        model: string;
    }>;
    phoenix?: {
        retry_max_attempts: number;
        checkpoint_interval_ms: number;
    };
    dashboard?: {
        chat_panel_enabled: boolean;
        phoenix_events_enabled: boolean;
        model_selector_enabled: boolean;
    };
}

export function PAIOSConfigDisplay() {
    const [config, setConfig] = useState<PAIOSConfigData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch('/api/paios/config');
                if (!response.ok) {
                    throw new Error('Failed to load config');
                }
                const data = await response.json();
                setConfig(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-muted-foreground">Loading config...</span>
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="text-xs text-zinc-500 font-mono p-3 bg-zinc-900/50 rounded border border-zinc-800">
                <p>⚠️ Config not loaded: {error || 'Unknown error'}</p>
                <p className="mt-2">Using .env fallback</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[400px] w-full">
            <div className="space-y-4 text-xs">
                {/* Orchestrator */}
                <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                        <FileCode2 className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-zinc-300">Orchestrator</span>
                    </div>
                    <div className="space-y-1 font-mono text-zinc-400">
                        <p>default_model: <Badge variant="outline">{config.orchestrator.default_model}</Badge></p>
                        <p>max_tasks: {config.orchestrator.max_tasks_per_request}</p>
                    </div>
                </div>

                {/* Providers */}
                <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                        <FileCode2 className="w-4 h-4 text-purple-500" />
                        <span className="font-semibold text-zinc-300">Providers</span>
                    </div>
                    <div className="space-y-2">
                        {Object.entries(config.providers).map(([name, provider]) => (
                            <div key={name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {provider.enabled ? (
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    ) : (
                                        <XCircle className="w-3 h-3 text-red-500" />
                                    )}
                                    <span className="font-mono text-zinc-400">{name}</span>
                                </div>
                                <span className="text-zinc-500 font-mono text-xs">{provider.model}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Phoenix */}
                {config.phoenix && (
                    <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <FileCode2 className="w-4 h-4 text-orange-500" />
                            <span className="font-semibold text-zinc-300">Phoenix Protocol</span>
                        </div>
                        <div className="space-y-1 font-mono text-zinc-400">
                            <p>retry_max: {config.phoenix.retry_max_attempts}</p>
                            <p>checkpoint_interval: {config.phoenix.checkpoint_interval_ms}ms</p>
                        </div>
                    </div>
                )}

                {/* Dashboard */}
                {config.dashboard && (
                    <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800">
                        <div className="flex items-center gap-2 mb-2">
                            <FileCode2 className="w-4 h-4 text-teal-500" />
                            <span className="font-semibold text-zinc-300">Dashboard</span>
                        </div>
                        <div className="space-y-1 text-zinc-400">
                            {Object.entries(config.dashboard).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-2">
                                    {typeof value === 'boolean' ? (
                                        value ? (
                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        ) : (
                                            <XCircle className="w-3 h-3 text-red-500" />
                                        )
                                    ) : null}
                                    <span className="font-mono text-xs">{key}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="text-xs text-zinc-600 mt-4">
                    📄 Config file: <code className="font-mono">paios.config.yaml</code>
                </p>
            </div>
        </ScrollArea>
    );
}
