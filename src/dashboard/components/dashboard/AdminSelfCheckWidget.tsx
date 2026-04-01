import React, { useState, useEffect } from 'react';
import { useSystemSignalStore } from "@/store/systemSignalStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  RefreshCcw, 
  ShieldAlert, 
  Activity, 
  Server, 
  Cpu, 
  Globe, 
  Signal,
  Database,
  Lock
} from "lucide-react";
import { toast } from "sonner";
import * as apiService from "@/lib/apiService";
import { useSocket } from "../../context/SocketContext";
import { uiTester, UITestResult } from "../../lib/uiTester";

export function AdminSelfCheckWidget() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [healthData, setHealthStatus] = useState<apiService.HealthStatus | null>(null);
  const [uiTestResults, setUiTestResults] = useState<UITestResult[]>([]);
  const [ping, setPing] = useState<number | null>(null);
  const { addLog, isConnected } = useSystemSignalStore((state) => ({ 
    addLog: state.addLog,
    isConnected: state.isConnected
  }));
  const { socket } = useSocket();

  // Empty string default — if VITE_ADMIN_PASSWORD is not configured the widget
  // will reject every login attempt rather than accepting a guessable fallback.
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

  // WebSocket Latency Check (Ping-Pong)
  useEffect(() => {
    if (!socket || !isConnected) return;

    const interval = setInterval(() => {
      const start = Date.now();
      socket.emit('system:ping', () => {
        setPing(Date.now() - start);
      });
    }, 10000); // 10mp-enként mérjük a késleltetést

    return () => clearInterval(interval);
  }, [socket, isConnected]);

  const handleAuth = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast.success("Hitelesítés sikeres. Üdvözöljük az Adminisztrációs felületen!");
    } else {
      addLog({ message: `Sikertelen admin bejelentkezés (ip: kliens oldali kezéléstár)`, type: 'warn', source: 'AdminSelfCheck' });
      toast.error("Érvénytelen jelszó.");
    }
  };

  const runFullDiagnostics = async () => {
    setIsDiagnosticRunning(true);
    addLog({ message: "Teljes rendszer-öndiagnosztika indítása...", type: "info", source: "SelfCheck" });
    
    try {
      const health = await apiService.checkHealth();
      setHealthStatus(health);
      
      const uiResults = await uiTester.runAllTests();
      setUiTestResults(uiResults);
      
      const allHealthy = Object.values(health.services).every((s: any) => s.status === 'healthy' || s.status === 'ok');
      const allUiPass = uiResults.every(r => r.status === 'pass');
      
      if (allHealthy && allUiPass) {
        toast.success("Minden szerviz és UI komponens optimálisan működik!");
      } else {
        toast.warning("Néhány terület degradált állapotban van.");
      }
      
      addLog({ 
        message: `Diagnosztika kész. Állapot: ${health.status}, Latency: ${ping}ms`, 
        type: health.status === "ok" ? "success" : "warning", 
        source: "SelfCheck" 
      });
    } catch (e: any) {
      toast.error(`Diagnosztikai hiba: ${e.message}`);
    } finally {
      setIsDiagnosticRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'degraded':
      case 'warning':
        return <Activity className="w-4 h-4 text-yellow-500 animate-pulse" />;
      default:
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const renderServiceRow = (name: string, data: any, icon: React.ReactNode) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-primary/5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-background rounded-md">{icon}</div>
        <div>
          <div className="text-sm font-medium capitalize">{name}</div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {data?.latencyMs ? `${data.latencyMs}ms` : 'N/A'} | {data?.error || 'Nincs hiba'}
          </div>
        </div>
      </div>
      <Badge variant="outline" className={data?.status === 'healthy' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-red-500 border-red-500/20 bg-red-500/5'}>
        {data?.status?.toUpperCase() || 'UNKNOWN'}
      </Badge>
    </div>
  );

  return (
    <Card className="h-full shadow-2xl border-orange-500/20 bg-card/50 backdrop-blur-xl">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-full">
              <ShieldAlert size={24} className="text-orange-500" />
            </div>
            <div>
              <CardTitle>System Self-Check</CardTitle>
              <CardDescription>Adminisztrációs és öndiagnosztikai központ</CardDescription>
            </div>
          </div>
          {isAuthenticated && (
            <Badge variant="outline" className="gap-1 px-2 py-1">
              <Signal size={12} className={isConnected ? "text-green-500" : "text-red-500"} />
              {ping ? `${ping}ms` : 'Ping...'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-100px)] overflow-y-auto custom-scrollbar">
        {!isAuthenticated ? (
          <div className="flex flex-col gap-6 p-8 items-center justify-center h-full text-center">
            <div className="p-4 bg-secondary/30 rounded-full">
              <Lock size={48} className="text-zinc-500 opacity-20" />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-lg">Zárt terület</h3>
              <p className="text-sm text-zinc-500">Kérjük, adja meg az adminisztrációs jelszót a diagnosztikai eszközök eléréséhez.</p>
            </div>
            <div className="w-full max-w-xs space-y-3">
              <Input
                id="admin-password"
                type="password"
                placeholder="Jelszó"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                className="text-center bg-background/50 border-primary/20 focus:border-orange-500/50"
              />
              <Button onClick={handleAuth} className="w-full bg-orange-600 hover:bg-orange-700">Hitelesítés</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-3">
              <Button 
                onClick={runFullDiagnostics} 
                disabled={isDiagnosticRunning}
                className="flex-1 gap-2 bg-primary/80 hover:bg-primary"
              >
                {isDiagnosticRunning ? <RefreshCcw className="animate-spin w-4 h-4" /> : <Activity className="w-4 h-4" />}
                Diagnosztika Futtatása
              </Button>
              <Button variant="outline" onClick={() => setIsAuthenticated(false)}>Kilépés</Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {healthData ? (
                <>
                  {renderServiceRow('Ollama (Local LLM)', healthData.services.ollama, <Cpu className="w-4 h-4 text-blue-400" />)}
                  {renderServiceRow('Python Subsystem', healthData.services.python, <Server className="w-4 h-4 text-yellow-400" />)}
                  {renderServiceRow('Cloudflare Edge', healthData.services.cloudflare, <Globe className="w-4 h-4 text-orange-400" />)}
                  {renderServiceRow('AnythingLLM (RAG)', healthData.services.anythingllm, <Database className="w-4 h-4 text-purple-400" />)}
                  {renderServiceRow('Ügynökök állapota', healthData.services.agents, <Activity className="w-4 h-4 text-green-400" />)}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 border-2 border-dashed border-primary/10 rounded-xl">
                  <Search size={32} className="opacity-20 mb-2" />
                  <p className="text-xs uppercase tracking-widest opacity-50">Nincs friss diagnosztikai adat</p>
                </div>
              )}
            </div>

            {healthData && (
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <h4 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Összesített állapot</h4>
                <div className="flex items-center gap-2">
                  {getStatusIcon(healthData.status)}
                  <span className="text-sm font-medium">Rendszer státusz: {healthData.status.toUpperCase()}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Utolsó frissítés: {new Date(healthData.timestamp).toLocaleString()}
                </p>
              </div>
            )}

            {uiTestResults.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-primary/60">UI Integritás Tesztek</h4>
                <div className="grid grid-cols-1 gap-2">
                  {uiTestResults.map((test, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2 bg-secondary/10 rounded-md border border-primary/5">
                      <span className="font-medium">{test.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-40">{test.durationMs}ms</span>
                        <Badge variant="outline" className={test.status === 'pass' ? 'text-emerald-500 border-emerald-500/20' : 'text-red-500 border-red-500/20'}>
                          {test.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Search = ({ size, className }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);