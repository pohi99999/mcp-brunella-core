import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import path from 'node:path';
import process from 'node:process';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// We still test the built artifact to ensure production readiness
const buildPath = path.join(process.cwd(), "build", "index.js");

describe('Core Tools', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
        command: process.execPath,
        args: [buildPath],
        env: { ...process.env, WEB_UI_ENABLED: "0" }
    });
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await transport.close();
  });

  it('should respond to ping', async () => {
    const result = await client.callTool({ name: "ping", arguments: {} });
    // @ts-ignore
    const text = result.content[0].text;
    expect(text).toMatch(/Pong/);
  });

  it('should list agents', async () => {
    const result = await client.callTool({ name: "agent_list", arguments: {} });
    // @ts-ignore
    const text = result.content[0].text;
    expect(() => JSON.parse(text)).not.toThrow();
    const agents = JSON.parse(text);
    expect(Array.isArray(agents) || typeof agents === 'object').toBe(true);
  });

  it('should provide system metrics', async () => {
    const result = await client.callTool({ name: "monitor_get_metrics", arguments: {} });
    // @ts-ignore
    const text = result.content[0].text;
    const metrics = JSON.parse(text);
    expect(metrics.uptime).toBeDefined();
    expect(metrics.memory).toBeDefined();
  });
});