import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createFileRoutes } from '../src/server/routes/files.js';
import path from 'path';
import fs from 'fs';

describe('Files Route Tests', () => {
  let app: express.Express;
  const tempDir = path.join(process.cwd(), 'temp_test_files_route');

  beforeEach(async () => {
    app = express();
    app.use('/api/files', createFileRoutes());

    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
    await fs.promises.mkdir(tempDir);
    await fs.promises.writeFile(path.join(tempDir, 'test.txt'), 'content');
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should list files in directory', async () => {
    const relPath = path.relative(process.cwd(), tempDir);
    const response = await request(app).get(`/api/files/list?path=${relPath}`);

    expect(response.status).toBe(200);
    expect(response.body.files).toHaveLength(1);
    expect(response.body.files[0].name).toBe('test.txt');
    expect(response.body.files[0].size).toBeGreaterThan(0);
  });

  it('should handle large number of files (batching test)', async () => {
    // Create 100 files to trigger batching (batch size is 50)
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(fs.promises.writeFile(path.join(tempDir, `file_${i}.txt`), 'content'));
    }
    await Promise.all(promises);

    const relPath = path.relative(process.cwd(), tempDir);
    const response = await request(app).get(`/api/files/list?path=${relPath}`);

    expect(response.status).toBe(200);
    expect(response.body.files).toHaveLength(101); // 100 + initial test.txt
  });

  it('should prevent directory traversal', async () => {
    const response = await request(app).get('/api/files/list?path=../');
    expect(response.status).toBe(400);
  });
});
