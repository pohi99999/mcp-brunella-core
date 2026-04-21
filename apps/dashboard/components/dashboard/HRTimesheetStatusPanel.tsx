import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, CalendarDays, ClipboardList, RefreshCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getHRTimesheetStatusSnapshot } from '@/lib/hrTimesheetApi';
import type { HRTimesheetStatusSnapshot } from '@/types/hrTimesheetStatus';

function badgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') {
    return 'default';
  }
  if (status === 'failed') {
    return 'destructive';
  }
  if (status === 'in_progress') {
    return 'outline';
  }
  return 'secondary';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('hu-HU').format(value);
}

function formatHours(value: number): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'n/a';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('hu-HU');
}

function SummaryStat({
  label,
  value,
  detail,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ClipboardList;
  testId: string;
}) {
  return (
    <div data-testid={testId} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-all duration-200 hover:border-white/10">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-cyan-300" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-zinc-100">{value}</div>
      <p className="mt-1 text-[11px] text-zinc-500">{detail}</p>
    </div>
  );
}

export function HRTimesheetStatusPanel() {
  const [snapshot, setSnapshot] = useState<HRTimesheetStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await getHRTimesheetStatusSnapshot();
      setSnapshot(response.snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`HR timesheet status hiba: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
    const interval = window.setInterval(() => {
      void loadSnapshot();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [loadSnapshot]);

  if (loading && !snapshot) {
    return <div className="p-6 text-sm text-zinc-500">HR timesheet státusz betöltése...</div>;
  }

  if (error && !snapshot) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
        Hiba: {error}
        <button className="ml-3 underline" onClick={() => void loadSnapshot()}>
          Újrapróbálás
        </button>
      </div>
    );
  }

  return (
    <Card className="glass-card overflow-hidden border-white/10 shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]" data-testid="hr-timesheet-status-panel">
      <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-cyan-300" />
            HR Timesheet & Culture
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]"
            onClick={() => void loadSnapshot()}
            aria-label="HR timesheet státusz frissítése"
          >
            <RefreshCcw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription className="text-zinc-500">
          Read-only snapshot of the current timesheet entry, export, and culture alert state.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 p-4 lg:p-5">
        {error && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryStat testId="hr-timesheet-stat-entries" label="Entries" value={formatNumber(snapshot?.counts.entries ?? 0)} detail="Timesheet records" icon={ClipboardList} />
          <SummaryStat testId="hr-timesheet-stat-employees" label="Employees" value={formatNumber(snapshot?.counts.employees ?? 0)} detail="Active profiles" icon={BadgeCheck} />
          <SummaryStat testId="hr-timesheet-stat-runs" label="Runs" value={formatNumber((snapshot?.counts.monthlyExports ?? 0) + (snapshot?.counts.dailyAlertRuns ?? 0))} detail="Monthly exports + daily alerts" icon={Sparkles} />
          <SummaryStat testId="hr-timesheet-stat-alerts" label="Alerts" value={formatNumber((snapshot?.alertTotalsByType.birthday ?? 0) + (snapshot?.alertTotalsByType.anniversary ?? 0))} detail="Birthday + anniversary" icon={AlertTriangle} />
        </div>

        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Status headline</div>
          <div className="mt-1 text-base font-medium text-zinc-100">{snapshot?.headline ?? 'No snapshot available'}</div>
          <div className="mt-2 text-sm text-zinc-400">{snapshot?.recommendation ?? 'No recommendation available.'}</div>
          <div className="mt-2 text-[11px] text-zinc-500">Last checked: {formatDate(snapshot?.checkedAt)}</div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Latest monthly export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 text-sm text-zinc-300">
              {snapshot?.latestMonthlyExport ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(snapshot.latestMonthlyExport.status)}>{snapshot.latestMonthlyExport.status}</Badge>
                    <Badge variant="outline">{snapshot.latestMonthlyExport.month ?? 'n/a'}</Badge>
                  </div>
                  <div>Employees: {formatNumber(snapshot.latestMonthlyExport.employeeCount)}</div>
                  <div>Entries: {formatNumber(snapshot.latestMonthlyExport.totalEntries)}</div>
                  <div>Hours: {formatHours(snapshot.latestMonthlyExport.totalHours)}</div>
                  <div className="break-all text-zinc-500">Output: {snapshot.latestMonthlyExport.outputPath ?? 'n/a'}</div>
                  <div className="text-[11px] text-zinc-500">Updated: {formatDate(snapshot.latestMonthlyExport.updatedAt)}</div>
                </>
              ) : (
                <div className="text-zinc-500">No export run recorded yet.</div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-white/10">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-3">
              <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Latest daily alert</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 text-sm text-zinc-300">
              {snapshot?.latestDailyAlert ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(snapshot.latestDailyAlert.status)}>{snapshot.latestDailyAlert.status}</Badge>
                    <Badge variant="outline">{formatDate(snapshot.latestDailyAlert.date)}</Badge>
                  </div>
                  <div>Generated: {formatNumber(snapshot.latestDailyAlert.generatedCount)}</div>
                  <div>Suppressed: {formatNumber(snapshot.latestDailyAlert.suppressedCount)}</div>
                  <div className="text-[11px] text-zinc-500">Updated: {formatDate(snapshot.latestDailyAlert.updatedAt)}</div>
                </>
              ) : (
                <div className="text-zinc-500">No daily alert run recorded yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
