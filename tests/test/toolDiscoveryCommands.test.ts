import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerToolDiscoveryCommands } from '@apps/mcp-core/commands/toolDiscoveryCommands.js';
import * as logger from '@packages/utils/logger.js';

describe('Tool Discovery CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.BRUNELLA_SERVER_URL;
  });

  it('should register tool-discovery command group with expected subcommands', () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    const toolDiscovery = program.commands.find((command) => command.name() === 'tool-discovery');
    expect(toolDiscovery).toBeDefined();
    expect(toolDiscovery?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['list', 'metrics', 'chain']),
    );
  });

  it('should render tool list to stdout', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          tools: [
            {
              name: 'alpha-tool',
              description: 'Első tool',
              tags: ['alpha'],
              parameters: [{ name: 'query', type: 'string', required: true }],
            },
          ],
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('MCP Tool Registry');
    expect(output).toContain('alpha-tool');
    expect(output).toContain('Első tool');
    expect(output).toContain('Tags: alpha');
    expect(output).toContain('Params: query:string*');
    expect(output).toContain('Összesen: 1 tool');
  });

  it('should render registry fetch errors to stderr and log the error', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Registry unavailable'));
    const logErrorSpy = vi.spyOn(logger, 'logError').mockImplementation(() => {});
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    expect(logErrorSpy).toHaveBeenCalledWith('ToolsCLI', expect.stringContaining('Registry unavailable'));
    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hiba: Registry unavailable');
    expect(output).toContain('A tool registry jelenleg csak élő szerverválaszból tekinthető hitelesnek.');
  });

  it('should_render_registry_from_raw_array_contract_when_filters_are_provided_and_encode_query_params', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve([
          {
            name: 'beta-tool',
            description: 'Második tool',
            tags: ['beta'],
            deprecated: true,
          },
        ]),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list', '--tag', 'beta', '--deprecated']);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/tools/registry?tag=beta&deprecated=true',
    );
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('beta-tool');
    expect(output).toContain('Második tool');
    expect(output).toContain('[DEPRECATED]');
  });

  it('should_render_http_status_when_registry_returns_non_ok_response_and_skip_json_parsing', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    const jsonSpy = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: jsonSpy,
    } as unknown as Response);
    const logErrorSpy = vi.spyOn(logger, 'logError').mockImplementation(() => {});
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    expect(jsonSpy).not.toHaveBeenCalled();
    expect(logErrorSpy).toHaveBeenCalledWith('ToolsCLI', expect.stringContaining('HTTP 503 Service Unavailable'));
    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hiba: HTTP 503 Service Unavailable');
  });

  it('should_render_metrics_http_failure_when_fetch_returns_non_ok_and_use_id_endpoint', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: () => Promise.resolve({}),
    } as Response);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'metrics', '--id', 'tool-42']);

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/tools/metrics/tool-42');
    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hiba: HTTP 502 Bad Gateway');
  });

  it('should render chain errors to stderr', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          success: false,
          failedAtStep: 2,
          error: 'Parser hiba',
        }),
    } as Response);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'chain', 'parser', 'formatter']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Chain hiba a 2. lépésnél');
    expect(output).toContain('Parser hiba');
  });

  it('should_post_chain_steps_and_input_when_chain_executes_successfully_and_render_result', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          success: true,
          completedSteps: 2,
          totalSteps: 2,
          result: { formatted: true },
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync([
      'node',
      'test',
      'tool-discovery',
      'chain',
      'parser',
      'formatter',
      '--input',
      '{"source":"markdown"}',
    ]);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/tools/chain',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: ['parser', 'formatter'],
          input: { source: 'markdown' },
        }),
      }),
    );
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('✅ Chain sikeresen lefutott (2/2)');
    expect(output).toContain('"formatted": true');
  });

  // -----------------------------------------------------------------------
  // metrics — additional coverage
  // -----------------------------------------------------------------------

  it('should_call_stats_endpoint_and_render_data_when_metrics_used_without_id_option', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ totalInvocations: 42, avgLatencyMs: 120, errorRate: 0.03 }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'metrics']);

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/tools/stats');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Tool Metrics');
    expect(output).toContain('totalInvocations');
    expect(output).toContain('42');
  });

  it('should_render_metrics_data_to_stdout_when_fetch_succeeds_with_id_option', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ toolId: 'search-tool', invocations: 17, lastUsed: '2024-01-15T10:00:00Z' }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'metrics', '--id', 'search-tool']);

    expect(globalThis.fetch).toHaveBeenCalledWith('http://localhost:3000/api/v1/tools/metrics/search-tool');
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Tool Metrics');
    expect(output).toContain('invocations');
    expect(output).toContain('17');
  });

  it('should_render_fetch_rejection_error_to_stderr_when_metrics_network_fails', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'metrics']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hiba: Connection refused');
  });

  // -----------------------------------------------------------------------
  // list — empty tools response
  // -----------------------------------------------------------------------

  it('should_render_nincs_regisztralt_tool_message_when_tools_array_is_empty', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ tools: [] }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Nincs regisztrált tool.');
    expect(output).toContain('Összesen: 0 tool');
  });

  // -----------------------------------------------------------------------
  // BRUNELLA_SERVER_URL env var
  // -----------------------------------------------------------------------

  it('should_use_BRUNELLA_SERVER_URL_env_var_as_base_url_when_it_is_set', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    const originalEnv = process.env.BRUNELLA_SERVER_URL;
    process.env.BRUNELLA_SERVER_URL = 'http://custom-server:8080';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ tools: [] }),
    } as Response);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://custom-server:8080/api/v1/tools/registry',
    );

    if (originalEnv === undefined) {
      delete process.env.BRUNELLA_SERVER_URL;
    } else {
      process.env.BRUNELLA_SERVER_URL = originalEnv;
    }
  });

  it('should_strip_trailing_slash_from_BRUNELLA_SERVER_URL_when_constructing_endpoint', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    const originalEnv = process.env.BRUNELLA_SERVER_URL;
    process.env.BRUNELLA_SERVER_URL = 'http://custom-server:8080/';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ tools: [] }),
    } as Response);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'list']);

    const calledUrl = String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl).not.toContain('//api'); // double slash must not appear
    expect(calledUrl).toContain('/api/v1/tools/registry');

    if (originalEnv === undefined) {
      delete process.env.BRUNELLA_SERVER_URL;
    } else {
      process.env.BRUNELLA_SERVER_URL = originalEnv;
    }
  });

  // -----------------------------------------------------------------------
  // chain — HTTP non-ok and fetch rejection
  // -----------------------------------------------------------------------

  it('should_render_http_error_to_stderr_when_chain_endpoint_returns_non_ok_status', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
    } as Response);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'chain', 'step-a', 'step-b']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hiba: HTTP 500 Internal Server Error');
  });

  it('should_render_fetch_rejection_to_stderr_when_chain_network_request_fails', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unreachable'));
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'chain', 'step-x']);

    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Hiba: Network unreachable');
  });

  it('should_post_steps_without_input_key_when_no_input_option_given', async () => {
    const program = new Command();
    registerToolDiscoveryCommands(program);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ success: true, completedSteps: 1, totalSteps: 1, result: {} }),
    } as Response);
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'tool-discovery', 'chain', 'only-step']);

    // Primary assertion: body must include steps array and empty input object
    expect(fetchSpy).toHaveBeenCalledOnce();
    const callOptions = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callOptions.method).toBe('POST');
    const body = JSON.parse(callOptions.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ steps: ['only-step'], input: {} });
    // Endpoint path must end with /chain
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toMatch(/\/api\/v1\/tools\/chain$/);
  });
});
