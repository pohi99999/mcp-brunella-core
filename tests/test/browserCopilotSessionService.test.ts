import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserCopilotSessionService } from '@packages/core-logic/BrowserCopilotSessionService.js';
import { resolveBrowserCopilotEndpoint } from '@packages/utils/browserEndpoint.js';
import type { AgentResponse } from '@packages/agents/types.js';
import type { ExecutionPlan } from '@packages/utils/llmPlanner.js';

const samplePlan: ExecutionPlan = {
  plan: [
    { action: 'navigate', url: 'https://example.com', description: 'Példa oldal megnyitása' },
    { action: 'click', selector: '.cta', description: 'CTA gomb kattintása' },
  ],
  estimatedDuration: 6000,
  backgroundEligible: false,
};

describe('BrowserCopilotSessionService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CLOUDFLARE_TUNNEL_BROWSER_URL;
    delete process.env.CHROME_ACP_URL;
    delete process.env.BROWSER_ACP_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('the Cloudflare tunnel browser endpoint has priority when configured', () => {
    process.env.CLOUDFLARE_TUNNEL_BROWSER_URL = 'https://browser.example.com/';
    process.env.CHROME_ACP_URL = 'http://localhost:9315';

    expect(resolveBrowserCopilotEndpoint()).toBe('https://browser.example.com');
  });

  it('observe módban csak tervet készít és nem futtat Robotkezet', async () => {
    const executeInstruction = vi.fn(async (): Promise<AgentResponse> => ({
      status: 'success',
      message: 'nem kellene lefutnia',
    }));
    const generatePlan = vi.fn(async () => samplePlan);

    const service = new BrowserCopilotSessionService({
      executeInstruction,
      generatePlan,
      probeChromeAcp: async () => true,
      now: () => 1000,
    });

    await service.configure({ mode: 'observe' });
    const session = await service.sendMessage('Nyisd meg a példát');

    expect(generatePlan).toHaveBeenCalledOnce();
    expect(executeInstruction).not.toHaveBeenCalled();
    expect(session.status).toBe('completed');
    expect(session.plan?.plan).toHaveLength(2);
    expect(session.viewportEngine).toBe('chrome-acp');
    expect(session.browserEndpoint).toBe('http://localhost:9315');
  });

  it('guide módban pending instructiont tárol és confirm után futtat', async () => {
    const executeInstruction = vi.fn(async (): Promise<AgentResponse> => ({
      status: 'success',
      message: 'Robotkéz végrehajtotta',
      data: { taskId: 'rk-123' },
    }));

    const service = new BrowserCopilotSessionService({
      executeInstruction,
      generatePlan: async () => samplePlan,
      probeChromeAcp: async () => false,
      now: () => 2000,
    });

    await service.configure({ mode: 'guide' });
    const waiting = await service.sendMessage('Töltsük ki az űrlapot');

    expect(waiting.status).toBe('waiting-confirmation');
    expect(waiting.pendingInstruction).toBe('Töltsük ki az űrlapot');
    expect(executeInstruction).not.toHaveBeenCalled();
    expect(waiting.browserEndpoint).toBe('http://localhost:9315');

    const executed = await service.confirmPending();

    expect(executeInstruction).toHaveBeenCalledOnce();
    expect(executed.lastTaskId).toBe('rk-123');
    expect(executed.status).toBe('executing');
  });

  it('paused session nem futtat új utasítást', async () => {
    const executeInstruction = vi.fn(async (): Promise<AgentResponse> => ({
      status: 'success',
      message: 'ok',
    }));

    const service = new BrowserCopilotSessionService({
      executeInstruction,
      generatePlan: async () => samplePlan,
      probeChromeAcp: async () => false,
      now: () => 3000,
    });

    await service.pause();
    const session = await service.sendMessage('Most kattints a gombra');

    expect(executeInstruction).not.toHaveBeenCalled();
    expect(session.status).toBe('paused');
    expect(session.messages.at(-1)?.content).toContain('szünetel');
    expect(session.browserEndpoint).toBe('http://localhost:9315');
  });
});
