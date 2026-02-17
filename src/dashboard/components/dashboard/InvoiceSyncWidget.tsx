import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { executeTool } from "@/lib/apiService";
import { toast } from "sonner";
import { Calendar, RefreshCcw, FileSpreadsheet } from "lucide-react";

const DEFAULT_LIMIT = 100;
const DEFAULT_BATCH = 75;

type SyncStatus = "idle" | "running" | "success" | "error";

type FetchResult = {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
  stats?: Record<string, unknown>;
};

type WriteResult = {
  success: boolean;
  data?: {
    row_count?: number;
    duplicates_skipped?: number;
  };
  error?: string;
};

export function InvoiceSyncWidget() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [lastWritten, setLastWritten] = useState<number>(0);
  const [lastDuplicates, setLastDuplicates] = useState<number>(0);
  const [lastSource, setLastSource] = useState<string>("API");
  const [showOptions, setShowOptions] = useState(false);

  const [sinceDate, setSinceDate] = useState<string>("");
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [appendMode, setAppendMode] = useState(true);
  const [clearFirst, setClearFirst] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [batchSize, setBatchSize] = useState<number>(DEFAULT_BATCH);

  const statusBadge = useMemo(() => {
    if (status === "running") return { label: "RUNNING", variant: "default" as const };
    if (status === "success") return { label: "SUCCESS", variant: "secondary" as const };
    if (status === "error") return { label: "ERROR", variant: "destructive" as const };
    return { label: "IDLE", variant: "secondary" as const };
  }, [status]);

  const handleSync = async () => {
    setStatus("running");
    const startedAt = new Date().toISOString();

    try {
      const fetchResult = (await executeTool("get_szamlazz_invoices", {
        since_date: sinceDate || undefined,
        limit,
        force_refresh: forceRefresh,
        include_unpaid_only: unpaidOnly,
        get_overdue: overdueOnly,
      })) as FetchResult;

      if (!fetchResult.success) {
        throw new Error(fetchResult.error || "Számla lekérés sikertelen");
      }

      const invoices = fetchResult.data ?? [];
      const source =
        (fetchResult.stats?.health as Record<string, unknown> | undefined)?.source ||
        "API";

      setLastSource(typeof source === "string" ? source : "API");
      setLastFetched(invoices.length);

      if (invoices.length === 0) {
        setLastWritten(0);
        setLastDuplicates(0);
        setLastSyncAt(startedAt);
        setStatus("success");
        toast.info("Nincs új számla a szinkronhoz");
        return;
      }

      const writeResult = (await executeTool("write_sheets_invoices", {
        invoices,
        append: appendMode,
        clear_first: clearFirst,
        skip_duplicates: skipDuplicates,
        batch_size: batchSize,
      })) as WriteResult;

      if (!writeResult.success) {
        throw new Error(writeResult.error || "Google Sheets írás sikertelen");
      }

      setLastWritten(writeResult.data?.row_count ?? invoices.length);
      setLastDuplicates(writeResult.data?.duplicates_skipped ?? 0);
      setLastSyncAt(startedAt);
      setStatus("success");
      toast.success("Szinkron sikeres");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Szinkron hiba";
      setStatus("error");
      toast.error(msg);
    }
  };

  return (
    <Card className="glass-card rounded-2xl border-white/5">
      <CardHeader className="p-4 bg-white/5 border-b border-white/5">
        <CardTitle className="flex items-center justify-between text-xs font-bold tracking-widest uppercase text-white">
          <span className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-emerald-400" />
            Invoice Sync
          </span>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-[11px] text-zinc-400">
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Utolsó futás</span>
            <div className="text-zinc-200 font-mono">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "N/A"}
            </div>
          </div>
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Forrás</span>
            <div className="text-zinc-200 font-mono">{lastSource}</div>
          </div>
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Lekért</span>
            <div className="text-zinc-200 font-mono">{lastFetched}</div>
          </div>
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Írt sorok</span>
            <div className="text-zinc-200 font-mono">{lastWritten}</div>
          </div>
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Duplikátum</span>
            <div className="text-zinc-200 font-mono">{lastDuplicates}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            size="sm"
            className="gap-2"
            disabled={status === "running"}
            onClick={handleSync}
          >
            <RefreshCcw size={14} />
            Szinkron indítása
          </Button>

          <Button
            size="xs"
            variant="ghost"
            className="text-[10px] text-zinc-400 justify-start"
            onClick={() => setShowOptions((prev) => !prev)}
          >
            <Calendar size={12} /> {showOptions ? "Haladó opciók elrejtése" : "Haladó opciók"}
          </Button>
        </div>

        {showOptions && (
          <div className="space-y-3 border border-white/5 rounded-xl p-3 bg-black/20">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-500">Dátumtól</label>
                <Input
                  value={sinceDate}
                  onChange={(e) => setSinceDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="h-7 text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500">Limit</label>
                <Input
                  value={String(limit)}
                  onChange={(e) => setLimit(Number(e.target.value) || DEFAULT_LIMIT)}
                  className="h-7 text-[11px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500">Batch</label>
                <Input
                  value={String(batchSize)}
                  onChange={(e) => setBatchSize(Number(e.target.value) || DEFAULT_BATCH)}
                  className="h-7 text-[11px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] text-zinc-400">
              <label className="flex items-center gap-2">
                <Switch checked={unpaidOnly} onCheckedChange={setUnpaidOnly} />
                Csak nem fizetett
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={overdueOnly} onCheckedChange={setOverdueOnly} />
                Csak lejárt
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={forceRefresh} onCheckedChange={setForceRefresh} />
                Cache bypass
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={appendMode} onCheckedChange={setAppendMode} />
                Append mód
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={clearFirst} onCheckedChange={setClearFirst} />
                Clear first
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={skipDuplicates} onCheckedChange={setSkipDuplicates} />
                Skip duplicates
              </label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
