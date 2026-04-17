import express from 'express';
import { type AddressInfo } from 'net';
import { type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createOpenClawRoutes } from '../../src/server/routes/openclaw.js';

let server: Server | undefined;
const originalBaseUrl = process.env.OPENCLAW_BASE_URL;

afterEach(async () => {
  if (originalBaseUrl === undefined) {
    delete process.env.OPENCLAW_BASE_URL;
  } else {
    process.env.OPENCLAW_BASE_URL = originalBaseUrl;
  }
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    server = undefined;
  }
});

describe('OpenClaw HTTP routes', () => {
  it('serves an OpenClaw status snapshot from the route registry', async () => {
    delete process.env.OPENCLAW_BASE_URL;

    const app = express();
    app.use(express.json());
    app.use('/api/v1/openclaw', createOpenClawRoutes());

    server = app.listen(0);
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/openclaw/status`);
    const payload = await response.json() as {
      success?: boolean;
      data?: {
        health?: {
          state?: string;
        };
      };
    };

    expect(response.ok).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data?.health?.state).toBe('unconfigured');
  });
});
