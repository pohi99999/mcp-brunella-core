import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMonitorTools } from '../src/tools/monitor.js';

// Mock MCP Server to capture tool registration
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
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

        const testLog = 'test_monitor.log';
        const logPath = path.join(logDir, testLog);

        // Write dummy log
        const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
        fs.writeFileSync(logPath, lines);

        const tool = server.tools.get('monitor_tail_logs');
        assert.ok(tool, 'Tool monitor_tail_logs not registered');

        const result = await tool({ log_file: testLog, lines: 3 });
        const content = result.content[0].text;

        assert.match(content, /Line 8/);
        assert.match(content, /Line 9/);
        assert.match(content, /Line 10/);
        assert.doesNotMatch(content, /Line 7/);

        // Cleanup
        fs.unlinkSync(logPath);
    });
});
