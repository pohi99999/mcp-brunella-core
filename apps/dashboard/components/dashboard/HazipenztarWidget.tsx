import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createCashEntry,
  getCashEntries,
  getCashSummary,
  type CashEntry,
  type CashEntrySource,
  type CashEntrySummary,
  type CashEntryType,
  updateCashEntry,
} from "@/lib/apiService";
import { toast } from "sonner";
import { BadgeEuro, CheckCircle2, Loader2, RefreshCcw, Wallet } from "lucide-react";

interface CashEntryFormState {
  date: string;
  type: CashEntryType;
  amount: string;
  description: string;
  invoiceNumber: string;
  source: CashEntrySource;
  syncedSheets: boolean;
}

function createInitialFormState(): CashEntryFormState {
  return {
    date: new Date().toISOString().slice(0, 10),
    type: "KP_IN",
    amount: "",
    description: "",
    invoiceNumber: "",
    source: "manual",
    syncedSheets: false,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("hu-HU");
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
      <p className="text-[8px] uppercase font-mono tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function getEntryTone(entry: CashEntry): string {
  return entry.type === "KP_IN" ? "text-emerald-400" : "text-rose-400";
}

export function HazipenztarWidget() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [summary, setSummary] = useState<CashEntrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [form, setForm] = useState<CashEntryFormState>(() => createInitialFormState());

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [entryResponse, summaryResponse] = await Promise.all([
        getCashEntries({ limit: 8, offset: 0 }),
        getCashSummary(),
      ]);
      setEntries(entryResponse.entries);
      setSummary(summaryResponse.summary);
      setError(null);
    } catch (loadError: unknown) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
    const interval = window.setInterval(() => {
      void loadEntries();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadEntries]);

  const summaryTone = useMemo(() => {
    if (!summary) {
      return "text-white";
    }
    return summary.balance >= 0 ? "text-emerald-400" : "text-rose-400";
  }, [summary]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Az összegnek pozitív számnak kell lennie.");
      }

      if (!form.description.trim()) {
        throw new Error("A leírás megadása kötelező.");
      }

      await createCashEntry({
        date: form.date,
        type: form.type,
        amount,
        description: form.description.trim(),
        ...(form.invoiceNumber.trim() ? { invoiceNumber: form.invoiceNumber.trim() } : {}),
        source: form.source,
        syncedSheets: form.syncedSheets,
      });

      toast.success("KP tétel mentve.");
      setForm(createInitialFormState());
      await loadEntries();
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : String(submitError);
      toast.error(`Nem sikerült menteni: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSyncState = async (entry: CashEntry) => {
    setUpdatingId(entry.id);
    try {
      await updateCashEntry(entry.id, { syncedSheets: !entry.syncedSheets });
      toast.success("Szinkron állapot frissítve.");
      await loadEntries();
    } catch (updateError: unknown) {
      const message = updateError instanceof Error ? updateError.message : String(updateError);
      toast.error(`Nem sikerült frissíteni: ${message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card className="glass-card border-white/[0.04] bg-white/[0.03] backdrop-blur-xl h-full flex flex-col">
      <CardHeader className="p-4 border-b border-white/[0.04]">
        <CardTitle className="flex items-center justify-between text-xs font-bold tracking-widest uppercase text-white">
          <span className="flex items-center gap-2">
            <Wallet size={16} className="text-amber-400" />
            Házipénztár
          </span>
          <Badge variant={summary ? "default" : "secondary"} className="text-[9px]">
            {summary ? "LIVE" : "BETÖLTÉS"}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 flex-1 flex flex-col gap-4">
        <div className="rounded-xl border border-white/[0.04] bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">KP összegzés</p>
              <p className="text-[11px] text-zinc-400">
                {summary ? `Frissítve: ${new Date().toLocaleString("hu-HU")}` : loading ? "Adatok betöltése..." : "Nincs elérhető összegzés"}
              </p>
            </div>
            <Badge variant={summary ? "default" : "secondary"} className="text-[9px]">
              {summary ? (summary.balance >= 0 ? "EGYENLEG" : "HIÁNY") : "N/A"}
            </Badge>
          </div>

          {error ? (
            <p className="text-xs text-red-400">{error}</p>
          ) : summary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <SummaryTile label="Összes" value={`${summary.total}`} tone="text-white" />
                <SummaryTile label="Bevétel" value={formatCurrency(summary.income)} tone="text-emerald-400" />
                <SummaryTile label="Kiadás" value={formatCurrency(summary.expense)} tone="text-rose-400" />
                <SummaryTile label="Egyenleg" value={formatCurrency(summary.balance)} tone={summaryTone} />
                <SummaryTile label="Sheetben" value={`${summary.syncedSheets}`} tone="text-sky-400" />
                <SummaryTile label="Függő" value={`${summary.pendingSheets}`} tone="text-amber-400" />
              </div>

              <div className="flex flex-wrap gap-2 text-[10px] uppercase font-mono text-zinc-500">
                <span>KP_IN: {summary.byType.KP_IN}</span>
                <span>KP_OUT: {summary.byType.KP_OUT}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-500">
              {loading ? "Szinkronizálás folyamatban..." : "A pénztár összegzés még nem érhető el."}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Új KP tétel</p>
              <p className="text-[11px] text-zinc-400">Rögzíts manuális, email vagy import alapú pénztári mozgást.</p>
            </div>
            <Badge variant="outline" className="text-[9px]">
              <BadgeEuro size={10} className="mr-1" />
              ÚJ
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cash-date">Dátum</Label>
              <Input
                id="cash-date"
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Típus</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm((current) => ({ ...current, type: value as CashEntryType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Típus kiválasztása" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KP_IN">KP_IN - Bevétel</SelectItem>
                  <SelectItem value="KP_OUT">KP_OUT - Kiadás</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-amount">Összeg</Label>
              <Input
                id="cash-amount"
                type="number"
                min="0"
                step="1"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Forrás</Label>
              <Select
                value={form.source}
                onValueChange={(value) => setForm((current) => ({ ...current, source: value as CashEntrySource }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Forrás kiválasztása" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">manual</SelectItem>
                  <SelectItem value="email">email</SelectItem>
                  <SelectItem value="import">import</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash-description">Leírás</Label>
            <Textarea
              id="cash-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Pl. készpénzes értékesítés, beszerzés, pénztárbizonylat..."
              className="min-h-[88px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cash-invoice">Számlaszám</Label>
              <Input
                id="cash-invoice"
                value={form.invoiceNumber}
                onChange={(event) => setForm((current) => ({ ...current, invoiceNumber: event.target.value }))}
                placeholder="Opcionális"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Sheets szinkron</span>
                <Switch
                  checked={form.syncedSheets}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, syncedSheets: checked }))}
                />
              </Label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20"
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            KP tétel mentése
          </Button>
        </form>

        <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Legutóbbi tételek</p>
              <p className="text-[11px] text-zinc-400">A legfrissebb pénztári mozgások és a Sheets állapota.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadEntries()}
              className="text-zinc-300 hover:text-white"
            >
              <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>

          <div className="space-y-2">
            {entries.length === 0 && !loading ? (
              <p className="text-xs text-zinc-500">Még nincs rögzített KP tétel.</p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-white/[0.04] bg-zinc-950/40 p-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">{entry.description}</p>
                      <p className="text-[11px] text-zinc-500">
                        {formatDate(entry.date)} · {entry.invoiceNumber || "nincs számlaszám"} · {entry.source}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className={`text-[9px] ${getEntryTone(entry)}`}>
                        {entry.type}
                      </Badge>
                      <Badge variant={entry.syncedSheets ? "default" : "secondary"} className="text-[9px]">
                        {entry.syncedSheets ? "Sheetben" : "Várakozó"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-sm font-bold ${getEntryTone(entry)}`}>{formatCurrency(entry.amount)}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-zinc-300 hover:text-white"
                      onClick={() => void toggleSyncState(entry)}
                      disabled={updatingId === entry.id}
                    >
                      {updatingId === entry.id ? (
                        <Loader2 size={12} className="mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} className="mr-1" />
                      )}
                      {entry.syncedSheets ? "Visszavonás" : "Szinkronált"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
