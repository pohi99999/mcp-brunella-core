import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

class MockServer {
  tools = new Map<string, (args: any) => Promise<any>>();
  tool(name: string, _desc: string, _schema: unknown, handler: (args: any) => Promise<any>) {
    this.tools.set(name, handler);
    return {} as any;
  }
}

async function loadMonitorTools() {
  const { registerMonitorTools } = await import('../src/tools/monitor.js');
  const server = new MockServer();
  registerMonitorTools(server as any);
  return server;
}

describe('Monitor Tools (Vitest)', () => {
  it('registers monitor_get_metrics and monitor_tail_logs', async () => {
    const server = await loadMonitorTools();
    expect(server.tools.has('monitor_get_metrics')).toBe(true);
    expect(server.tools.has('monitor_tail_logs')).toBe(true);
  });

  it('monitor_get_metrics returns structured metrics', async () => {
    const server = await loadMonitorTools();
    const handler = server.tools.get('monitor_get_metrics')!;
    const result = await handler({});
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    const metrics = JSON.parse(result.content[0].text);
    expect(metrics).toHaveProperty('uptime');
    expect(metrics).toHaveProperty('memory');
    expect(metrics).toHaveProperty('cpu');
  });

  it('monitor_tail_logs reads last N lines', async () => {
    const server = await loadMonitorTools();
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const testLog = 'test_monitor_vitest.log';
    const logPath = path.join(logDir, testLog);
    const lines = Array.from({ length: 10 }, (_, i) => `Vitest Line ${i + 1}`).join('\n');
    fs.writeFileSync(logPath, lines);

    const handler = server.tools.get('monitor_tail_logs')!;
    const result = await handler({ log_file: testLog, lines: 3 });
    const text = result.content[0].text;
    expect(text).toMatch(/Vitest Line 8/);
    expect(text).toMatch(/Vitest Line 10/);
    expect(text).not.toMatch(/Vitest Line 7/);

    fs.unlinkSync(logPath);
  });

  it('monitor_tail_logs rejects path traversal', async () => {
    const server = await loadMonitorTools();
    const handler = server.tools.get('monitor_tail_logs')!;
    const result = await handler({ log_file: '../../../etc/passwd', lines: 10 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Access denied/i);
  });
});
