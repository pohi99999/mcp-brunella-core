import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseManager } from '../src/utils/db.js';
import { agentManager } from '../src/agents/AgentManager.js';
import { createBusinessJobsRoutes } from '../src/server/routes/businessJobs.js';

describe('business jobs routes', () => {
  let tempDir: string;
  let manager: DatabaseManager;
  let app: express.Express;

  beforeEach(async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'business-jobs-routes-'));
    manager = new DatabaseManager(path.join(tempDir, 'brunella.db'));

    const db = await manager.getDb();
    db!.prepare('INSERT INTO business_jobs (id, type, status, query) VALUES (?, ?, ?, ?)').run(
      'job-1',
      'lead_mining',
      'completed',
      'find manufacturing leads',
    );
    db!.prepare('INSERT INTO business_leads (id, job_id, company_name, status) VALUES (?, ?, ?, ?)').run(
      'lead-1',
      'job-1',
      'Injected Industries',
      'qualified',
    );

    app = express();
    app.use(express.json());
    app.use('/api/v1/business-jobs', createBusinessJobsRoutes(manager));
  });

  afterEach(() => {
    manager?.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads leads through the injected database manager', async () => {
    const response = await request(app).get('/api/v1/business-jobs/leads/all');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ success: true, leads: expect.any(Array) }));
    expect(response.body.leads).toHaveLength(1);
    expect(response.body.leads[0]).toEqual(expect.objectContaining({
      id: 'lead-1',
      company_name: 'Injected Industries',
      job_id: 'job-1',
    }));
  });

  it('forwards lead mining metadata into the queued task context', async () => {
    const queueTaskSpy = vi.spyOn(agentManager, 'queueTask').mockResolvedValue(undefined as never);

    const response = await request(app)
      .post('/api/v1/business-jobs')
      .send({
        type: 'lead_mining',
        query: 'fogorvos Budapest',
        metadata: {
          limit: 7,
          leadType: 'Brand',
        },
      });
    const body = response.body as { success: boolean; jobId: string };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.jobId).toBeTruthy();
    expect(queueTaskSpy).toHaveBeenCalledWith(
      expect.stringContaining('Bányássz lead-eket'),
      'lead_mining',
      expect.objectContaining({
        jobId: body.jobId,
        metadata: {
          limit: 7,
          leadType: 'Brand',
        },
      }),
    );
    queueTaskSpy.mockRestore();
  });
});
