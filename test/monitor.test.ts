import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { registerMonitorTools } from '../src/tools/monitor.js';

// Mock MCP Server to capture tool registration
class MockServer {
    tools: Map<string, any> = new Map();
    // Intentionally loose signature to satisfy any caller
    tool(...args: any[]) {
        // Name is usually first, handler is usually last
        const name = args[0];
        const handler = args[args.length - 1];
        this.tools.set(name, handler);
        return {} as any;
    }
}

describe('Monitor Tools', () => {
    const server = new MockServer();
    registerMonitorTools(server as any);

    it('should read tail logs', async () => {
        const logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

        const testLog = 'test_monitor.log';
        const logPath = path.join(logDir, testLog);

        // Write dummy log
        const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
        fs.writeFileSync(logPath, lines);

        const tool = server.tools.get('monitor_tail_logs');
        expect(tool).toBeDefined();

        const result = await tool({ log_file: testLog, lines: 3 });
        // @ts-expect-error The result from the mock tool might not have the expected structure in tests.
        const content = result.content[0].text;

        expect(content).toMatch(/Line 8/);
        expect(content).toMatch(/Line 9/);
        expect(content).toMatch(/Line 10/);
        expect(content).not.toMatch(/Line 7/);

        // Cleanup
        try {
            fs.unlinkSync(logPath);
        } catch (e) {
            // ignore cleanup errors
        }
    });
});