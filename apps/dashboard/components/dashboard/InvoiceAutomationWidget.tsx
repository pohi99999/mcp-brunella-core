import { useState, useEffect, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { executeAgent } from "@/lib/apiService";
import { toast } from "sonner";
import
  {
    RefreshCcw,
    FileSpreadsheet,
    Mail,
    Search,
    FileCheck,
    CheckCircle2,
    HardDrive,
    AlertTriangle,
    History
  } from "lucide-react";

type ProcessStatus = "idle" | "running" | "success" | "error";

type InvoiceAutomationResult = {
  processedCount?: number;
  failedCount?: number;
};

interface Invoice {
  id: string;
  partnerName?: string;
  amount?: number;
  currency?: string;
  status: string;
  updatedAt: string;
}

export function InvoiceAutomationWidget ()
{
  const [status, setStatus] = useState<ProcessStatus>( "idle" );
  const [progress, setProgress] = useState( 0 );
  const [result, setResult] = useState<InvoiceAutomationResult | null>( null );
  const [history, setHistory] = useState<Invoice[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/v1/bookkeeping/invoices?limit=5');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.invoices || []);
      }
    } catch (e) {
      console.error("Failed to fetch invoice history", e);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleProcess = async () =>
  {
    setResult( null );
    setStatus( "running" );
    setProgress( 20 );
    toast.info( "Számlák keresése és feldolgozása elindult..." );

    try
    {
      // Execute the new InvoiceAutomation agent
      const res = await executeAgent( "InvoiceAutomation", "process all invoices from gmail" ) as {
        success?: boolean;
        message?: string;
        data?: InvoiceAutomationResult;
      };

      setProgress( 100 );
      if ( res.success )
      {
        setResult( res.data ?? null );
        setStatus( "success" );
        toast.success( res.message || "Feldolgozás sikeresen befejeződött." );
        fetchHistory();
      } else
      {
        throw new Error( res.message || "Ismeretlen hiba az ügynök futtatása során." );
      }
    } catch ( error: unknown )
    {
      const message = error instanceof Error ? error.message : String( error );
      console.error( "[InvoiceAutomation]", message );
      setStatus( "error" );
      toast.error( `Hiba: ${ message }` );
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
              <p className="text-sm font-medium text-zinc-200">L5 Zero-Touch Pipeline</p>
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
              <span>Pipeline Progress</span>
              <span>{Math.round( progress )}%</span>
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

        <div className="space-y-4">
          {history.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <History size={14} />
                <span className="text-[10px] font-bold uppercase">Legutóbbi számlák</span>
              </div>
              <div className="space-y-1.5">
                {history.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-zinc-200 font-medium truncate max-w-[120px]">{inv.partnerName || "Ismeretlen"}</span>
                      <span className="text-[9px] text-zinc-500 font-mono">{new Date(inv.updatedAt).toLocaleTimeString('hu-HU')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-300">{inv.amount} {inv.currency}</span>
                      <Badge className="text-[8px] h-4 px-1" variant={inv.status === 'COMPLETED' ? 'default' : inv.status === 'FAILED' ? 'destructive' : 'secondary'}>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-3">
              <div className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <p className="text-xs font-medium uppercase tracking-wider">Eredmény</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                  <p className="text-[9px] uppercase font-mono text-zinc-500">Sikeres:</p>
                  <p className="text-sm font-bold text-emerald-300">{result.processedCount ?? 0}</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                  <p className="text-[9px] uppercase font-mono text-zinc-500">Sikertelen:</p>
                  <p className="text-sm font-bold text-rose-300">{result.failedCount ?? 0}</p>
                </div>
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

function StepIcon ( { icon, label, active, done }: { icon: ReactNode, label: string, active: boolean, done: boolean } )
{
  return (
    <div className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${ done ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
        active ? "bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse" :
          "bg-white/[0.02] border-white/[0.04] text-zinc-600"
      }`}>
      {icon}
      <span className="text-[8px] uppercase font-bold">{label}</span>
    </div>
  );
}
