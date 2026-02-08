import React, { useState, useEffect } from 'react';
import { Play, Square, Camera, RefreshCw, Terminal, Activity, Globe, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';
import {
    startBrowser,
    stopBrowser,
    getBrowserStatus,
    runRobotkezTest,
    getRobotkezScreenshot,
    getN8nWorkflows,
    BrowserStatus
} from '../lib/apiService';

export function RobotkezPanel() {
    const [status, setStatus] = useState<BrowserStatus>({ active: false });
    const [loading, setLoading] = useState(false);
    const [runningTest, setRunningTest] = useState<number | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [screenshotUrl, setScreenshotUrl] = useState<string>('');
    const [n8nWorkflows, setN8nWorkflows] = useState<any[]>([]);
    const [n8nLoading, setN8nLoading] = useState(false);

    // Refresh status and screenshot
    const refreshData = async () => {
        try {
            // Get Browser Status
            const browserData = await getBrowserStatus();
            setStatus(browserData);

            // Get Screenshot (if active)
            if (browserData.active) {
                setScreenshotUrl(await getRobotkezScreenshot());
            } else {
                setScreenshotUrl('');
            }
        } catch (err: any) {
            console.error(err);
        }
    };

    const fetchN8nWorkflows = async () => {
        setN8nLoading(true);
        try {
            const data = await getN8nWorkflows();
            setN8nWorkflows(data.data || []);
        } catch (err: any) {
            console.error('n8n error:', err);
            // Don't toast on auto-refresh to avoid spam
            if (!n8nLoading) toast.error(`n8n hiba: ${err.message}`);
            setN8nWorkflows([]);
        } finally {
            setN8nLoading(false);
        }
    };

    // Auto-refresh hook
    useEffect(() => {
        refreshData();
        fetchN8nWorkflows();
        const interval = setInterval(() => {
            refreshData();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleStart = async () => {
        setLoading(true);
        try {
            await startBrowser({
                startUrl: "https://google.com", 
                sessionName: "Dashboard Session"
            });
            toast.success("Böngésző elindítva");
            setTimeout(refreshData, 1000);
        } catch (err: any) {
            toast.error(`Hiba: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        setLoading(true);
        try {
            await stopBrowser(status.sessionId || undefined);
            toast.info("Böngésző leállítva");
            setTimeout(refreshData, 1000);
        } catch (err: any) {
            toast.error(`Hiba: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRunTest = async (level: 1 | 2 | 3) => {
        setRunningTest(level);
        setLogs(prev => [...prev, `\n--- Futtatás: Level ${level} teszt ---`]);
        
        try {
            // Start the test and get session ID
            const result = await runRobotkezTest(level);
            const sessionId = result.sessionId;
            
            // Connect to SSE stream
            // Note: This connects directly to Python FastAPI (port 8000)
            const evtSource = new EventSource(`http://localhost:8000/test/logs/${sessionId}`);
            
            evtSource.addEventListener('log', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    // Add timestamp? data.ts is available
                    setLogs(prev => [...prev, `[${data.level?.toUpperCase() || 'INFO'}] ${data.message}`]);
                } catch (err) {
                    console.error('Log parse error:', err);
                }
            });

            evtSource.addEventListener('done', (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data);
                    setLogs(prev => [...prev, `\n--- KÉSZ (Exit: ${data.exitCode}, Idő: ${data.durationMs}ms) ---`]);
                    
                    if (data.status === 'success') {
                        toast.success(`Level ${level} teszt sikeres`);
                    } else {
                        toast.error('Teszt hibával zárult');
                    }
                } catch (err) {
                    console.error('Done parse error:', err);
                } finally {
                    evtSource.close();
                    setRunningTest(null);
                }
            });

            evtSource.onerror = (err) => {
                console.error('SSE Error:', err);
                evtSource.close();
                setRunningTest(null);
            };

        } catch (err: any) {
            toast.error(`Indítási hiba: ${err.message}`);
            setRunningTest(null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Session Control Card */}
            <Card className="lg:col-span-1 shadow-lg border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-primary" />
                            Robotkéz Session
                        </CardTitle>
                        <Badge variant={status.active ? 'default' : 'secondary'} className={status.active ? 'bg-green-500/20 text-green-500 border-green-500/50' : ''}>
                            {status.active ? 'AKTÍV' : 'LEÁLLÍTVA'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button
                            className="flex-1 gap-2"
                            onClick={handleStart}
                            disabled={loading || status.active}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Start
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1 gap-2"
                            onClick={handleStop}
                            disabled={loading || !status.active}
                        >
                            <Square className="w-4 h-4" />
                            Stop
                        </Button>
                    </div>

                    <div className="pt-4 border-t border-primary/10">
                        <CardDescription className="mb-2">Teszt Futtatás (Python Subprocess)</CardDescription>
                        <div className="grid grid-cols-1 gap-2">
                            {[1, 2, 3].map(level => (
                                <Button
                                    key={level}
                                    variant="outline"
                                    className="justify-start gap-2 h-10"
                                    onClick={() => handleRunTest(level as any)}
                                    disabled={runningTest !== null}
                                >
                                    {runningTest === level ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Activity className="w-4 h-4 text-primary" />}
                                    Level {level} Teszt {level === 2 ? '(n8n)' : level === 3 ? '(Monitor)' : '(Navigáció)'}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Live View Card */}
            <Card className="lg:col-span-2 shadow-lg border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <Camera className="w-4 h-4 text-primary" />
                        Élő Nézet (5mp frissítés)
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={refreshData}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="p-0 border-t border-primary/10 bg-black min-h-[300px] flex items-center justify-center relative">
                    {screenshotUrl ? (
                        <img
                            src={screenshotUrl}
                            alt="Robotkéz Screenshot"
                            className="w-full h-auto object-contain cursor-zoom-in transition-transform hover:scale-105"
                            onClick={() => window.open(screenshotUrl, '_blank')}
                        />
                    ) : (
                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                            <Activity className="w-8 h-8 opacity-20" />
                            <span className="text-xs uppercase tracking-widest opacity-50">Nincs aktív kép</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Logs Viewer */}
            <Card className="lg:col-span-2 shadow-lg border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <Terminal className="w-4 h-4 text-primary" />
                        Teszt Napló & Kimenet
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[200px] w-full bg-slate-950 p-4 font-mono text-xs text-green-400">
                        {logs.length === 0 ? (
                            <span className="opacity-30 italic">Üres - Várjuk a kimenetet...</span>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="mb-1 whitespace-pre-wrap">{log}</div>
                            ))
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* n8n Status Card */}
            <Card className="lg:col-span-1 shadow-lg border-primary/20 bg-card/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        n8n Integráció
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchN8nWorkflows} disabled={n8nLoading}>
                        {n8nLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'FRISSÍTÉS'}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-2xl font-bold">{n8nWorkflows.length}</div>
                            <div className="text-xs text-muted-foreground uppercase">Aktív Workflow</div>
                        </div>
                        <Progress value={Math.min(n8nWorkflows.length * 10, 100)} className="h-1 w-20" />
                    </div>

                    <div className="space-y-2">
                        {n8nWorkflows.slice(0, 3).map((wf, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs p-2 bg-secondary/30 rounded border border-primary/5">
                                <span className="font-medium truncate max-w-[120px]">{wf.name}</span>
                                <Badge variant="outline" className="text-[10px] scale-90 h-4 border-primary/20">
                                    {wf.active ? 'LIVE' : 'IDLE'}
                                </Badge>
                            </div>
                        ))}
                        {n8nWorkflows.length === 0 && (
                            <div className="text-xs text-muted-foreground p-2">Nincsenek elérhető workflow-k</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
