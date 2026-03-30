import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPSalesAuthRoutes } from '../src/server/routes/psales-auth.js';

// Tesztfelhasználók beállítása
process.env.PSALES_JWT_SECRET = 'test-secret-32-chars-minimum-ok!!';
process.env.PSALES_TEST_USERS = JSON.stringify([
  { email: 'admin@psales.dev', password: 'admin123', role: 'admin' },
  { email: 'demo@psales.dev', password: 'demo123', role: 'viewer' }
]);

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/psales/auth', createPSalesAuthRoutes());
});

describe('PSales Auth — /api/psales/auth', () => {
  it('sikeres login visszaad JWT tokent', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'admin@psales.dev', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.role).toBe('admin');
  });

  it('hibás jelszó esetén 401-et ad vissza', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'admin@psales.dev', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('ismeretlen email esetén 401-et ad vissza', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'noone@psales.dev', password: 'admin123' });

    expect(res.status).toBe(401);
  });

  it('érvényes token verify sikeres', async () => {
    const loginRes = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'demo@psales.dev', password: 'demo123' });

    const token = loginRes.body.token as string;

    const verifyRes = await request(app)
      .post('/api/psales/auth/verify')
      .send({ token });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.email).toBe('demo@psales.dev');
  });

  it('érvénytelen token verify 401-et ad', async () => {
    const res = await request(app)
      .post('/api/psales/auth/verify')
      .send({ token: 'totally.invalid.token' });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('hiányzó body mezők 400-at adnak', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});
