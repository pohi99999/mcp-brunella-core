import type Database from 'better-sqlite3';
import { initHRTimesheetSchema } from './hrTimesheetService.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError } from '../../utils/logger.js';
import type {
  HRTimesheetAutomationRunType,
  HRTimesheetLatestDailyAlert,
  HRTimesheetLatestMonthlyExport,
  HRTimesheetRunStatus,
  HRTimesheetStatusSnapshot,
} from '../../types/hrTimesheetStatus.js';

interface CountRow {
  count: number;
}

interface AutomationRunRow {
  run_key: string;
  run_type: HRTimesheetAutomationRunType;
  period_key: string;
  status: string;
  output_path: string | null;
  result_json: string | null;
  updated_at: string;
  created_at: string;
}

interface AlertTotalRow {
  alert_type: 'birthday' | 'anniversary';
  count: number;
}

interface MonthlyExportResultJson {
  employeeCount?: unknown;
  totalEntries?: unknown;
  totalHours?: unknown;
}

interface DailyAlertResultJson {
  date?: unknown;
  generatedCount?: unknown;
  suppressedCount?: unknown;
}

function getDatabase(database?: Database.Database): Database.Database {
  return initHRTimesheetSchema(database);
}

function getCount(db: Database.Database, table: string, whereClause?: string): number {
  const query = whereClause
    ? `SELECT COUNT(*) AS count FROM ${table} WHERE ${whereClause}`
    : `SELECT COUNT(*) AS count FROM ${table}`;

  const row = db.prepare(query).get() as CountRow | undefined;
  return row?.count ?? 0;
}

function getRunStatus(value: string | null | undefined): HRTimesheetRunStatus {
  if (value === 'completed' || value === 'failed' || value === 'in_progress') {
    return value;
  }

  return 'unknown';
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error: unknown) {
    const normalized = ensureError(error);
    logError('HRTimesheetStatusSnapshot', `Unable to parse status payload JSON: ${normalized.message}`);
    return null;
  }
}

function loadLatestMonthlyExport(db: Database.Database): HRTimesheetLatestMonthlyExport | null {
  const row = db.prepare(`
    SELECT run_key, run_type, period_key, status, output_path, result_json, updated_at, created_at
    FROM hr_timesheet_automation_runs
    WHERE run_type = 'monthly_export'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).get() as AutomationRunRow | undefined;

  if (!row) {
    return null;
  }

  const result = safeJsonParse<MonthlyExportResultJson>(row.result_json);

  return {
    month: row.period_key,
    status: getRunStatus(row.status),
    employeeCount: toNumber(result?.employeeCount),
    totalEntries: toNumber(result?.totalEntries),
    totalHours: toNumber(result?.totalHours),
    outputPath: row.output_path,
    updatedAt: row.updated_at,
  };
}

function loadLatestDailyAlert(db: Database.Database): HRTimesheetLatestDailyAlert | null {
  const row = db.prepare(`
    SELECT run_key, run_type, period_key, status, output_path, result_json, updated_at, created_at
    FROM hr_timesheet_automation_runs
    WHERE run_type = 'daily_alerts'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).get() as AutomationRunRow | undefined;

  if (!row) {
    return null;
  }

  const result = safeJsonParse<DailyAlertResultJson>(row.result_json);

  return {
    date: typeof result?.date === 'string' && result.date.trim().length > 0 ? result.date : row.period_key,
    status: getRunStatus(row.status),
    generatedCount: toNumber(result?.generatedCount),
    suppressedCount: toNumber(result?.suppressedCount),
    updatedAt: row.updated_at,
  };
}

function loadAlertTotalsByType(db: Database.Database): { birthday: number; anniversary: number } {
  const rows = db.prepare(`
    SELECT alert_type, COUNT(*) AS count
    FROM hr_timesheet_alert_events
    GROUP BY alert_type
  `).all() as AlertTotalRow[];

  const totals = { birthday: 0, anniversary: 0 };
  for (const row of rows) {
    if (row.alert_type === 'birthday') {
      totals.birthday = row.count;
    }
    if (row.alert_type === 'anniversary') {
      totals.anniversary = row.count;
    }
  }

  return totals;
}

function buildHeadline(counts: HRTimesheetStatusSnapshot['counts'], latestMonthlyExport: HRTimesheetLatestMonthlyExport | null, latestDailyAlert: HRTimesheetLatestDailyAlert | null): string {
  if (counts.entries === 0 && counts.employees === 0) {
    return 'HR timesheet data is not populated yet.';
  }

  if (latestMonthlyExport?.status !== 'completed') {
    return 'Monthly export needs attention.';
  }

  if (latestDailyAlert?.status !== 'completed') {
    return 'Daily culture alerts need review.';
  }

  return 'HR timesheet and culture flow is healthy.';
}

function buildRecommendation(counts: HRTimesheetStatusSnapshot['counts'], latestMonthlyExport: HRTimesheetLatestMonthlyExport | null, latestDailyAlert: HRTimesheetLatestDailyAlert | null): string {
  if (counts.entries === 0) {
    return 'Seed the first timesheet submission before relying on the monthly export surface.';
  }

  if (!latestMonthlyExport) {
    return 'Run the monthly export once so the cockpit can show payroll-ready output details.';
  }

  if (!latestDailyAlert) {
    return 'Run the daily alert job to expose birthday and anniversary coverage in the cockpit.';
  }

  return 'Keep the read-only cockpit visible and use the latest runs to spot regressions early.';
}

export function buildHRTimesheetStatusSnapshot(database?: Database.Database): HRTimesheetStatusSnapshot {
  const db = getDatabase(database);
  const normalizedCounts = {
    entries: getCount(db, 'hr_timesheet_entries'),
    employees: getCount(db, 'hr_employee_profiles'),
    monthlyExports: getCount(db, 'hr_timesheet_automation_runs', "run_type = 'monthly_export'"),
    dailyAlertRuns: getCount(db, 'hr_timesheet_automation_runs', "run_type = 'daily_alerts'"),
  };

  const latestMonthlyExport = loadLatestMonthlyExport(db);
  const latestDailyAlert = loadLatestDailyAlert(db);

  const alertTotalsByType = loadAlertTotalsByType(db);

  return {
    checkedAt: new Date().toISOString(),
    headline: buildHeadline(normalizedCounts, latestMonthlyExport, latestDailyAlert),
    recommendation: buildRecommendation(normalizedCounts, latestMonthlyExport, latestDailyAlert),
    counts: normalizedCounts,
    latestMonthlyExport,
    latestDailyAlert,
    alertTotalsByType,
  };
}
