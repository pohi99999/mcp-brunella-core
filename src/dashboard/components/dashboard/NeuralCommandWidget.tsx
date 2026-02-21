/**
 * NeuralCommandWidget - Natural Language Task Execution
 *
 * Magyar nyelvű parancs doboz az Enterprise Orchestrator számára.
 * Természetes nyelven írt feladatokat küld az /api/enterprise/execute endpoint-ra.
 *
 * @track cloudflare_workers_ai_20260221
 * @phase Natural Language Task Routing - Dashboard
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Zap, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface ExecutionResult {
    status: string;
    result: any;
    executedAt: string;
}

export function NeuralCommandWidget() {
    const [command, setCommand] = useState('');
    const [executing, setExecuting] = useState(false);
    const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);

    const predefinedTasks = [
        { icon: '🔍', label: 'Projekt Státusz', value: 'Ellenőrizd a projekt státuszát és add meg a track-ek összefoglalóját' },
        { icon: '📊', label: 'Tesztek Futtatása', value: 'Futtasd le az összes tesztet és készíts összefoglalót' },
        { icon: '🌐', label: 'Webes Kutatás', value: 'Keress rá az AI fejlesztések legfrissebb híreire' },
        { icon: '💻', label: 'Kód Generálás', value: 'Készíts Python scriptet CSV fájl beolvasására és elemzésére' },
    ];

    const handleExecute = async () => {
        if (!command.trim()) {
            toast.error('Írd le a feladatot!');
            return;
        }

        setExecuting(true);
        setLastResult(null);

        try {
            const response = await fetch('/api/enterprise/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: command.trim(),
                    context: {},
                }),
            });

            const text = await response.text();
            const data = text ? JSON.parse(text) : {};

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            setLastResult(data);

            if (data.status === 'success') {
                toast.success('Feladat végrehajtva!', {
                    description: formatResultPreview(data.result),
                });
            } else {
                toast.error('Hiba történt', {
                    description: data.error || 'Ismeretlen hiba',
                });
            }
        } catch (error: any) {
            toast.error('API hiba', {
                description: error.message,
            });
            console.error('Execution error:', error);
        } finally {
            setExecuting(false);
        }
    };

    const handlePredefined = (value: string) => {
        setCommand(value);
    };

    const formatResultPreview = (result: any): string => {
        if (typeof result === 'string') {
            return result.substring(0, 100);
        }

        if (result?.message) {
            return result.message.substring(0, 100);
        }

        return 'Sikeresen végrehajtva';
    };

    const formatResultDisplay = (result: any): string => {
        if (typeof result === 'string') {
            return result;
        }

        if (result?.status && result?.message) {
            return `${result.status}: ${result.message}`;
        }

        return JSON.stringify(result, null, 2);
    };

    const formatTimestamp = (timestamp: string): string => {
        const date = new Date(timestamp);
        return date.toLocaleString('hu-HU');
    };

    return (
        <Card className="col-span-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-500" />
                        <CardTitle>Magyar Parancs Végrehajtás</CardTitle>
                    </div>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20">
                        Neural Router
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Command Input */}
                <div className="space-y-2">
                    <Textarea
                        placeholder="Írd le magyarul a feladatot... (pl. 'Keress rá az AI hírekre')"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                                e.preventDefault();
                                handleExecute();
                            }
                        }}
                        className="min-h-[80px] resize-none"
                        disabled={executing}
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Ctrl + Enter küldés</span>
                        <span>{command.length} karakter</span>
                    </div>
                </div>

                {/* Predefined Tasks */}
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Gyors parancsok:</p>
                    <div className="flex flex-wrap gap-2">
                        {predefinedTasks.map((task, index) => (
                            <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => handlePredefined(task.value)}
                                disabled={executing}
                                className="text-sm"
                            >
                                <span className="mr-1">{task.icon}</span>
                                {task.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Execute Button */}
                <Button
                    onClick={handleExecute}
                    disabled={executing || !command.trim()}
                    className="w-full"
                >
                    {executing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Végrehajtás folyamatban...
                        </>
                    ) : (
                        <>
                            <Zap className="mr-2 h-4 w-4" />
                            Feladat Végrehajtása
                        </>
                    )}
                </Button>

                {/* Last Result */}
                {lastResult && (
                    <div className="space-y-2 rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                            {lastResult.status === 'success' ? (
                                <>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="font-medium text-green-700 dark:text-green-400">
                                        Sikeres végrehajtás
                                    </span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                    <span className="font-medium text-red-700 dark:text-red-400">
                                        Hiba történt
                                    </span>
                                </>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground">
                                {formatTimestamp(lastResult.executedAt)}
                            </span>
                        </div>

                        <div className="rounded bg-muted/50 p-3">
                            <pre className="whitespace-pre-wrap text-sm">
                                {formatResultDisplay(lastResult.result)}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Info Banner */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-900/20">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                        <strong>ℹ️ Használat:</strong> Írj bármilyen feladatot magyarul, az OrchestratorAgent
                        automatikusan irányít a megfelelő ügynökhöz (Robotkéz, Developer, Researcher, stb.)
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
