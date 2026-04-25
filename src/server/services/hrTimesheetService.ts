import type Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { record as auditRecord } from '../../core/auditLog.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo, logWarn } from '../../utils/logger.js';

export type HRTimesheetAlertType = 'birthday' | 'anniversary';
export type HRTimesheetRunType = 'monthly_export' | 'daily_alerts';

export interface HRTimesheetSubmissionInput {
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  taskDescription: string;
  projectCode?: string;
  birthDate?: string;
  hireDate?: string;
}

export interface HRTimesheetEntryRecord extends HRTimesheetSubmissionInput {
  id: string;
  dedupKey: string;
  agentResultJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HRTimesheetExportRow {
  employeeId: string;
  employeeName: string;
  month: string;
  totalHours: number;
  entriesCount: number;
  firstDate: string;
  lastDate: string;
  projectCodes: string;
  taskDescriptions: string;
}

export interface HRTimesheetExportResult {
  success: boolean;
  runKey: string;
  month: string;
  outputFormat: 'csv';
  outputPath: string;
  csv: string;
  rows: HRTimesheetExportRow[];
  totalHours: number;
  totalEntries: number;
  employeeCount: number;
}

export interface HRTimesheetAlertRecord {
  alertKey: string;
  employeeId: string;
  employeeName: string;
  alertType: HRTimesheetAlertType;
  alertDate: string;
  message: string;
  yearsOfService?: number;
}

export interface HRTimesheetAlertResult {
  success: boolean;
  runKey: string;
  date: string;
  alerts: HRTimesheetAlertRecord[];
  generatedCount: number;
  suppressedCount: number;
}

interface HRTimesheetEntryRow {
  id: string;
  dedup_key: string;
  employee_id: string;
  employee_name: string;
  entry_date: string;
  hours: number;
  task_description: string;
  project_code: string | null;
  birth_date: string | null;
  hire_date: string | null;
  agent_result_json: string | null;
  created_at: string;
  updated_at: string;
}

interface HRTimesheetProfileRow {
  employee_id: string;
  employee_name: string;
  birth_date: string | null;
  hire_date: string | null;
  created_at: string;
  updated_at: string;
}

interface HRTimesheetAlertProfileSource {
  employeeId: string;
  employeeName: string;
  birthDate: string | null;
  hireDate: string | null;
}

const RUN_ROOT = path.join(process.cwd(), 'data', 'hr-timesheet');

function getDatabase(database?: Database.Database): Database.Database {
  return database ?? getGlobalDb();
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function normalizeDateKey(value: string | undefined, fallbackDate: Date): string {
  if (value && isIsoDate(value)) {
    return value;
  }

  return fallbackDate.toISOString().slice(0, 10);
}

function normalizeMonthKey(value: string | undefined, fallbackDate: Date): string {
  if (value && isMonthKey(value)) {
    return value;
  }

  return fallbackDate.toISOString().slice(0, 7);
}

function previousMonthKey(date: Date): string {
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return previous.toISOString().slice(0, 7);
}

function monthBounds(monthKey: string): { start: string; end: string } {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number.parseInt(yearText, 10);
  const monthIndex = Number.parseInt(monthText, 10) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(rows: HRTimesheetExportRow[]): string {
  const headers = [
    'employeeId',
    'employeeName',
    'month',
    'totalHours',
    'entriesCount',
    'firstDate',
    'lastDate',
    'projectCodes',
    'taskDescriptions',
  ];

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      row.employeeId,
      row.employeeName,
      row.month,
      row.totalHours.toFixed(2),
      row.entriesCount,
      row.firstDate,
      row.lastDate,
      row.projectCodes,
      row.taskDescriptions,
    ].map(escapeCsvCell).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function buildRunKey(runType: HRTimesheetRunType, periodKey: string): string {
  return `hr-timesheet:${runType}:${periodKey}`;
}

function profileSourceFromRow(row: HRTimesheetEntryRow): HRTimesheetAlertProfileSource {
  return {
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    birthDate: row.birth_date,
    hireDate: row.hire_date,
  };
}

function sameMonthDay(left: string, right: string): boolean {
  return left.slice(5) === right.slice(5);
}

function yearsBetween(hireDate: string, alertDate: string): number {
  const hireYear = Number.parseInt(hireDate.slice(0, 4), 10);
  const alertYear = Number.parseInt(alertDate.slice(0, 4), 10);
  return alertYear - hireYear;
}

/**
 * Create the HR timesheet persistence schema.
 */
export function initHRTimesheetSchema(database?: Database.Database): Database.Database {
  const db = getDatabase(database);

  db.exec(`
    CREATE TABLE IF NOT EXISTS hr_timesheet_entries (
      id TEXT PRIMARY KEY,
      dedup_key TEXT NOT NULL UNIQUE,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      hours REAL NOT NULL,
      task_description TEXT NOT NULL,
      project_code TEXT,
      birth_date TEXT,
      hire_date TEXT,
      agent_result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hr_timesheet_entries_employee_date
      ON hr_timesheet_entries(employee_id, entry_date);

    CREATE INDEX IF NOT EXISTS idx_hr_timesheet_entries_month
      ON hr_timesheet_entries(entry_date);

    CREATE TABLE IF NOT EXISTS hr_employee_profiles (
      employee_id TEXT PRIMARY KEY,
      employee_name TEXT NOT NULL,
      birth_date TEXT,
      hire_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hr_timesheet_automation_runs (
      run_key TEXT PRIMARY KEY,
      run_type TEXT NOT NULL CHECK (run_type IN ('monthly_export', 'daily_alerts')),
      period_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
      output_format TEXT,
      output_path TEXT,
      payload_json TEXT,
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hr_timesheet_runs_type_period
      ON hr_timesheet_automation_runs(run_type, period_key);

    CREATE TABLE IF NOT EXISTS hr_timesheet_alert_events (
      alert_key TEXT PRIMARY KEY,
      run_key TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      alert_type TEXT NOT NULL CHECK (alert_type IN ('birthday', 'anniversary')),
      alert_date TEXT NOT NULL,
      message TEXT NOT NULL,
      years_of_service INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hr_timesheet_alert_events_date
      ON hr_timesheet_alert_events(alert_date);
  `);

  return db;
}

async function upsertEmployeeProfile(
  db: Database.Database,
  entry: HRTimesheetSubmissionInput,
  now: string,
): Promise<void> {
  db.prepare(`
    INSERT INTO hr_employee_profiles (
      employee_id,
      employee_name,
      birth_date,
      hire_date,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id) DO UPDATE SET
      employee_name = excluded.employee_name,
      birth_date = COALESCE(excluded.birth_date, hr_employee_profiles.birth_date),
      hire_date = COALESCE(excluded.hire_date, hr_employee_profiles.hire_date),
      updated_at = excluded.updated_at
  `).run(
    entry.employeeId,
    entry.employeeName,
    entry.birthDate ?? null,
    entry.hireDate ?? null,
    now,
    now,
  );
}

/**
 * Persist a validated timesheet submission for export and audit flows.
 */
export async function recordHRTimesheetSubmission(
  submission: HRTimesheetSubmissionInput,
  agentResult: unknown,
  database?: Database.Database,
): Promise<HRTimesheetEntryRecord> {
  const db = initHRTimesheetSchema(database);
  const now = new Date().toISOString();
  const dedupKey = `${submission.employeeId}:${submission.date}`;
  const entryId = dedupKey;
  const agentResultJson = agentResult === undefined ? null : JSON.stringify(agentResult);

  try {
    db.prepare(`
      INSERT INTO hr_timesheet_entries (
        id,
        dedup_key,
        employee_id,
        employee_name,
        entry_date,
        hours,
        task_description,
        project_code,
        birth_date,
        hire_date,
        agent_result_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dedup_key) DO UPDATE SET
        employee_id = excluded.employee_id,
        employee_name = excluded.employee_name,
        entry_date = excluded.entry_date,
        hours = excluded.hours,
        task_description = excluded.task_description,
        project_code = excluded.project_code,
        birth_date = excluded.birth_date,
        hire_date = excluded.hire_date,
        agent_result_json = excluded.agent_result_json,
        updated_at = excluded.updated_at
    `).run(
      entryId,
      dedupKey,
      submission.employeeId,
      submission.employeeName,
      submission.date,
      submission.hours,
      submission.taskDescription,
      submission.projectCode ?? null,
      submission.birthDate ?? null,
      submission.hireDate ?? null,
      agentResultJson,
      now,
      now,
    );

    await upsertEmployeeProfile(db, submission, now);

    const row = db.prepare(`
      SELECT id, dedup_key, employee_id, employee_name, entry_date, hours, task_description, project_code,
             birth_date, hire_date, agent_result_json, created_at, updated_at
      FROM hr_timesheet_entries
      WHERE dedup_key = ?
    `).get(dedupKey) as HRTimesheetEntryRow | undefined;

    if (!row) {
      throw new Error('Failed to persist timesheet entry');
    }

    return {
      id: row.id,
      dedupKey: row.dedup_key,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      date: row.entry_date,
      hours: row.hours,
      taskDescription: row.task_description,
      projectCode: row.project_code ?? undefined,
      birthDate: row.birth_date ?? undefined,
      hireDate: row.hire_date ?? undefined,
      agentResultJson: row.agent_result_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error: unknown) {
    const normalized = ensureError(error);
    logError('HRTimesheetService', `Failed to persist submission: ${normalized.message}`);
    throw normalized;
  } finally {
    // Intentionally empty: database lifecycle is managed by the caller/global store.
  }
}

/**
 * Generate a payroll-ready monthly CSV export.
 */
export async function runMonthlyPayrollExport(options: {
  month?: string;
  triggeredBy?: string;
  database?: Database.Database;
} = {}): Promise<HRTimesheetExportResult> {
  const db = initHRTimesheetSchema(options.database);
  const referenceDate = new Date();
  const monthKey = normalizeMonthKey(options.month, referenceDate);
  const runKey = buildRunKey('monthly_export', monthKey);
  const outputPath = path.join(RUN_ROOT, 'exports', `timesheet-export-${monthKey}.csv`);
  const payload = {
    month: monthKey,
    triggeredBy: options.triggeredBy ?? 'manual',
    outputPath,
  };

  try {
    db.prepare(`
      INSERT INTO hr_timesheet_automation_runs (
        run_key,
        run_type,
        period_key,
        status,
        output_format,
        output_path,
        payload_json,
        result_json,
        created_at,
        updated_at
      ) VALUES (?, 'monthly_export', ?, 'in_progress', 'csv', ?, ?, NULL, ?, ?)
      ON CONFLICT(run_key) DO UPDATE SET
        status = excluded.status,
        output_format = excluded.output_format,
        output_path = excluded.output_path,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(runKey, monthKey, outputPath, JSON.stringify(payload), new Date().toISOString(), new Date().toISOString());

    const { start, end } = monthBounds(monthKey);
    const rows = db.prepare(`
      SELECT id, dedup_key, employee_id, employee_name, entry_date, hours, task_description, project_code,
             birth_date, hire_date, agent_result_json, created_at, updated_at
      FROM hr_timesheet_entries
      WHERE entry_date >= ? AND entry_date < ?
      ORDER BY employee_id ASC, entry_date ASC, id ASC
    `).all(start, end) as HRTimesheetEntryRow[];

    const grouped = new Map<string, {
      employeeId: string;
      employeeName: string;
      totalHours: number;
      entriesCount: number;
      firstDate: string;
      lastDate: string;
      projectCodes: Set<string>;
      taskDescriptions: Set<string>;
    }>();

    for (const row of rows) {
      const groupKey = `${row.employee_id}:${row.employee_name}`;
      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          totalHours: row.hours,
          entriesCount: 1,
          firstDate: row.entry_date,
          lastDate: row.entry_date,
          projectCodes: new Set(row.project_code ? [row.project_code] : []),
          taskDescriptions: new Set([row.task_description]),
        });
        continue;
      }

      existing.totalHours += row.hours;
      existing.entriesCount += 1;
      if (row.entry_date < existing.firstDate) {
        existing.firstDate = row.entry_date;
      }
      if (row.entry_date > existing.lastDate) {
        existing.lastDate = row.entry_date;
      }
      if (row.project_code) {
        existing.projectCodes.add(row.project_code);
      }
      existing.taskDescriptions.add(row.task_description);
    }

    const exportRows: HRTimesheetExportRow[] = [...grouped.values()].map((group) => ({
      employeeId: group.employeeId,
      employeeName: group.employeeName,
      month: monthKey,
      totalHours: Number(group.totalHours.toFixed(2)),
      entriesCount: group.entriesCount,
      firstDate: group.firstDate,
      lastDate: group.lastDate,
      projectCodes: [...group.projectCodes].join(' | '),
      taskDescriptions: [...group.taskDescriptions].join(' | '),
    }));

    const csv = buildCsv(exportRows);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, csv, 'utf8');

    const result: HRTimesheetExportResult = {
      success: true,
      runKey,
      month: monthKey,
      outputFormat: 'csv',
      outputPath,
      csv,
      rows: exportRows,
      totalHours: Number(exportRows.reduce((sum, row) => sum + row.totalHours, 0).toFixed(2)),
      totalEntries: rows.length,
      employeeCount: exportRows.length,
    };

    db.prepare(`
      UPDATE hr_timesheet_automation_runs
      SET status = 'completed',
          result_json = ?,
          updated_at = ?
      WHERE run_key = ?
    `).run(JSON.stringify(result), new Date().toISOString(), runKey);

    await auditRecord(
      'ALLOWED',
      'HRTimesheetExport',
      'monthly_export',
      runKey,
      `Exported ${result.employeeCount} employee rows (${result.totalEntries} entries) to ${outputPath}`,
    );

    logInfo('HRTimesheetService', `Monthly export completed for ${monthKey}`);
    return result;
  } catch (error: unknown) {
    const normalized = ensureError(error);

    try {
      db.prepare(`
        UPDATE hr_timesheet_automation_runs
        SET status = 'failed',
            result_json = ?,
            updated_at = ?
        WHERE run_key = ?
      `).run(JSON.stringify({ error: normalized.message }), new Date().toISOString(), runKey);
    } catch (stateError: unknown) {
      logWarn('HRTimesheetService', `Failed to persist export failure state: ${ensureError(stateError).message}`);
    }

    await auditRecord('DENIED', 'HRTimesheetExport', 'monthly_export', runKey, normalized.message);
    logError('HRTimesheetService', `Monthly export failed for ${monthKey}: ${normalized.message}`);
    throw normalized;
  } finally {
    // Intentionally empty: the export writes a stable file path and does not need local cleanup.
  }
}

/**
 * Generate birthday and work-anniversary alerts for a given day.
 */
export async function runDailyCultureAlerts(options: {
  date?: string;
  triggeredBy?: string;
  database?: Database.Database;
} = {}): Promise<HRTimesheetAlertResult> {
  const db = initHRTimesheetSchema(options.database);
  const referenceDate = new Date();
  const alertDate = normalizeDateKey(options.date, referenceDate);
  const runKey = buildRunKey('daily_alerts', alertDate);
  const payload = {
    date: alertDate,
    triggeredBy: options.triggeredBy ?? 'manual',
  };

  try {
    db.prepare(`
      INSERT INTO hr_timesheet_automation_runs (
        run_key,
        run_type,
        period_key,
        status,
        output_format,
        output_path,
        payload_json,
        result_json,
        created_at,
        updated_at
      ) VALUES (?, 'daily_alerts', ?, 'in_progress', NULL, NULL, ?, NULL, ?, ?)
      ON CONFLICT(run_key) DO UPDATE SET
        status = excluded.status,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(runKey, alertDate, JSON.stringify(payload), new Date().toISOString(), new Date().toISOString());

    const profiles = db.prepare(`
      SELECT employee_id, employee_name, birth_date, hire_date, created_at, updated_at
      FROM hr_employee_profiles
      ORDER BY employee_name ASC
    `).all() as HRTimesheetProfileRow[];

    const alerts: HRTimesheetAlertRecord[] = [];
    let suppressedCount = 0;

    for (const profile of profiles) {
      const source = profileSourceFromRow({
        id: profile.employee_id,
        dedup_key: profile.employee_id,
        employee_id: profile.employee_id,
        employee_name: profile.employee_name,
        entry_date: alertDate,
        hours: 0,
        task_description: '',
        project_code: null,
        birth_date: profile.birth_date,
        hire_date: profile.hire_date,
        agent_result_json: null,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      });

      if (source.birthDate && sameMonthDay(source.birthDate, alertDate)) {
        const alertKey = `birthday:${source.employeeId}:${alertDate}`;
        const message = `Birthday reminder for ${source.employeeName}`;
        const result = db.prepare(`
          INSERT INTO hr_timesheet_alert_events (
            alert_key,
            run_key,
            employee_id,
            employee_name,
            alert_type,
            alert_date,
            message,
            years_of_service,
            created_at
          ) VALUES (?, ?, ?, ?, 'birthday', ?, ?, NULL, ?)
          ON CONFLICT(alert_key) DO NOTHING
        `).run(alertKey, runKey, source.employeeId, source.employeeName, alertDate, message, new Date().toISOString());

        if (result.changes > 0) {
          alerts.push({
            alertKey,
            employeeId: source.employeeId,
            employeeName: source.employeeName,
            alertType: 'birthday',
            alertDate,
            message,
          });
        } else {
          suppressedCount += 1;
        }
      }

      if (source.hireDate && sameMonthDay(source.hireDate, alertDate)) {
        const years = yearsBetween(source.hireDate, alertDate);
        if (years > 0) {
          const alertKey = `anniversary:${source.employeeId}:${alertDate}`;
          const message = `Work anniversary reminder for ${source.employeeName} (${years} year${years === 1 ? '' : 's'})`;
          const result = db.prepare(`
            INSERT INTO hr_timesheet_alert_events (
              alert_key,
              run_key,
              employee_id,
              employee_name,
              alert_type,
              alert_date,
              message,
              years_of_service,
              created_at
            ) VALUES (?, ?, ?, ?, 'anniversary', ?, ?, ?, ?)
            ON CONFLICT(alert_key) DO NOTHING
          `).run(alertKey, runKey, source.employeeId, source.employeeName, alertDate, message, years, new Date().toISOString());

          if (result.changes > 0) {
            alerts.push({
              alertKey,
              employeeId: source.employeeId,
              employeeName: source.employeeName,
              alertType: 'anniversary',
              alertDate,
              message,
              yearsOfService: years,
            });
          } else {
            suppressedCount += 1;
          }
        }
      }
    }

    const result: HRTimesheetAlertResult = {
      success: true,
      runKey,
      date: alertDate,
      alerts,
      generatedCount: alerts.length,
      suppressedCount,
    };

    db.prepare(`
      UPDATE hr_timesheet_automation_runs
      SET status = 'completed',
          result_json = ?,
          updated_at = ?
      WHERE run_key = ?
    `).run(JSON.stringify(result), new Date().toISOString(), runKey);

    await auditRecord(
      'ALLOWED',
      'HRTimesheetAlerts',
      'daily_alerts',
      runKey,
      `Generated ${result.generatedCount} culture alerts (${result.suppressedCount} suppressed) for ${alertDate}`,
    );

    logInfo('HRTimesheetService', `Daily alerts completed for ${alertDate}`);
    return result;
  } catch (error: unknown) {
    const normalized = ensureError(error);

    try {
      db.prepare(`
        UPDATE hr_timesheet_automation_runs
        SET status = 'failed',
            result_json = ?,
            updated_at = ?
        WHERE run_key = ?
      `).run(JSON.stringify({ error: normalized.message }), new Date().toISOString(), runKey);
    } catch (stateError: unknown) {
      logWarn('HRTimesheetService', `Failed to persist alert failure state: ${ensureError(stateError).message}`);
    }

    await auditRecord('DENIED', 'HRTimesheetAlerts', 'daily_alerts', runKey, normalized.message);
    logError('HRTimesheetService', `Daily alerts failed for ${alertDate}: ${normalized.message}`);
    throw normalized;
  } finally {
    // Intentionally empty: the alert run persists all state explicitly in SQLite.
  }
}

/**
 * Resolve the default monthly export target for the scheduler.
 */
export function resolveSchedulerExportMonth(now = new Date()): string {
  return previousMonthKey(now);
}
