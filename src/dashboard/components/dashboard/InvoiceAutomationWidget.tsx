import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { executeAgent } from "@/lib/apiService";
import { toast } from "sonner";
import { 
  RefreshCcw, 
  FileSpreadsheet, 
  Mail, 
  Search, 
  FileCheck, 
  CheckCircle2, 
  HardDrive,
  AlertTriangle 
} from "lucide-react";

type ProcessStatus = "idle" | "running" | "success" | "error";

export function InvoiceAutomationWidget() {
  const [status, setStatus] = useState<ProcessStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);

  const handleProcess = async () => {
    setStatus("running");
    setProgress(20);
    toast.info("Számlák keresése és feldolgozása elindult...");
    
    try {
      // Execute the new InvoiceAutomation agent
      const res = await executeAgent("InvoiceAutomation", "process all invoices from gmail");
      
      setProgress(100);
      if (res.success) {
        setResult(res.data);
        setStatus("success");
        toast.success(res.message || "Feldolgozás sikeresen befejeződött.");
      } else {
        throw new Error(res.message || "Ismeretlen hiba az ügynök futtatása során.");
      }
    } catch (e: any) {
      console.error("[InvoiceAutomation]", e.message);
      setStatus("error");
      toast.error(`Hiba: ${e.message}`);
    }
  };

  return (
    <Card className="glass-card border-white/[0.04] bg-white/[0.03] backdrop-blur-xl h-full flex flex-col">
      <CardHeader className="p-4 border-b border-white/[0.04]">
        <CardTitle className="flex items-center justify-between text-xs font-bold tracking-widest uppercase text-white">
          <span className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-blue-400" />
            Számla Automatizálás (Vision)
          </span>
          <Badge variant={status === "success" ? "default" : status === "error" ? "destructive" : "secondary"}>
            {status.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Mód</p>
              <p className="text-sm font-medium text-zinc-200">Gmail → Gemini → Drive & Sheets</p>
            </div>
            {status === "running" && (
              <div className="flex items-center gap-2 text-blue-400">
                <RefreshCcw size={14} className="animate-spin" />
                <span className="text-[10px] font-bold uppercase">Folyamatban</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
              <span>Feldolgozás</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1 bg-white/[0.04]" />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StepIcon icon={<Mail size={14} />} label="Gmail" active={status === "running" && progress < 40} done={progress >= 40} />
            <StepIcon icon={<Search size={14} />} label="Vision" active={status === "running" && progress >= 40 && progress < 70} done={progress >= 70} />
            <StepIcon icon={<HardDrive size={14} />} label="Drive" active={status === "running" && progress >= 70 && progress < 90} done={progress >= 90} />
            <StepIcon icon={<FileCheck size={14} />} label="Sheets" active={status === "running" && progress >= 90} done={progress === 100} />
          </div>
        </div>

        <div className="space-y-3">
          {result && (
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/[0.04] space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={14} />
                <span className="text-[10px] font-bold uppercase">Eredmény</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="text-zinc-500 font-mono">Sikeres:</div>
                <div className="text-emerald-400 font-bold text-right">{result.processedCount || 0}</div>
                <div className="text-zinc-500 font-mono">Sikertelen:</div>
                <div className="text-rose-400 font-bold text-right">{result.failedCount || 0}</div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-center gap-3">
              <AlertTriangle size={18} className="text-rose-500" />
              <p className="text-xs text-rose-200">Feldolgozási hiba történt. Ellenőrizd a logokat!</p>
            </div>
          )}

          <Button 
            onClick={handleProcess} 
            disabled={status === "running"}
            className="w-full gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all hover:scale-[1.01]"
          >
            {status === "running" ? <RefreshCcw size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Feldolgozás Indítása
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StepIcon({ icon, label, active, done }: { icon: React.ReactNode, label: string, active: boolean, done: boolean }) {
  return (
    <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${
      done ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : 
      active ? "bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse" : 
      "bg-white/[0.02] border-white/[0.04] text-zinc-600"
    }`}>
      {icon}
      <span className="text-[8px] uppercase font-bold">{label}</span>
    </div>
  );
}
