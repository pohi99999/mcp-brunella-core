import React, { useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Target, CheckCircle2, XCircle, Clock, Users, PauseCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Channel { name: string; priority: 'high' | 'medium' | 'low'; description: string; }
interface StrategyPlan {
  planId: string; propertyType: string; location: string; estimatedValue: number;
  approvalState: 'pending' | 'approved' | 'rejected' | 'paused';
  channels: Channel[]; targetSegments: string[]; approvalSteps: string[];
  summary: string; generatedAt: string; resumeToken?: string | null;
}

interface OnboardingIntakeJob {
  id: string;
  query: string;
  status: string;
  metadata?: string | null;
  created_at?: string;
}

interface OnboardingPendingResponse {
  status: string;
  count: number;
  jobs: OnboardingIntakeJob[];
  error?: string;
}

/** Shape returned by all /psales/strategy/* endpoints */
interface PlanApiResponse { ok: boolean; plan?: StrategyPlan; error?: string; }

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  medium: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  low: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
};

const APPROVAL_COLORS: Record<string, string> = {
  pending: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-red-500/20 bg-red-500/10 text-red-300',
  paused: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
};

function parseJobMetadata(job: OnboardingIntakeJob): {
  clientName: string;
  contactEmail: string;
  formType: string;
  painPoint: string;
} {
  if (!job.metadata) {
    return {
      clientName: job.query,
      contactEmail: '',
      formType: '',
      painPoint: '',
    };
  }

  try {
    const parsed = JSON.parse(job.metadata) as Record<string, unknown>;
    const clientName = typeof parsed.client_name === 'string' && parsed.client_name.length > 0
      ? parsed.client_name
      : typeof parsed.brand_name === 'string' && parsed.brand_name.length > 0
        ? parsed.brand_name
        : job.query;
    const contactEmail = typeof parsed.contact_email === 'string' && parsed.contact_email.length > 0
      ? parsed.contact_email
      : typeof parsed.email === 'string' && parsed.email.length > 0
        ? parsed.email
        : '';
    return {
      clientName,
      contactEmail,
      formType: typeof parsed.form_type === 'string' ? parsed.form_type : '',
      painPoint: typeof parsed.pain_point === 'string' ? parsed.pain_point : '',
    };
  } catch {
    return {
      clientName: job.query,
      contactEmail: '',
      formType: '',
      painPoint: '',
    };
  }
}

export function PSalesStrategyPanel() {
  const [form, setForm] = useState({ propertyType: 'apartment', location: 'Budapest', estimatedValue: 100000 });
  const [plan, setPlan] = useState<StrategyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingIntakes, setPendingIntakes] = useState<OnboardingIntakeJob[]>([]);
  const [loadingIntakes, setLoadingIntakes] = useState(false);
  const [activeIntakeId, setActiveIntakeId] = useState<string | null>(null);

  const loadPendingIntakes = async () => {
    setLoadingIntakes(true);
    try {
      const res = await fetch('/api/v1/webhook/onboarding-intake/pending');
      const data = await res.json() as OnboardingPendingResponse;
      if (data.status !== 'ok') {
        toast.error(data.error ?? 'Onboarding queue betöltése sikertelen.');
        return;
      }
      setPendingIntakes(data.jobs ?? []);
    } catch {
      toast.error('Onboarding queue betöltése sikertelen.');
    } finally {
      setLoadingIntakes(false);
    }
  };

  useEffect(() => {
    void loadPendingIntakes();
  }, []);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/psales/strategy/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as PlanApiResponse;
      if (!data.ok || !data.plan) { toast.error(data.error ?? 'Terv generálás sikertelen.'); return; }
      setPlan(data.plan);
      toast.success('Stratégiai terv elkészült — jóváhagyás szükséges');
    } catch {
      toast.error('Terv generálás sikertelen.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (decision: 'approved' | 'rejected') => {
    if (!plan) return;
    try {
      const res = await fetch('/api/psales/strategy/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.planId, decision }),
      });
      const data = await res.json() as PlanApiResponse;
      if (!data.ok || !data.plan) { toast.error(data.error ?? 'Döntés rögzítése sikertelen.'); return; }
      setPlan(data.plan);
      if (decision === 'approved') toast.success('Terv jóváhagyva — végrehajtás engedélyezett!');
      else toast.info('Terv elutasítva — újratervezés szükséges.');
    } catch {
      toast.error('Döntés rögzítése sikertelen.');
    }
  };

  const handlePause = async () => {
    if (!plan) return;
    try {
      const res = await fetch('/api/psales/strategy/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.planId }),
      });
      const data = await res.json() as PlanApiResponse;
      if (!data.ok || !data.plan) { toast.error(data.error ?? 'Szüneteltetés sikertelen.'); return; }
      setPlan(data.plan);
      toast.info('Terv szüneteltetésre kerüt — resume token generálva.');
    } catch {
      toast.error('Szüneteltetés sikertelen.');
    }
  };

  const handleIntakeDecision = async (jobId: string, decision: 'approve' | 'reject') => {
    setActiveIntakeId(jobId);
    try {
      const res = await fetch(`/api/v1/webhook/onboarding-intake/${jobId}/${decision}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: decision === 'reject'
          ? JSON.stringify({ reason: 'Rejected from dashboard queue' })
          : JSON.stringify({}),
      });
      const data = await res.json() as { status: string; error?: string; message?: string; };
      if (data.status !== 'ok') {
        toast.error(data.error ?? 'Intake döntés rögzítése sikertelen.');
        return;
      }

      if (decision === 'approve') {
        toast.success('Onboarding intake jóváhagyva és sorba állítva.');
      } else {
        toast.info('Onboarding intake elutasítva.');
      }

      await loadPendingIntakes();
    } catch {
      toast.error('Intake döntés rögzítése sikertelen.');
    } finally {
      setActiveIntakeId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <Target className="h-4 w-4 text-primary" />
            Értékesítési Stratégia Tervező
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Típus</label>
              <select
                value={form.propertyType}
                onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-[#050816] px-3 py-2 text-sm text-white"
              >
                <option value="apartment">Lakás</option>
                <option value="house">Ház</option>
                <option value="industrial">Ipari</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Lokáció</label>
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Becsült érték (EUR)</label>
              <input
                type="number"
                value={form.estimatedValue}
                onChange={e => setForm(f => ({ ...f, estimatedValue: Number(e.target.value) }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <Button
            className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
            onClick={generatePlan}
            disabled={loading}
          >
            {loading ? 'Terv generálás...' : 'Stratégia generálása'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <Clock className="h-4 w-4 text-primary" />
              Onboarding approval queue
            </CardTitle>
            <Button
              variant="outline"
              className="border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]"
              onClick={() => void loadPendingIntakes()}
              disabled={loadingIntakes}
            >
              {loadingIntakes ? 'Frissítés...' : 'Frissítés'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-zinc-500">
            A queue csak belső review után enged továbblépni. Kliensnek vagy külső rendszerbe menő lépés approval előtt nem indulhat.
          </p>
          {pendingIntakes.length === 0 && !loadingIntakes && (
            <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-sm text-zinc-400">
              Nincs jóváhagyásra váró onboarding intake.
            </div>
          )}
          {pendingIntakes.map((job) => {
            const details = parseJobMetadata(job);
            const isBusy = activeIntakeId === job.id;
            return (
              <div key={job.id} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{details.clientName}</p>
                      <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-300">
                        {job.status}
                      </Badge>
                    </div>
                    {details.contactEmail && (
                      <p className="text-xs text-zinc-400">{details.contactEmail}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                      {details.formType && <span>Form: {details.formType}</span>}
                      {details.painPoint && <span>Probléma: {details.painPoint}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      disabled={isBusy}
                      onClick={() => void handleIntakeDecision(job.id, 'approve')}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Jóváhagyás
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      disabled={isBusy}
                      onClick={() => void handleIntakeDecision(job.id, 'reject')}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Elutasítás
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {plan && (
        <>
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-white">Csatorna Mix</CardTitle>
                <Badge className={APPROVAL_COLORS[plan.approvalState] ?? ''}>
                  {plan.approvalState === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                  {plan.approvalState === 'approved' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                  {plan.approvalState === 'rejected' && <XCircle className="mr-1 h-3 w-3" />}
                  {plan.approvalState === 'paused' && <PauseCircle className="mr-1 h-3 w-3" />}
                  {plan.approvalState.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.channels.map(ch => (
                <div key={ch.name} className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                  <Badge className={`shrink-0 text-[10px] ${PRIORITY_COLORS[ch.priority] ?? ''}`}>{ch.priority}</Badge>
                  <div>
                    <p className="text-sm font-medium text-white">{ch.name}</p>
                    <p className="text-xs text-zinc-500">{ch.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Users className="h-4 w-4 text-primary" />
                Célcsoportok
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {plan.targetSegments.map(seg => (
                <Badge key={seg} className="border-white/[0.08] bg-white/[0.04] text-zinc-300">{seg}</Badge>
              ))}
            </CardContent>
          </Card>

          {plan.approvalState === 'pending' && (
            <div className="flex gap-3">
              <Button
                className="flex-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                onClick={() => handleApproval('approved')}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Jóváhagyás
              </Button>
              <Button
                className="flex-1 border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                onClick={handlePause}
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Szüneteltetés
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                onClick={() => handleApproval('rejected')}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Elutasítás
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
