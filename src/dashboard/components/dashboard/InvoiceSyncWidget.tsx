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
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [lastWritten, setLastWritten] = useState<number>(0);
  const [lastDuplicates, setLastDuplicates] = useState<number>(0);
  const [lastSource, setLastSource] = useState<string>("API");
  const [lastFilter, setLastFilter] = useState<string>("N/A");
  const [lastWriteMode, setLastWriteMode] = useState<string>("Append");
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
    if (status === "running") {
      return {
        label: "FUT",
        variant: "secondary" as const,
        className: "bg-blue-500/20 text-blue-200 border border-blue-500/40",
      };
    }
    if (status === "success") {
      return {
        label: "SIKER",
        variant: "secondary" as const,
        className: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40",
      };
    }
    if (status === "error") {
      return {
        label: "HIBA",
        variant: "secondary" as const,
        className: "bg-red-500/20 text-red-200 border border-red-500/40",
      };
    }
    return {
      label: "IDLE",
      variant: "secondary" as const,
      className: "bg-zinc-500/20 text-zinc-200 border border-zinc-500/40",
    };
  }, [status]);

  const efficiency = useMemo(() => {
    if (!lastFetched) return "0%";
    return `${Math.min(100, Math.round((lastWritten / lastFetched) * 100))}%`;
  }, [lastFetched, lastWritten]);

  const durationLabel = useMemo(() => {
    if (!lastDurationMs) return "N/A";
    const seconds = Math.max(1, Math.round(lastDurationMs / 1000));
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${mins}m ${rest}s`;
  }, [lastDurationMs]);

  const handleSync = async () => {
    setStatus("running");
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const filterLabel = overdueOnly
      ? "Lejárt"
      : unpaidOnly
        ? "Nem fizetett"
        : sinceDate
          ? `Dátum: ${sinceDate}`
          : "Minden";
    const writeModeLabel = appendMode
      ? "Append"
      : clearFirst
        ? "Replace + Clear"
        : "Replace";

    setLastFilter(filterLabel);
    setLastWriteMode(writeModeLabel);

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
        setLastDurationMs(Date.now() - startMs);
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
      setLastDurationMs(Date.now() - startMs);
      setStatus("success");
      toast.success("Szinkron sikeres");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Szinkron hiba";
      setLastDurationMs(Date.now() - startMs);
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
          <Badge
            variant={statusBadge.variant}
            className={statusBadge.className}
          >
            {statusBadge.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-[11px] text-zinc-400">
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
            <span className="uppercase text-[10px] text-zinc-500">Szűrő</span>
            <div className="text-zinc-200 font-mono">{lastFilter}</div>
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
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Hatékonyság</span>
            <div className="text-zinc-200 font-mono">{efficiency}</div>
          </div>
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Írás mód</span>
            <div className="text-zinc-200 font-mono">{lastWriteMode}</div>
          </div>
          <div>
            <span className="uppercase text-[10px] text-zinc-500">Időtartam</span>
            <div className="text-zinc-200 font-mono">{durationLabel}</div>
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
            size="sm"
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
