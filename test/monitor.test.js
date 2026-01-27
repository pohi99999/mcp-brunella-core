"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const monitor_js_1 = require("../src/tools/monitor.js");
// Mock MCP Server to capture tool registration
// Mock MCP Server to capture tool registration
class MockServer {
    tools = new Map();
    // Intentionally loose signature to satisfy any caller
    tool(...args) {
        // Name is usually first, handler is usually last
        const name = args[0];
        const handler = args[args.length - 1];
        this.tools.set(name, handler);
        return {};
    }
}
(0, node_test_1.describe)('Monitor Tools', () => {
    const server = new MockServer();
    (0, monitor_js_1.registerMonitorTools)(server);
    (0, node_test_1.it)('should read tail logs', async () => {
        const logDir = path_1.default.join(process.cwd(), 'logs');
        if (!fs_1.default.existsSync(logDir))
            fs_1.default.mkdirSync(logDir);
        const testLog = 'test_monitor.log';
        const logPath = path_1.default.join(logDir, testLog);
        // Write dummy log
        const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join('\n');
        fs_1.default.writeFileSync(logPath, lines);
        const tool = server.tools.get('monitor_tail_logs');
        node_assert_1.default.ok(tool, 'Tool monitor_tail_logs not registered');
        const result = await tool({ log_file: testLog, lines: 3 });
        const content = result.content[0].text;
        node_assert_1.default.match(content, /Line 8/);
        node_assert_1.default.match(content, /Line 9/);
        node_assert_1.default.match(content, /Line 10/);
        node_assert_1.default.doesNotMatch(content, /Line 7/);
        // Cleanup
        fs_1.default.unlinkSync(logPath);
    });
});
