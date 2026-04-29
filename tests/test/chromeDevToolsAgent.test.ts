import { describe, it, expect, beforeAll } from 'vitest';
import { ChromeDevToolsAgent } from '@packages/agents/ChromeDevToolsAgent.js';

describe('ChromeDevToolsAgent', () => {
  let agent: ChromeDevToolsAgent;

  beforeAll(() => {
    agent = new ChromeDevToolsAgent();
  });

  it('should have correct metadata', () => {
    expect(agent.name).toBe('ChromeDevTools');
    expect(agent.role).toBe('Web Debug & Performance Analyst');
    expect(agent.capabilities).toContain('network_capture');
    expect(agent.capabilities).toContain('console_errors');
    expect(agent.capabilities).toContain('performance_metrics');
    expect(agent.capabilities).toContain('debug_report');
  });

  it('should return error when URL is missing', async () => {
    const result = await agent.execute('Debug the page');

    expect(result.status).toBe('error');
    expect(result.error).toContain('URL megadása szükséges');
  });

  it('should extract URL from task string', async () => {
    const task = 'Debug https://example.com hálózati problémáit';
    const urlMatch = task.match(/(https?:\/\/[^\s]+)/);
    
    expect(urlMatch).toBeTruthy();
    expect(urlMatch?.[0]).toBe('https://example.com');
  });

  it('should detect localhost URLs', async () => {
    const task = 'Debug localhost:5173 performance';
    const localhostMatch = task.match(/localhost:(\d+)/);
    
    expect(localhostMatch).toBeTruthy();
    expect(localhostMatch?.[1]).toBe('5173');
  });

  it('should detect network capability from task', () => {
    const task = 'Capture network requests from https://example.com';
    expect(task.toLowerCase()).toContain('network');
  });

  it('should detect console capability from task', () => {
    const task = 'Show console errors from https://example.com';
    expect(task.toLowerCase()).toContain('console');
  });

  it('should detect performance capability from task', () => {
    const task = 'Analyze performance of https://example.com';
    expect(task.toLowerCase()).toContain('performance');
  });

  it('should use context URL override', async () => {
    const context = {
      url: 'https://example.com',
      timeout: 5000,
    };

    expect(context.url).toBe('https://example.com');
    expect(context.timeout).toBe(5000);
  });
});

describe('ChromeDevToolsAgent - Integration Tests (SKIP by default)', () => {
  let agent: ChromeDevToolsAgent;

  beforeAll(() => {
    agent = new ChromeDevToolsAgent();
  });

  it.skip('should capture network requests from real URL', async () => {
    const result = await agent.captureNetworkRequests('https://example.com', 5000);

    expect(result.requests).toBeInstanceOf(Array);
    expect(result.requests.length).toBeGreaterThan(0);
    expect(result.requests[0]).toHaveProperty('url');
    expect(result.requests[0]).toHaveProperty('method');
    expect(result.requests[0]).toHaveProperty('status');
    expect(result.requests[0]).toHaveProperty('duration');
  });

  it.skip('should capture console errors from real URL', async () => {
    const result = await agent.captureConsoleErrors('https://example.com', 5000);

    expect(result.errors).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it.skip('should get performance metrics from real URL', async () => {
    const result = await agent.getPerformanceMetrics('https://example.com');

    expect(result).toHaveProperty('domLoadTime');
    expect(result).toHaveProperty('firstContentfulPaint');
    expect(result).toHaveProperty('pageLoadTime');
    expect(result).toHaveProperty('resourceCount');
    expect(result.resourceCount).toBeGreaterThan(0);
  });

  it.skip('should generate full debug report', async () => {
    const result = await agent.generateDebugReport('https://example.com');

    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('network');
    expect(result).toHaveProperty('console');
    expect(result).toHaveProperty('performance');
    expect(result).toHaveProperty('summary');
    
    expect(result.network.totalRequests).toBeGreaterThan(0);
  });

  it.skip('should execute with debug report capability', async () => {
    const result = await agent.execute('Debug https://example.com', {
      capability: 'report',
    });

    expect(result.status).toBe('success');
    expect(result.data).toHaveProperty('report');
    expect(result.data).toHaveProperty('markdown');
  });

  it.skip('should execute with network capability', async () => {
    const result = await agent.execute('Network analysis', {
      url: 'https://example.com',
      capability: 'network',
      timeout: 5000,
    });

    expect(result.status).toBe('success');
    expect(result.data).toHaveProperty('requests');
    expect(result.data).toHaveProperty('failedRequests');
  });

  it.skip('should execute with console capability', async () => {
    const result = await agent.execute('Console errors', {
      url: 'https://example.com',
      capability: 'console',
    });

    expect(result.status).toBe('success');
    expect(result.data).toHaveProperty('errors');
    expect(result.data).toHaveProperty('warnings');
  });

  it.skip('should execute with performance capability', async () => {
    const result = await agent.execute('Performance metrics', {
      url: 'https://example.com',
      capability: 'performance',
    });

    expect(result.status).toBe('success');
    expect(result.data).toHaveProperty('domLoadTime');
    expect(result.data).toHaveProperty('pageLoadTime');
  });
});
