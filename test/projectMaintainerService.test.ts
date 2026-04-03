import Database from 'better-sqlite3';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initProjectMaintainerSchema, runProjectMaintainerReport } from '../src/server/services/projectMaintainerService.js';

describe('ProjectMaintainerService', () => {
  let tempDir: string;
  let previousCwd: string;
  let db: Database.Database;

  beforeEach(async () => {
    previousCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brunella-pm-'));
    await fs.mkdir(path.join(tempDir, 'conductor', 'tracks', 'safe-track'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'conductor', 'tracks', 'safe-track', 'spec.md'), '# spec');
    await fs.writeFile(path.join(tempDir, 'conductor', 'tracks', 'safe-track', 'plan.md'), '# plan');
    await fs.writeFile(path.join(tempDir, 'debug_view.txt'), 'noise');
    await fs.mkdir(path.join(tempDir, 'rogue-dir'));
    process.chdir(tempDir);

    db = new Database(':memory:');
    initProjectMaintainerSchema(db);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    db.close();
  });

  it('creates a dry-run report and persists it without destructive suggestions', async () => {
    const report = await runProjectMaintainerReport({ db, triggeredBy: 'test', dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.suggestions.every((suggestion) => suggestion.action !== 'delete' && suggestion.action !== 'move')).toBe(true);

    const row = db.prepare('SELECT findings_count, suggestions_count, report_json FROM project_maintainer_reports LIMIT 1').get() as {
      findings_count: number;
      suggestions_count: number;
      report_json: string;
    };

    expect(row.findings_count).toBe(report.findings.length);
    expect(row.suggestions_count).toBe(report.suggestions.length);
    expect(JSON.parse(row.report_json).dryRun).toBe(true);
  });
});
