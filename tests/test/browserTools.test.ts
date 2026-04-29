import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBrowserTools } from '@packages/utils/browser.js';

type BrowserToolArgs = {
  target_url: string;
  schema_source: string;
  extraction_prompt?: string;
};

type BrowserToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: true;
};

describe('Browser tools phygital safety', () => {
  const registeredTools = new Map<string, (args: BrowserToolArgs) => Promise<BrowserToolResponse>>();
  const fetchMock = vi.fn();

  const server = {
    tool: (
      name: string,
      _description: string,
      _schema: unknown,
      handler: (args: BrowserToolArgs) => Promise<BrowserToolResponse>,
    ) => {
      registeredTools.set(name, handler);
    },
  } as unknown as McpServer;

  beforeEach(() => {
    registeredTools.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock as typeof fetch);
    registerBrowserTools(server);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects localhost harvest URLs before proxying to Python', async () => {
    const handler = registeredTools.get('harvest_extract');
    expect(handler).toBeDefined();

    const result = await handler!({
      target_url: 'http://localhost:8000',
      schema_source: '{"type":"object"}',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Access denied');
  });

  it('forwards public harvest URLs to the Python backend', async () => {
    const handler = registeredTools.get('harvest_extract');
    expect(handler).toBeDefined();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', data: { title: 'Example' } }),
    } as Response);

    const result = await handler!({
      target_url: 'https://example.com',
      schema_source: '{"type":"object"}',
      extraction_prompt: 'Extract title',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/harvest/extract');
    expect(JSON.parse(String(options.body))).toMatchObject({
      target_url: 'https://example.com',
      schema_source: '{"type":"object"}',
      extraction_prompt: 'Extract title',
    });
    expect(result.content[0].text).toContain('"status": "ok"');
  });
});
