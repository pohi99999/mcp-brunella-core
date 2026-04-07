import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Robot,
  ArrowsClockwise,
  Play,
  GitPullRequest,
  ChartLine,
} from "@phosphor-icons/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  getJulesSessions,
  createJulesTask,
  syncJulesSession,
  type JulesSession,
  getJulesWorkflowRuns,
  dispatchJulesWorkflow,
  type JulesWorkflowRun,
} from "@/lib/apiService";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function JulesPanel() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessions, setSessions] = useState<JulesSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [runs, setRuns] = useState<JulesWorkflowRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [showAsyncTests, setShowAsyncTests] = useState(false);
  const [hasLoadedSessions, setHasLoadedSessions] = useState(false);
  const [hasLoadedRuns, setHasLoadedRuns] = useState(false);

  const WORKFLOW = "jules-async-tests.yml";
  const MAX_VISIBLE_SESSIONS = 5;

  const refreshSessions = async () => {
    setHasLoadedSessions(true);
    setIsLoading(true);
    try {
      const data = await getJulesSessions();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load Jules sessions:", error);
      toast.error(t("jules.sessions_load_error", "A Jules sessionök betöltése sikertelen"));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRuns = async () => {
    setHasLoadedRuns(true);
    setIsLoadingRuns(true);
    try {
      const list = await getJulesWorkflowRuns({
        workflow: WORKFLOW,
        limit: 10,
      });
      setRuns(list);
    } catch (error: any) {
      // Token missing is expected in some dev envs → keep it non-fatal
      setRuns([]);
    } finally {
      setIsLoadingRuns(false);
    }
  };

  const handleCreateTask = async () => {
    if (!prompt.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await createJulesTask(prompt);
      toast.success(
        t("jules.task_started", "Jules feladat elindítva: {{sessionId}}", {
          sessionId: result.sessionId || t("jules.queued", "sorba állítva"),
        }),
      );
      setPrompt("");
      await refreshSessions();
    } catch (error) {
      toast.error(t("jules.create_error", "Nem sikerült létrehozni a Jules feladatot"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (sessionId: string) => {
    try {
      await syncJulesSession(sessionId);
      toast.success(t("jules.sync_started", "A szinkron elindult a sessionhöz"));
      await refreshSessions();
    } catch (error) {
      toast.error(t("jules.sync_error", "A szinkron sikertelen"));
    }
  };

  const triggerAsyncTests = async () => {
    try {
      await dispatchJulesWorkflow({
        workflow: WORKFLOW,
        ref: "main",
        inputs: {},
      });
      toast.success("Async tesztek elindítva (workflow_dispatch)");
      await refreshRuns();
    } catch (e: any) {
      toast.error(e?.message || "Nem sikerült indítani a workflow-t");
    }
  };

  return (
    <Card className="bg-transparent border-none shadow-none h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-4 pt-4 shrink-0">
        <CardTitle className="text-xs font-medium tracking-wide text-zinc-400 flex items-center gap-2">
          <Robot size={24} weight="duotone" />
          {t("jules.title", "Jules integráció")}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshSessions}
          disabled={isLoading}
          title={t("jules.load_sessions", "Jules sessionök betöltése")}
        >
          <ArrowsClockwise
            size={16}
            className={isLoading ? "animate-spin" : ""}
          />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6 flex-1 overflow-auto">
        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            id="jules-task-prompt"
            name="jules-task-prompt"
            aria-label={t("jules.prompt_label", "Jules feladat")}
            placeholder={t(
              "jules.prompt_placeholder",
              "Írd le a Jules feladatát (pl. \"Refaktoráld a Python hitelesítési logikát\")...",
            )}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-white/[0.02] border-white/[0.04] min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleCreateTask}
              disabled={isSubmitting || !prompt.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? (
                <ArrowsClockwise className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {t("jules.send", "Küldés Jules-nak")}
            </Button>
          </div>
        </div>

        {/* Sessions List - Compact */}
        <div className="rounded-md border border-white/[0.04] overflow-hidden">
          <Table>
            <TableHeader className="bg-white/[0.04]">
              <TableRow className="text-xs">
                <TableHead className="w-[80px] py-2">{t("jules.session", "Session")}</TableHead>
                <TableHead className="py-2">{t("jules.status", "Állapot")}</TableHead>
                <TableHead className="py-2">{t("jules.task", "Feladat")}</TableHead>
                <TableHead className="text-right py-2">{t("jules.action", "Művelet")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-zinc-500 h-16 text-xs"
                  >
                    {t("jules.no_sessions", "Nincs aktív session.")}
                  </TableCell>
                </TableRow>
              ) : (
                sessions
                  .slice(0, showAllSessions ? undefined : MAX_VISIBLE_SESSIONS)
                  .map((session, i) => (
                    <TableRow key={`session-${session.id || i}`} className="text-xs">
                      <TableCell className="font-mono text-[10px] py-2">
                        {session.id.slice(0, 12)}...
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={
                            session.status?.toLowerCase().includes("completed")
                              ? "default"
                              : session.status?.toLowerCase().includes("running")
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate py-2"
                        title={session.task}
                      >
                        {session.task}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(session.id)}
                          title={t("jules.sync_title", "Szinkron / Lekérés")}
                          className="h-6 w-6 p-0"
                        >
                          <GitPullRequest size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          {sessions.length > MAX_VISIBLE_SESSIONS && (
            <div className="border-t border-white/[0.04] bg-white/[0.04] p-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllSessions(!showAllSessions)}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {showAllSessions
                  ? t("jules.show_less", "Kevesebb mutatása")
                  : t("jules.show_more", "{{count}} további megjelenítése", {
                      count: sessions.length - MAX_VISIBLE_SESSIONS,
                    })}
              </Button>
            </div>
          )}
        </div>

        {/* Async Tests (GitHub Actions) - Collapsible */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-white/[0.04] w-full hover:bg-white/10 transition-colors cursor-pointer"
          onClick={() => setShowAsyncTests(!showAsyncTests)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setShowAsyncTests(!showAsyncTests);
            }
          }}
        >
          <div className="text-xs font-medium text-zinc-500 flex items-center gap-2">
            {t("jules.async_tests", "Aszinkron tesztek (GitHub Actions)")}
            {runs.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {t("jules.pass_ratio", "{{passed}}/{{total}} sikeres", {
                  passed: runs.filter((r) => r.conclusion === "success").length,
                  total: runs.length,
                })}
              </Badge>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                refreshRuns();
              }}
              disabled={isLoadingRuns}
              title="Frissítés"
              className="h-6 w-6 p-0"
            >
              <ArrowsClockwise
                size={14}
                className={isLoadingRuns ? "animate-spin" : ""}
              />
            </Button>
            <span className="text-xs text-zinc-500">
              {showAsyncTests ? "▼" : "▶"}
            </span>
          </div>
        </div>
        {showAsyncTests && (
          <div className="rounded-md border border-white/[0.04] overflow-hidden">
            <Table>
            <TableHeader className="bg-white/[0.04]">
              <TableRow>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead>{t("jules.status", "Állapot")}</TableHead>
                <TableHead>{t("jules.conclusion", "Eredmény")}</TableHead>
                <TableHead>{t("jules.updated", "Frissítve")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-zinc-500 h-16"
                  >
                    {isLoadingRuns
                      ? t("jules.loading", "Betöltés...")
                      : hasLoadedRuns
                        ? t("jules.no_runs_missing_token", "Nincs adat (lehet hiányzik a GITHUB_TOKEN a szerveren).")
                        : t("jules.load_runs_hint", "Kattints a frissítésre a workflow futások betöltéséhez.")}
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((r, i) => (
                  <TableRow key={`run-${r.id || i}`}>
                    <TableCell className="font-mono text-xs">
                      {r.run_number ?? r.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status || t("jules.unknown", "ismeretlen")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (r.conclusion || "") === "success"
                            ? "default"
                            : (r.conclusion || "") === "failure"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {r.conclusion ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      {(r.updated_at || r.created_at || "")
                        .slice(0, 19)
                        .replace("T", " ")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          )}

        {/* Test Trend Chart - Only show if tests are visible and there are successes */}
        {showAsyncTests && runs.length > 0 && runs.some(r => r.conclusion === "success") && (
          <div className="rounded-md border border-white/[0.04] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04]">
              <div className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <ChartLine size={16} />
                {t("jules.success_trend", "Tesztek sikerességi trendje (utolsó 10 futás)")}
              </div>
            </div>
            <div className="p-4 bg-white/[0.02]">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={runs
                    .slice()
                    .reverse()
                    .map((r, idx) => ({
                      run: `#${r.run_number ?? idx + 1}`,
                      success: r.conclusion === "success" ? 100 : 0,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="run" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: "4px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="success"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            <div className="mt-2 text-xs text-zinc-500 text-center">
                {t("jules.successful_runs", "{{passed}} / {{total}} sikeres futás ({{rate}}% sikerarány)", {
                  passed: runs.filter((r) => r.conclusion === "success").length,
                  total: runs.length,
                  rate: Math.round((runs.filter((r) => r.conclusion === "success").length / runs.length) * 100),
                })}
              </div>
            </div>
          </div>
        )}
        {!hasLoadedSessions && sessions.length === 0 && (
          <div className="rounded-md border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs text-zinc-500">
            A Jules session lista kézi frissítéssel töltődik be, hogy a dashboard indításakor ne terhelje a szervert felesleges kérésekkel.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
