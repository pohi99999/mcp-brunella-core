import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  ExternalLink,
  FileText,
  MapPin,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { executeAgent } from "@/lib/apiService";
import {
  DEFAULT_GRANT_PROFILE,
  buildGrantTask,
  formatGrantAmount,
  formatPercent,
  type GrantMatch,
  type GrantProfileForm,
  type GrantWatcherAgentResponse,
  type GrantWatcherPayload,
} from "@packages/utils/grantFlow.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeGrantWatcherResponse(value: unknown): GrantWatcherAgentResponse {
  if (!isRecord(value)) {
    throw new Error("A GrantWatcher érvénytelen választ adott vissza.");
  }

  const status = value.status;
  if (status !== "success" && status !== "error") {
    throw new Error("A GrantWatcher válasza nem értelmezhető.");
  }

  return value as GrantWatcherAgentResponse;
}

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  accentClassName?: string;
}

function MetricCard({ accentClassName, detail, icon, label, value }: MetricCardProps) {
  return (
    <Card className="glass-card overflow-hidden border-white/10 bg-white/[0.03]">
      <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-2">
        <CardDescription className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          {label}
        </CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl text-zinc-100">
          <span className={accentClassName}>{icon}</span>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 text-xs text-zinc-500">{detail}</CardContent>
    </Card>
  );
}

interface GrantManagerProps {
  initialProfile?: GrantProfileForm;
}

export function GrantManager({ initialProfile = DEFAULT_GRANT_PROFILE }: GrantManagerProps) {
  const [profile, setProfile] = useState<GrantProfileForm>(initialProfile);
  const [result, setResult] = useState<GrantWatcherPayload | null>(null);
  const [selectedGrantTitle, setSelectedGrantTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGrant = useMemo(() => {
    const grants = result?.eligibleGrants ?? [];
    return grants.find((match) => match.grant.title === selectedGrantTitle) ?? grants[0] ?? null;
  }, [result, selectedGrantTitle]);

  const upcomingDeadlineCount = result?.upcomingDeadlines.length ?? 0;
  const topScore = result?.eligibleGrants[0]?.matchScore ?? 0;
  const averageScore = result?.stats.avgMatchScore ?? 0;
  const selectedHasDraft = Boolean(result?.applicationDraft);

  useEffect(() => {
    if (!result) {
      return;
    }

    const firstEligible = result.eligibleGrants[0]?.grant.title ?? "";
    if (!selectedGrantTitle || !result.eligibleGrants.some((match) => match.grant.title === selectedGrantTitle)) {
      setSelectedGrantTitle(firstEligible);
    }
  }, [result, selectedGrantTitle]);

  const executeGrantWatch = useCallback(async (inputProfile: GrantProfileForm, grantId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = normalizeGrantWatcherResponse(
        await executeAgent("GrantWatcher", buildGrantTask(inputProfile, grantId)),
      );

      if (response.status !== "success" || !response.data) {
        throw new Error(response.error ?? response.message ?? "GrantWatcher futtatás sikertelen.");
      }

      setResult(response.data);
      setSelectedGrantTitle((current) => {
        const firstEligible = response.data?.eligibleGrants[0]?.grant.title ?? "";
        if (current && response.data.eligibleGrants.some((match) => match.grant.title === current)) {
          return current;
        }
        return firstEligible;
      });

      toast.success(grantId ? "Pályázati draft elkészült." : "Pályázati shortlist frissítve.");
      return response.data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`Grant flow hiba: ${message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void executeGrantWatch(initialProfile);
  }, [executeGrantWatch, initialProfile]);

  const updateProfile = <K extends keyof GrantProfileForm>(key: K, value: GrantProfileForm[K]) => {
    setProfile((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSearch = () => {
    void executeGrantWatch(profile);
  };

  const handleDraft = () => {
    const grantId = selectedGrant?.grant.title;
    if (!grantId) {
      toast.info("Előbb válassz egy pályázatot a draft generálásához.");
      return;
    }

    void executeGrantWatch(profile, grantId);
  };

  const handleReset = () => {
    setProfile(initialProfile);
    setSelectedGrantTitle("");
    void executeGrantWatch(initialProfile);
  };

  const renderGrantCard = (match: GrantMatch, index: number) => {
    const isSelected = selectedGrant?.grant.title === match.grant.title;

    return (
      <button
        key={`${match.grant.title}-${index}`}
        type="button"
        onClick={() => setSelectedGrantTitle(match.grant.title)}
        className={`w-full rounded-2xl border p-4 text-left transition-all ${
          isSelected
            ? "border-emerald-400/35 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.14)]"
            : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-100">{match.grant.title}</div>
            <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{match.grant.description}</div>
          </div>
          <Badge variant={isSelected ? "default" : "secondary"} className="shrink-0">
            {formatPercent(match.matchScore)}
          </Badge>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
          <div className="flex items-center gap-1.5">
            <Coins size={12} className="text-yellow-400" />
            {formatGrantAmount(match.grant.fundingAmount, match.grant.currency)}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-sky-400" />
            {match.grant.deadline}
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-emerald-400" />
            {match.grant.source}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {match.matchReasons.slice(0, 3).map((reason) => (
            <Badge key={reason} variant="outline" className="text-[10px]">
              {reason}
            </Badge>
          ))}
        </div>

        {match.warnings && match.warnings.length > 0 ? (
          <p className="mt-3 text-xs text-amber-300">{match.warnings.join(" · ")}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          <span>{index + 1}. találat</span>
          <span>{match.grant.publishedAt}</span>
        </div>
      </button>
    );
  };

  const draftSections = result?.applicationDraft?.sections ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Grant Watcher</p>
          <h2 className="text-2xl font-semibold text-zinc-100">Pályázatfigyelő / Grant Manager</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Iszapfaló profilra szabott shortlist, illeszkedési pontszám és nyers pályázati draft a GrantWatcherAgentből.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="gap-2 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20"
          >
            {loading ? <RefreshCcw size={14} className="animate-spin" /> : <Search size={14} />}
            Pályázatok keresése
          </Button>
          <Button
            onClick={handleDraft}
            disabled={loading || !selectedGrant}
            variant="outline"
            className="gap-2 border-white/10 bg-white/[0.03] text-zinc-100 hover:bg-white/[0.06]"
          >
            <FileText size={14} />
            Draft generálása
          </Button>
          <Button
            onClick={handleReset}
            disabled={loading}
            variant="ghost"
            className="gap-2 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
          >
            <RefreshCcw size={14} />
            Alapadatok
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-red-500/20 bg-red-500/10">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-red-200">
            <AlertTriangle size={16} className="text-red-300" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      <Card className="glass-card border-white/10 bg-white/[0.03]">
        <CardHeader className="border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white">
            <Building2 size={16} className="text-cyan-300" />
            Cégprofil és szűrő
          </CardTitle>
          <CardDescription className="text-zinc-500">
            A mezők közvetlenül a GrantWatcherAgent JSON bemenetébe kerülnek.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs uppercase tracking-[0.22em] text-zinc-500">Cégnév</label>
              <Input
                value={profile.companyName}
                onChange={(event) => updateProfile("companyName", event.target.value)}
                placeholder="Iszapfaló Kft."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.22em] text-zinc-500">TEÁOR</label>
              <Input
                value={profile.teaorCode}
                onChange={(event) => updateProfile("teaorCode", event.target.value)}
                placeholder="7210"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.22em] text-zinc-500">Létszám</label>
              <Input
                type="number"
                min={1}
                value={profile.employeeCount}
                onChange={(event) => updateProfile("employeeCount", Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.22em] text-zinc-500">Árbevétel (Ft)</label>
              <Input
                type="number"
                min={0}
                value={profile.annualRevenue}
                onChange={(event) => updateProfile("annualRevenue", Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.22em] text-zinc-500">Régió</label>
              <Input
                value={profile.location}
                onChange={(event) => updateProfile("location", event.target.value)}
                placeholder="Pest"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.22em] text-zinc-500">Projektleírás</label>
            <Textarea
              value={profile.projectDescription}
              onChange={(event) => updateProfile("projectDescription", event.target.value)}
              rows={8}
              placeholder="Iszapkezelési és vízminőség-javító K+F projekt..."
            />
            <p className="text-xs text-zinc-500">
              A projektleírás a draft generálásához és a releváns pályázati indoklásokhoz is bekerül.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Találatok"
          value={String(result?.stats.totalFound ?? 0)}
          detail="Összes feltárt pályázat"
          icon={<Sparkles size={18} className="text-violet-300" />}
        />
        <MetricCard
          label="Illeszkedő"
          value={String(result?.stats.eligible ?? 0)}
          detail="50% feletti megfelelés"
          icon={<CheckCircle2 size={18} className="text-emerald-300" />}
        />
        <MetricCard
          label="Átlag pontszám"
          value={formatPercent(averageScore)}
          detail={`Top találat: ${formatPercent(topScore)}`}
          icon={<Coins size={18} className="text-yellow-300" />}
        />
        <MetricCard
          label="Határidők"
          value={String(upcomingDeadlineCount)}
          detail={result?.summaryDocUrl ? "Összefoglaló dokumentum kész" : "Még nincs összefoglaló"}
          icon={<Calendar size={18} className="text-sky-300" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="glass-card border-white/10 bg-white/[0.03] xl:col-span-2">
          <CardHeader className="border-b border-white/[0.05] bg-white/[0.015]">
            <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white">
              <Search size={16} className="text-emerald-300" />
              Shortlist
            </CardTitle>
            <CardDescription className="text-zinc-500">
              A legrelevánsabb pályázatok illeszkedési pontszámmal és indoklással.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {result?.eligibleGrants.length ? (
              <ScrollArea className="h-[560px] p-4">
                <div className="space-y-3">
                  {result.eligibleGrants.map((match, index) => renderGrantCard(match, index))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-[320px] flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
                <AlertTriangle size={28} className="text-zinc-600" />
                <div className="text-sm">Még nincs releváns shortlist.</div>
                <div className="max-w-md text-xs text-zinc-600">
                  Indítsd el a keresést, vagy finomítsd a cégprofil régió / TEÁOR / projektleírás mezőit.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card border-white/10 bg-white/[0.03]">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white">
                <FileText size={16} className="text-cyan-300" />
                Draft előnézet
              </CardTitle>
              <CardDescription className="text-zinc-500">
                A kiválasztott pályázathoz generált nyers anyag.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {selectedHasDraft && result?.applicationDraft ? (
                <>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-zinc-100">{result.applicationDraft.title}</div>
                    <div className="text-xs text-zinc-500">{result.applicationDraft.companyName}</div>
                  </div>

                  <div className="space-y-3">
                    {draftSections.map((section) => (
                      <div key={section.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          {section.title}
                        </div>
                        <div className="mt-2 text-sm text-zinc-200 whitespace-pre-wrap">{section.content}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-zinc-500">
                  <FileText size={28} className="text-zinc-600" />
                  <div className="text-sm">A draft itt jelenik meg.</div>
                  <div className="text-xs text-zinc-600">Jelölj ki egy shortlist találatot, majd kattints a draft gombra.</div>
                </div>
              )}

              {result?.summaryDocUrl ? (
                <a
                  href={result.summaryDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/15"
                >
                  <span>Összefoglaló dokumentum</span>
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card className="glass-card border-white/10 bg-white/[0.03]">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015]">
              <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white">
                <Calendar size={16} className="text-sky-300" />
                Közelgő határidők
              </CardTitle>
              <CardDescription className="text-zinc-500">
                A következő lejáratok a GrantWatcher előrejelzéséből.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {result?.upcomingDeadlines.length ? (
                <ScrollArea className="h-[260px] p-4">
                  <div className="space-y-3">
                    {result.upcomingDeadlines.map((deadline) => (
                      <div
                        key={`${deadline.title}-${deadline.deadline}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="text-sm font-medium text-zinc-100">{deadline.title}</div>
                        <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                          <span>{deadline.deadline}</span>
                          <span>{deadline.daysRemaining} nap</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="px-4 py-6 text-sm text-zinc-500">Nincs még megjeleníthető határidő.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
