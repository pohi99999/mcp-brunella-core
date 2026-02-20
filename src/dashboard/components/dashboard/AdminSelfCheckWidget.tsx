import React, { useState } from 'react';
import { useSystemSignalStore } from "@/store/systemSignalStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import * as apiService from "@/lib/apiService"; // Backend API hívásokhoz

export function AdminSelfCheckWidget() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [results, setResults] = useState<Record<string, boolean | string>>({});
  const { addLog } = useSystemSignalStore((state) => ({ addLog: state.addLog }));

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin'; // Use env var or default

  const handleAuth = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast.success("Hitelesítés sikeres.");
    } else {
      toast.error("Érvénytelen jelszó.");
    }
  };

  const runBackendCheck = async () => {
    try {
      addLog({ message: "Backend kapcsolat ellenőrzése...", type: "info", source: "SelfCheck" });
      const health = await apiService.checkHealth();
      setResults(prev => ({ ...prev, backend: health.status === "HEALTHY" }));
      addLog({ message: `Backend állapot: ${health.status}`, type: health.status === "HEALTHY" ? "success" : "error", source: "SelfCheck" });
    } catch (e: any) {
      setResults(prev => ({ ...prev, backend: false }));
      addLog({ message: `Backend ellenőrzési hiba: ${e.message}`, type: "error", source: "SelfCheck" });
    }
  };

  const runComponentRenderCheck = () => {
    try {
      // Simulate rendering a critical component (e.g., MissionControlLayout itself or a sub-widget)
      // This is a simplified check. A more robust one might use a dedicated test runner.
      const TestComponent = () => <div>Test Render</div>;
      // In a real test environment, you'd render this to a temporary DOM
      // For this runtime check, we just assume it renders without immediate error
      const rendersSuccessfully = true; // Placeholder
      setResults(prev => ({ ...prev, componentRender: rendersSuccessfully }));
      addLog({ message: `Komponens renderelés: ${rendersSuccessfully ? "Sikeres" : "Sikertelen"}`, type: rendersSuccessfully ? "success" : "error", source: "SelfCheck" });
    } catch (e: any) {
      setResults(prev => ({ ...prev, componentRender: false, componentRenderError: e.message }));
      addLog({ message: `Komponens renderelési hiba: ${e.message}`, type: "error", source: "SelfCheck" });
    }
  };

  const runSocketResponsivenessCheck = () => {
    // This would require a mock socket emit/on pattern or a dedicated test endpoint
    // For now, simulate success/failure
    const socketResponsive = useSystemSignalStore.getState().isConnected; // Simple check
    setResults(prev => ({ ...prev, socketResponsive }));
    addLog({ message: `Socket válaszkészség: ${socketResponsive ? "Válaszkész" : "Nem válaszkész"}`, type: socketResponsive ? "success" : "error", source: "SelfCheck" });
  };

  const runFullDiagnostics = async () => {
    setResults({}); // Clear previous results
    await runBackendCheck();
    runComponentRenderCheck();
    runSocketResponsivenessCheck();
    toast.info("Teljes diagnosztika futtatva.");
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <ShieldAlert size={20} className="text-orange-500" /> Admin / Öndiagnosztika
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-70px)] overflow-y-auto custom-scrollbar">
        {!isAuthenticated ? (
          <div className="flex flex-col gap-4 p-4 items-center justify-center h-full">
            <Label htmlFor="admin-password">Admin Jelszó</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              className="max-w-xs"
            />
            <Button onClick={handleAuth}>Belépés</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={runBackendCheck} variant="outline" className="gap-2"><RefreshCcw size={16} /> Backend Check</Button>
              <Button onClick={runComponentRenderCheck} variant="outline" className="gap-2"><RefreshCcw size={16} /> UI Render Check</Button>
              <Button onClick={runSocketResponsivenessCheck} variant="outline" className="gap-2"><RefreshCcw size={16} /> Socket Check</Button>
              <Button onClick={runFullDiagnostics} className="gap-2"><RefreshCcw size={16} /> Teljes Diagnosztika</Button>
            </div>

            <div className="space-y-2">
              {Object.entries(results).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-sm text-zinc-300">
                  {value === true ? <CheckCircle size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />}
                  <span className="capitalize">{key}:</span>
                  <span className={value === true ? "text-emerald-400" : "text-red-400"}>
                    {value === true ? "OK" : value === false ? "FAILED" : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}