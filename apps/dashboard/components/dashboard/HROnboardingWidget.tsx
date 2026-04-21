import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, CalendarDays, CheckCircle2, Clock3, Loader2, Mail, MessageSquare, Users, Workflow } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { ScrollArea } from '../ui/scroll-area.js';
import { Input } from '../ui/input.js';
import { Textarea } from '../ui/textarea.js';
import {
  getHROnboardingJobs,
  getHROnboardingSamples,
  runHROnboardingDryRun,
  type HROnboardingJobRecord,
} from '../../lib/hrOnboardingApi.js';
import type { HROnboardingDryRunReport } from '../../../utils/hrOnboardingDryRun.js';
import type { HROnboardingSamplePayload } from '../../../utils/hrOnboarding.js';

interface HROnboardingFormState {
  employeeId: string;
  employeeName: string;
  email: string;
  jobTitle: string;
  department: string;
  managerName: string;
  managerEmail: string;
  startDate: string;
  location: string;
  timezone: string;
  trigger: string;
  source: string;
  checklist: string;
}

const DEFAULT_FORM: HROnboardingFormState = {
  employeeId: '',
  employeeName: '',
  email: '',
  jobTitle: '',
  department: '',
  managerName: '',
  managerEmail: '',
  startDate: '',
  location: '',
  timezone: 'Europe/Budapest',
  trigger: 'webhook',
  source: 'dashboard',
  checklist: 'Create Google Workspace account\nAdd employee to Slack channel\nCreate calendar welcome block\nSend welcome email\nNotify manager and HR',
};

function parseJobReport(job: HROnboardingJobRecord | undefined): HROnboardingDryRunReport | null {
  if (!job?.results_json) {
    return null;
  }

  try {
    const parsed = JSON.parse(job.results_json) as { report?: HROnboardingDryRunReport };
    return parsed.report ?? null;
  } catch {
    return null;
  }
}

function checklistToArray(checklist: string): string[] {
  return checklist
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stateBadgeVariant(state: HROnboardingDryRunReport['checklist'][number]['state']): string {
  if (state === 'ready') {
    return 'bg-green-500/20 text-green-400 border-green-500/20';
  }
  if (state === 'blocked') {
    return 'bg-red-500/20 text-red-400 border-red-500/20';
  }
  if (state === 'needs-setup') {
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
  }
  return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/20';
}

function reportStateLabel(state: HROnboardingDryRunReport['status']): string {
  return state === 'ready' ? 'READY' : 'BLOCKED';
}

export function HROnboardingWidget() {
  const [form, setForm] = useState<HROnboardingFormState>(DEFAULT_FORM);
  const [samples, setSamples] = useState<HROnboardingSamplePayload[]>([]);
  const [jobs, setJobs] = useState<HROnboardingJobRecord[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0],
    [jobs, selectedJobId],
  );
  const selectedReport = parseJobReport(selectedJob);

  const refreshJobs = async (): Promise<void> => {
    const nextJobs = await getHROnboardingJobs(8);
    setJobs(nextJobs);
    if (!selectedJobId && nextJobs[0]) {
      setSelectedJobId(nextJobs[0].id);
    }
  };

  useEffect(() => {
    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const [samplePayloads, onboardingJobs] = await Promise.all([
          getHROnboardingSamples(),
          getHROnboardingJobs(8),
        ]);
        setSamples(samplePayloads);
        setJobs(onboardingJobs);
        if (onboardingJobs[0]) {
          setSelectedJobId(onboardingJobs[0].id);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`HR onboarding adatbetöltés sikertelen: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const applySample = (sample: HROnboardingSamplePayload): void => {
    const payload = sample.payload;
    setForm({
      employeeId: typeof payload.employeeId === 'string' ? payload.employeeId : '',
      employeeName: typeof payload.employeeName === 'string' ? payload.employeeName : '',
      email: typeof payload.email === 'string' ? payload.email : '',
      jobTitle: typeof payload.jobTitle === 'string' ? payload.jobTitle : '',
      department: typeof payload.department === 'string' ? payload.department : '',
      managerName: typeof payload.managerName === 'string' ? payload.managerName : '',
      managerEmail: typeof payload.managerEmail === 'string' ? payload.managerEmail : '',
      startDate: typeof payload.startDate === 'string' ? payload.startDate : '',
      location: typeof payload.location === 'string' ? payload.location : '',
      timezone: typeof payload.timezone === 'string' ? payload.timezone : DEFAULT_FORM.timezone,
      trigger: typeof payload.trigger === 'string' ? payload.trigger : DEFAULT_FORM.trigger,
      source: typeof payload.source === 'string' ? payload.source : DEFAULT_FORM.source,
      checklist: Array.isArray(payload.checklist) ? payload.checklist.join('\n') : DEFAULT_FORM.checklist,
    });
  };

  const updateField = <K extends keyof HROnboardingFormState>(field: K, value: HROnboardingFormState[K]): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleDryRun = async (): Promise<void> => {
    if (!form.employeeName.trim() || !form.email.trim() || !form.jobTitle.trim()) {
      toast.error('A név, email és munkakör mező kötelező.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId.trim(),
        employeeName: form.employeeName.trim(),
        email: form.email.trim(),
        jobTitle: form.jobTitle.trim(),
        department: form.department.trim(),
        managerName: form.managerName.trim() || undefined,
        managerEmail: form.managerEmail.trim() || undefined,
        startDate: form.startDate.trim() || undefined,
        location: form.location.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        trigger: form.trigger.trim() || undefined,
        source: form.source.trim() || undefined,
        checklist: checklistToArray(form.checklist),
      };

      const response = await runHROnboardingDryRun(payload);
      toast.success(`Onboarding dry-run elkészült: ${response.report.status.toUpperCase()}`);
      setSelectedJobId(response.jobId);
      await refreshJobs();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Dry-run hiba: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full shadow-xl border-cyan-500/20 bg-card/50 backdrop-blur-md">
      <CardHeader className="border-b border-white/[0.04] pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-cyan-500/10 p-2">
              <Briefcase className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle>HR Onboarding & Provisioning</CardTitle>
              <CardDescription>Dry-run onboarding, checklist és integrációs állapotok.</CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {samples.map((sample) => (
              <Button
                key={sample.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applySample(sample)}
                className="border-cyan-500/20 bg-cyan-500/5 text-cyan-100"
              >
                {sample.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input placeholder="Employee ID" value={form.employeeId} onChange={(event) => updateField('employeeId', event.target.value)} />
              <Input placeholder="Teljes név" value={form.employeeName} onChange={(event) => updateField('employeeName', event.target.value)} />
              <Input placeholder="Work email" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
              <Input placeholder="Munkakör" value={form.jobTitle} onChange={(event) => updateField('jobTitle', event.target.value)} />
              <Input placeholder="Osztály" value={form.department} onChange={(event) => updateField('department', event.target.value)} />
              <Input placeholder="Start date" type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} />
              <Input placeholder="Manager név" value={form.managerName} onChange={(event) => updateField('managerName', event.target.value)} />
              <Input placeholder="Manager email" type="email" value={form.managerEmail} onChange={(event) => updateField('managerEmail', event.target.value)} />
              <Input placeholder="Location" value={form.location} onChange={(event) => updateField('location', event.target.value)} />
              <Input placeholder="Timezone" value={form.timezone} onChange={(event) => updateField('timezone', event.target.value)} />
              <Input placeholder="Trigger" value={form.trigger} onChange={(event) => updateField('trigger', event.target.value)} />
              <Input placeholder="Source" value={form.source} onChange={(event) => updateField('source', event.target.value)} />
            </div>

            <Textarea
              value={form.checklist}
              onChange={(event) => updateField('checklist', event.target.value)}
              className="min-h-32"
              placeholder="Checklist steps, one per line"
            />

            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleDryRun} disabled={isSubmitting} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Workflow className="mr-2 h-4 w-4" />}
                Dry-run indítása
              </Button>
              <Button type="button" variant="outline" onClick={() => setForm(DEFAULT_FORM)}>
                Reset
              </Button>
              {isLoading ? <span className="text-xs text-zinc-500">Betöltés...</span> : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase text-zinc-500">History</h3>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {jobs.length} job
                </Badge>
              </div>
              <ScrollArea className="h-[240px] pr-3">
                <div className="space-y-2">
                  {jobs.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">Még nincs onboarding dry-run.</p>
                  ) : jobs.map((job) => {
                    const report = parseJobReport(job);
                    const selected = selectedJobId === job.id || (!selectedJobId && jobs[0]?.id === job.id);
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedJobId(job.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${selected ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-transparent bg-white/[0.02] hover:border-cyan-500/20'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-xs font-bold">{job.query}</div>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {job.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-500">
                          {format(new Date(job.created_at), 'yyyy.MM.dd HH:mm')}
                        </div>
                        {report ? (
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400">
                            {report.status === 'ready' ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <Clock3 className="h-3 w-3 text-yellow-400" />}
                            {report.status}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase text-zinc-500">Dry-run report</h3>
                <Badge className={selectedReport?.status === 'ready' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                  {selectedReport ? reportStateLabel(selectedReport.status) : 'N/A'}
                </Badge>
              </div>

              {selectedReport ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2">
                      <div className="text-zinc-500">Total</div>
                      <div className="font-bold text-white">{selectedReport.summary.total}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2">
                      <div className="text-zinc-500">Ready</div>
                      <div className="font-bold text-green-400">{selectedReport.summary.ready}</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2">
                      <div className="text-zinc-500">Blocked</div>
                      <div className="font-bold text-yellow-400">{selectedReport.summary.blocked}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedReport.integrations.map((integration) => (
                      <div key={integration.channel} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs">
                        <div>
                          <div className="font-semibold text-white">{integration.channel}</div>
                          <div className="text-[10px] text-zinc-500">{integration.details}</div>
                        </div>
                        <Badge variant="outline" className={integration.available ? 'border-green-500/20 text-green-400' : 'border-yellow-500/20 text-yellow-400'}>
                          {integration.available ? 'ready' : 'setup'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {selectedReport.checklist.map((item) => (
                      <div key={item.id} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-white">{item.label}</div>
                          <Badge variant="outline" className={stateBadgeVariant(item.state)}>
                            {item.state}
                          </Badge>
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-500">{item.details}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-xs">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-white">
                      <Users className="h-3 w-3" />
                      Next steps
                    </div>
                    <ul className="space-y-1 text-zinc-400">
                      {selectedReport.nextSteps.map((step) => (
                        <li key={step} className="flex items-start gap-2">
                          <MessageSquare className="mt-0.5 h-3 w-3 flex-none text-cyan-400" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex h-[240px] flex-col items-center justify-center text-zinc-500 opacity-60">
                  <CalendarDays className="mb-3 h-12 w-12" />
                  <p className="text-sm">Válassz egy jobot vagy indíts dry-runt.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
