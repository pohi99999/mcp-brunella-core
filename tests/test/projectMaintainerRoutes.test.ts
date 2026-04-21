import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectMaintainerRoutes } from '../src/server/routes/projectMaintainer.js';
import * as projectMaintainerService from '../src/server/services/projectMaintainerService.js';

vi.mock('../src/server/services/projectMaintainerService.js', async () => {
  const actual = await vi.importActual<typeof import('../src/server/services/projectMaintainerService.js')>(
    '../src/server/services/projectMaintainerService.js',
  );
  return {
    ...actual,
    runProjectMaintainerReport: vi.fn(actual.runProjectMaintainerReport),
  };
});

describe('Project Maintainer routes', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    db = new Database(':memory:');
    projectMaintainerService.initProjectMaintainerSchema(db);
    app = express();
    app.use('/api/v1/project-maintainer', createProjectMaintainerRoutes(db));
  });

  it('returns latest report when persisted data exists', async () => {
    db.prepare(`
      INSERT INTO project_maintainer_reports (id, generated_at, findings_count, suggestions_count, report_json, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'pmr-1',
      '2026-04-02T22:00:00.000Z',
      1,
      1,
      JSON.stringify({
        id: 'pmr-1',
        generatedAt: '2026-04-02T22:00:00.000Z',
        triggeredBy: 'scheduler',
        findings: [{ category: 'root-noise', severity: 'medium', message: 'Artefakt', path: 'debug_view.txt' }],
        suggestions: [{ action: 'review', target: 'debug_view.txt', reason: 'Vizsgáld meg.' }],
        trackSummary: { total: 1, missingSpec: [], missingPlan: [], healthy: 1 },
        dryRun: true,
      }),
      'scheduler',
    );

    const response = await request(app).get('/api/v1/project-maintainer/reports/latest');

    expect(response.status).toBe(200);
    expect(response.body.report.dryRun).toBe(true);
    expect(response.body.report.suggestions[0].action).toBe('review');
  });

  it('returns 404 when no persisted report exists', async () => {
    const response = await request(app).get('/api/v1/project-maintainer/reports/latest');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('Még nincs riport');
  });

  it('runs an on-demand dry-run report through the service', async () => {
    vi.mocked(projectMaintainerService.runProjectMaintainerReport).mockResolvedValue({
      id: 'pmr-2',
      generatedAt: '2026-04-02T22:05:00.000Z',
      triggeredBy: 'api',
      findings: [],
      suggestions: [],
      trackSummary: { total: 1, missingSpec: [], missingPlan: [], healthy: 1 },
      dryRun: true,
    });

    const response = await request(app).post('/api/v1/project-maintainer/run');

    expect(response.status).toBe(200);
    expect(projectMaintainerService.runProjectMaintainerReport).toHaveBeenCalledWith({
      triggeredBy: 'manual',
      dryRun: true,
      db,
    });
    expect(response.body.success).toBe(true);
    expect(response.body.report.dryRun).toBe(true);
  });
});
