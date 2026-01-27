"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const node_path_1 = __importDefault(require("node:path"));
const node_process_1 = __importDefault(require("node:process"));
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const buildPath = node_path_1.default.join(node_process_1.default.cwd(), "build", "index.js");
(0, node_test_1.describe)('Core Tools', () => {
    let client;
    let transport;
    (0, node_test_1.before)(async () => {
        transport = new stdio_js_1.StdioClientTransport({
            command: node_process_1.default.execPath,
            args: [buildPath],
            env: { ...node_process_1.default.env, WEB_UI_ENABLED: "0" }
        });
        client = new index_js_1.Client({ name: "test-client", version: "1.0.0" });
        await client.connect(transport);
    });
    (0, node_test_1.after)(async () => {
        await transport.close();
    });
    (0, node_test_1.it)('should respond to ping', async () => {
        const result = await client.callTool({ name: "ping", arguments: {} });
        const text = result.content[0].text;
        node_assert_1.default.match(text, /Pong/);
    });
    (0, node_test_1.it)('should list agents', async () => {
        const result = await client.callTool({ name: "agent_list", arguments: {} });
        const text = result.content[0].text;
        node_assert_1.default.doesNotThrow(() => JSON.parse(text));
        const agents = JSON.parse(text);
        (0, node_assert_1.default)(Array.isArray(agents) || typeof agents === 'object');
    });
    (0, node_test_1.it)('should provide system metrics', async () => {
        const result = await client.callTool({ name: "monitor_get_metrics", arguments: {} });
        const text = result.content[0].text;
        const metrics = JSON.parse(text);
        node_assert_1.default.ok(metrics.uptime);
        node_assert_1.default.ok(metrics.memory);
    });
});
