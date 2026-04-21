import { existsSync } from 'fs';
import { getGoogleWorkspaceAuthPaths } from './googleAuth.js';
import { isNotificationEmailConfigured } from './notificationService.js';

export type HROnboardingTrigger = 'webhook' | 'hris' | 'manual' | 'csv' | 'api';

export type HROnboardingChecklistState = 'ready' | 'blocked' | 'needs-setup' | 'not-applicable';

export type HROnboardingSeverity = 'error' | 'warning';

export interface HROnboardingIssue {
  code: string;
  field?: string;
  severity: HROnboardingSeverity;
  message: string;
}

export interface HROnboardingChecklistItem {
  id: string;
  label: string;
  required: boolean;
  state: HROnboardingChecklistState;
  details: string;
}

export interface HROnboardingIntegrationAvailability {
  channel: 'email' | 'slack' | 'calendar' | 'googleWorkspace';
  available: boolean;
  target?: string;
  details: string;
}

export interface HROnboardingRequestedIntegrations {
  email: boolean;
  slack: boolean;
  calendar: boolean;
  googleWorkspace: boolean;
}

export interface HROnboardingNormalizedPayload {
  employeeId: string;
  employeeName: string;
  email: string;
  jobTitle: string;
  department: string;
  managerName: string | null;
  managerEmail: string | null;
  startDate: string | null;
  location: string | null;
  timezone: string | null;
  trigger: HROnboardingTrigger;
  source: string | null;
  checklist: string[];
  requestedIntegrations: HROnboardingRequestedIntegrations;
}

export interface HROnboardingDryRunReport {
  status: 'ready' | 'blocked';
  timestamp: string;
  summary: {
    total: number;
    ready: number;
    blocked: number;
  };
  missing: string[];
  issues: HROnboardingIssue[];
  checklist: HROnboardingChecklistItem[];
  integrations: HROnboardingIntegrationAvailability[];
  nextSteps: string[];
}

export interface HROnboardingDryRunResult {
  normalized: HROnboardingNormalizedPayload;
  report: HROnboardingDryRunReport;
}

export interface HROnboardingSamplePayload {
  key: string;
  label: string;
  description: string;
  payload: Record<string, unknown>;
}

interface HROnboardingRawPayload extends Record<string, unknown> {
  employeeId?: unknown;
  employee_id?: unknown;
  employeeName?: unknown;
  employee_name?: unknown;
  fullName?: unknown;
  full_name?: unknown;
  email?: unknown;
  workEmail?: unknown;
  work_email?: unknown;
  jobTitle?: unknown;
  job_title?: unknown;
  role?: unknown;
  department?: unknown;
  managerName?: unknown;
  manager_name?: unknown;
  managerEmail?: unknown;
  manager_email?: unknown;
  startDate?: unknown;
  start_date?: unknown;
  location?: unknown;
  timezone?: unknown;
  trigger?: unknown;
  source?: unknown;
  checklist?: unknown;
  integrations?: unknown;
}

const DEFAULT_CHECKLIST = [
  'Create Google Workspace account',
  'Add employee to Slack channel',
  'Create calendar welcome block',
  'Send welcome email',
  'Notify manager and HR',
];

const SAMPLE_PAYLOADS: HROnboardingSamplePayload[] = [
  {
    key: 'webhook-new-hire',
    label: 'Webhook new hire',
    description: 'Teljes onboarding webhook payload HRIS forrásból.',
    payload: {
      employeeId: 'EMP-1024',
      employeeName: 'Kovács Anna',
      email: 'anna.kovacs@example.com',
      jobTitle: 'Account Manager',
      department: 'Sales',
      managerName: 'Nagy Péter',
      managerEmail: 'peter.nagy@example.com',
      startDate: '2026-04-08',
      location: 'Budapest',
      timezone: 'Europe/Budapest',
      trigger: 'webhook',
      source: 'hris-webhook',
      checklist: [...DEFAULT_CHECKLIST],
      integrations: {
        email: true,
        slack: true,
        calendar: true,
        googleWorkspace: true,
      },
    },
  },
  {
    key: 'manual-hybrid',
    label: 'Manual hybrid hire',
    description: 'Kézi onboarding ellenőrzés irodai és távoli hozzáféréssel.',
    payload: {
      employeeId: 'EMP-2048',
      employeeName: 'Szabó Gábor',
      email: 'gabor.szabo@example.com',
      jobTitle: 'Senior Developer',
      department: 'Engineering',
      managerName: 'Farkas Lilla',
      managerEmail: 'lilla.farkas@example.com',
      startDate: '2026-04-15',
      location: 'Remote',
      timezone: 'Europe/Budapest',
      trigger: 'manual',
      source: 'dashboard',
      checklist: [
        'Create Google Workspace account',
        'Assign engineering groups',
        'Book remote onboarding call',
        'Send welcome email',
      ],
      integrations: {
        email: true,
        slack: true,
        calendar: true,
        googleWorkspace: true,
      },
    },
  },
  {
    key: 'csv-contractor',
    label: 'CSV contractor',
    description: 'Egyszerű contractor payload, minimális integrációval.',
    payload: {
      employeeId: 'CTR-010',
      employeeName: 'Tóth Réka',
      email: 'reka.toth@example.com',
      jobTitle: 'Project Coordinator',
      department: 'Operations',
      managerName: 'Juhász Máté',
      startDate: '2026-04-20',
      trigger: 'csv',
      source: 'bulk-import',
      checklist: [
        'Create Google Workspace account',
        'Send welcome email',
        'Notify manager and HR',
      ],
      integrations: {
        email: true,
        slack: false,
        calendar: false,
        googleWorkspace: true,
      },
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function parseChecklist(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function normalizeTrigger(value: unknown): HROnboardingTrigger {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === 'hris' || normalized === 'webhook' || normalized === 'manual' || normalized === 'csv' || normalized === 'api') {
    return normalized;
  }

  return 'webhook';
}

function parseRequestedIntegrations(raw: HROnboardingRawPayload): HROnboardingRequestedIntegrations {
  const integrations = isRecord(raw.integrations) ? raw.integrations : {};
  return {
    email: asBoolean(integrations.email ?? raw.email, true),
    slack: asBoolean(integrations.slack, true),
    calendar: asBoolean(integrations.calendar, true),
    googleWorkspace: asBoolean(integrations.googleWorkspace, true),
  };
}

function pushIssue(issues: HROnboardingIssue[], issue: HROnboardingIssue): void {
  issues.push(issue);
}

export function getHROnboardingSamplePayloads(): HROnboardingSamplePayload[] {
  return SAMPLE_PAYLOADS.map((sample) => ({
    ...sample,
    payload: { ...sample.payload },
  }));
}

export function normalizeHROnboardingPayload(payload: unknown): HROnboardingNormalizedPayload {
  if (!isRecord(payload)) {
    throw new Error('HR onboarding payload must be an object');
  }

  const raw = payload as HROnboardingRawPayload;
  const employeeId = asTrimmedString(raw.employeeId ?? raw.employee_id) ?? 'UNKNOWN-EMPLOYEE';
  const employeeName = asTrimmedString(raw.employeeName ?? raw.employee_name ?? raw.fullName ?? raw.full_name) ?? 'Ismeretlen dolgozó';
  const email = asTrimmedString(raw.email ?? raw.workEmail ?? raw.work_email) ?? '';
  const jobTitle = asTrimmedString(raw.jobTitle ?? raw.job_title ?? raw.role) ?? 'Unspecified role';
  const department = asTrimmedString(raw.department) ?? 'Unknown department';
  const managerName = asTrimmedString(raw.managerName ?? raw.manager_name);
  const managerEmail = asTrimmedString(raw.managerEmail ?? raw.manager_email);
  const startDate = asTrimmedString(raw.startDate ?? raw.start_date);
  const location = asTrimmedString(raw.location);
  const timezone = asTrimmedString(raw.timezone);
  const trigger = normalizeTrigger(raw.trigger);
  const source = asTrimmedString(raw.source);
  const checklist = parseChecklist(raw.checklist);
  const requestedIntegrations = parseRequestedIntegrations(raw);

  return {
    employeeId,
    employeeName,
    email,
    jobTitle,
    department,
    managerName,
    managerEmail,
    startDate,
    location,
    timezone,
    trigger,
    source,
    checklist: checklist.length > 0 ? checklist : [...DEFAULT_CHECKLIST],
    requestedIntegrations,
  };
}

function buildIntegrationAvailability(normalized: HROnboardingNormalizedPayload): HROnboardingIntegrationAvailability[] {
  const authPaths = getGoogleWorkspaceAuthPaths();
  const emailConfigured = isNotificationEmailConfigured();
  const slackWebhook = process.env.SLACK_WEBHOOK_URL || process.env.BRUNELLA_SLACK_WEBHOOK_URL;
  const hasGoogleCredentials = existsSync(authPaths.credentialsPath);
  const hasGoogleToken = existsSync(authPaths.tokenPath);
  const googleWorkspaceAvailable = hasGoogleCredentials && hasGoogleToken;

  return [
    {
      channel: 'email',
      available: emailConfigured && normalized.requestedIntegrations.email,
      target: process.env.SMTP_TO,
      details: emailConfigured
        ? 'SMTP konfiguráció elérhető.'
        : 'SMTP konfiguráció hiányzik, az email kézbesítés dry-runban blokkolt.',
    },
    {
      channel: 'slack',
      available: Boolean(slackWebhook) && normalized.requestedIntegrations.slack,
      target: slackWebhook ? new URL(slackWebhook).host : undefined,
      details: slackWebhook
        ? 'Slack webhook elérhető.'
        : 'Slack webhook hiányzik, a Slack értesítés dry-runban blokkolt.',
    },
    {
      channel: 'calendar',
      available: googleWorkspaceAvailable && normalized.requestedIntegrations.calendar,
      target: authPaths.tokenPath,
      details: googleWorkspaceAvailable
        ? 'Google Workspace token és credentials megtalálva.'
        : 'Google Workspace token vagy credentials hiányzik.',
    },
    {
      channel: 'googleWorkspace',
      available: googleWorkspaceAvailable && normalized.requestedIntegrations.googleWorkspace,
      target: authPaths.credentialsPath,
      details: googleWorkspaceAvailable
        ? 'Google Workspace auth készen áll.'
        : 'Google Workspace auth nincs előkészítve.',
    },
  ];
}

function buildChecklist(
  normalized: HROnboardingNormalizedPayload,
  integrations: HROnboardingIntegrationAvailability[],
  issues: HROnboardingIssue[],
): HROnboardingChecklistItem[] {
  const hasIdentity = normalized.employeeName !== 'Ismeretlen dolgozó' && normalized.email.length > 0;
  const hasManager = Boolean(normalized.managerName || normalized.managerEmail);
  const hasStartDate = Boolean(normalized.startDate);
  const workspaceAvailability = integrations.find((item) => item.channel === 'googleWorkspace');
  const emailAvailability = integrations.find((item) => item.channel === 'email');
  const slackAvailability = integrations.find((item) => item.channel === 'slack');
  const calendarAvailability = integrations.find((item) => item.channel === 'calendar');

  const checklist: HROnboardingChecklistItem[] = [
    {
      id: 'trigger-mapping',
      label: 'Onboarding trigger mapping',
      required: true,
      state: normalized.trigger ? 'ready' : 'blocked',
      details: `Trigger: ${normalized.trigger.toUpperCase()}${normalized.source ? ` · source: ${normalized.source}` : ''}`,
    },
    {
      id: 'identity-and-manager',
      label: 'Employee identity and manager context',
      required: true,
      state: hasIdentity && hasManager ? 'ready' : 'blocked',
      details: hasIdentity
        ? hasManager
          ? 'Employee, email and manager context available.'
          : 'Manager context is missing from the payload.'
        : 'Employee name and email are required for provisioning.',
    },
    {
      id: 'start-date',
      label: 'Start date readiness',
      required: true,
      state: hasStartDate ? 'ready' : 'blocked',
      details: normalized.startDate ?? 'Start date missing from payload.',
    },
    {
      id: 'google-workspace-dry-run',
      label: 'Google Workspace provisioning dry-run',
      required: true,
      state: workspaceAvailability?.available ? 'ready' : 'needs-setup',
      details: workspaceAvailability?.details ?? 'Google Workspace status unavailable.',
    },
    {
      id: 'slack-handoff',
      label: 'Slack handoff',
      required: false,
      state: slackAvailability?.available ? 'ready' : 'needs-setup',
      details: slackAvailability?.details ?? 'Slack availability unavailable.',
    },
    {
      id: 'email-notification',
      label: 'Email notification',
      required: false,
      state: emailAvailability?.available ? 'ready' : 'needs-setup',
      details: emailAvailability?.details ?? 'Email availability unavailable.',
    },
    {
      id: 'calendar-invite',
      label: 'Calendar invite',
      required: false,
      state: calendarAvailability?.available ? 'ready' : 'needs-setup',
      details: calendarAvailability?.details ?? 'Calendar availability unavailable.',
    },
    {
      id: 'checklist-workflow',
      label: 'Checklist workflow',
      required: true,
      state: normalized.checklist.length > 0 ? 'ready' : 'blocked',
      details: normalized.checklist.length > 0
        ? `${normalized.checklist.length} checklist step configured.`
        : 'Checklist steps are missing.',
    },
  ];

  if (issues.some((issue) => issue.code === 'missing-email')) {
    checklist.push({
      id: 'missing-email',
      label: 'Employee email address',
      required: true,
      state: 'blocked',
      details: 'Provisioning dry-run requires a work email address.',
    });
  }

  return checklist;
}

function buildMissingList(issues: HROnboardingIssue[]): string[] {
  return issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.field ? `${issue.field}: ${issue.message}` : issue.message);
}

function buildNextSteps(
  report: HROnboardingDryRunReport,
  normalized: HROnboardingNormalizedPayload,
): string[] {
  const steps: string[] = [];
  for (const issue of report.issues) {
    if (issue.severity === 'error') {
      steps.push(issue.message);
    }
  }

  for (const integration of report.integrations) {
    if (!integration.available) {
      steps.push(`Configure ${integration.channel} support before live onboarding.`);
    }
  }

  if (steps.length === 0) {
    steps.push(`Ready to launch onboarding for ${normalized.employeeName}.`);
  }

  return steps;
}

export function buildHROnboardingDryRunReport(payload: unknown): HROnboardingDryRunResult {
  const normalized = normalizeHROnboardingPayload(payload);
  const issues: HROnboardingIssue[] = [];

  if (normalized.email.length === 0) {
    pushIssue(issues, {
      code: 'missing-email',
      field: 'email',
      severity: 'error',
      message: 'Work email is required for HR onboarding.',
    });
  }

  if (normalized.employeeName === 'Ismeretlen dolgozó') {
    pushIssue(issues, {
      code: 'missing-name',
      field: 'employeeName',
      severity: 'error',
      message: 'Employee name is required for HR onboarding.',
    });
  }

  if (normalized.jobTitle === 'Unspecified role') {
    pushIssue(issues, {
      code: 'missing-role',
      field: 'jobTitle',
      severity: 'warning',
      message: 'Job title missing, defaulting to Unspecified role.',
    });
  }

  if (!normalized.startDate) {
    pushIssue(issues, {
      code: 'missing-start-date',
      field: 'startDate',
      severity: 'error',
      message: 'Start date is required for onboarding scheduling.',
    });
  } else if (Number.isNaN(new Date(normalized.startDate).getTime())) {
    pushIssue(issues, {
      code: 'invalid-start-date',
      field: 'startDate',
      severity: 'error',
      message: 'Start date is not a valid ISO date.',
    });
  }

  if (normalized.checklist.length === 0) {
    pushIssue(issues, {
      code: 'missing-checklist',
      field: 'checklist',
      severity: 'error',
      message: 'Checklist workflow is empty.',
    });
  }

  const integrations = buildIntegrationAvailability(normalized);
  const checklist = buildChecklist(normalized, integrations, issues);

  const blockedRequiredChecks = checklist.some(
    (item) => item.required && item.state !== 'ready',
  );
  const report: HROnboardingDryRunReport = {
    status: issues.some((issue) => issue.severity === 'error') || blockedRequiredChecks
      ? 'blocked'
      : 'ready',
    timestamp: new Date().toISOString(),
    summary: {
      total: checklist.length,
      ready: checklist.filter((item) => item.state === 'ready').length,
      blocked: checklist.filter((item) => item.state === 'blocked' || item.state === 'needs-setup').length,
    },
    missing: buildMissingList(issues),
    issues,
    checklist,
    integrations,
    nextSteps: [],
  };

  report.nextSteps = buildNextSteps(report, normalized);

  return { normalized, report };
}
