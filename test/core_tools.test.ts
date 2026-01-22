import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import process from 'node:process';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const buildPath = path.join(process.cwd(), "build", "index.js");

describe('Core Tools', () => {
  let client: Client;
  let transport: StdioClientTransport;

  before(async () => {
    transport = new StdioClientTransport({
        command: process.execPath,
        args: [buildPath],
        env: { ...process.env, WEB_UI_ENABLED: "0" }
    });
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  });

  after(async () => {
    await transport.close();
  });

  it('should respond to ping', async () => {
    const result = await client.callTool({ name: "ping", arguments: {} });
    const text = result.content[0].text;
    assert.match(text, /Pong/);
  });

  it('should list agents', async () => {
    const result = await client.callTool({ name: "agent_list", arguments: {} });
    const text = result.content[0].text;
    assert.doesNotThrow(() => JSON.parse(text));
    const agents = JSON.parse(text);
    assert(Array.isArray(agents) || typeof agents === 'object');
  });

  it('should provide system metrics', async () => {
    const result = await client.callTool({ name: "monitor_get_metrics", arguments: {} });
    const text = result.content[0].text;
    const metrics = JSON.parse(text);
    assert.ok(metrics.uptime);
    assert.ok(metrics.memory);
  });
});
