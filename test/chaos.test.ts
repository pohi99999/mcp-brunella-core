/**
 * Targeted tests for the Chaos Engine subsystem.
 *
 * Covers:
 *  - ChaosInjector  (src/utils/chaos_injector.ts)
 *  - createChaosRouter  (src/server/routes/chaos.ts)
 *  - registerChaosCommands  (src/cli/chaosCommands.ts)
 *
 * Track backfill: conductor/tracks/agent_instability_chaos_testing_20260410
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Command } from 'commander';

// ── hoisted mocks (must appear before any import that reaches these modules) ──

vi.mock('../src/utils/logger.js', () => ({
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
  Logger: class Logger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    log = vi.fn().mockResolvedValue(undefined);
  },
}));

// The CLI action calls an interactive inquirer menu – we don't want that in tests.
vi.mock('../src/cli/commands/chaos-hu.js', () => ({
  chaosMenu: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/health.js', () => ({
  checkOllamaHealth: vi.fn().mockResolvedValue({ status: 'ok', model: 'llama3' }),
  checkAnythingLLMHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkPythonHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkN8nHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkLangflowHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  checkCloudflareHealth: vi.fn().mockResolvedValue({ status: 'healthy' }),
  checkWabHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
  buildHealthResponse: vi.fn().mockImplementation((ol, al, py, n8n, lf, wab, cf, ac, mc, rid) => ({
    status: 'ok',
    components: { ollama: ol, anythingllm: al, python: py, n8n, langflow: lf, wab, cloudflare: cf },
    stats: { agents: ac, mcp: mc },
    requestId: rid,
  })),
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    listAgents: vi.fn().mockReturnValue(['agent1', 'agent2']),
  },
}));

vi.mock('../src/server/McpProcessManager.js', () => ({
  mcpProcessManager: {
    getServersStatus: vi.fn().mockReturnValue([{ name: 'server1', status: 'connected' }]),
  },
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: vi.fn().mockReturnValue({}),
}));

// ── module imports (resolved after mocks are hoisted) ──
import { ChaosInjector } from '../src/utils/chaos_injector.js';
import { createChaosRouter } from '../src/server/routes/chaos.js';
import { registerChaosCommands } from '../src/cli/chaosCommands.js';
import { createV1Router } from '../src/server/routes/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// ChaosInjector
// ─────────────────────────────────────────────────────────────────────────────
describe('ChaosInjector', () => {
  // ── shouldInject() ──────────────────────────────────────────────────────────
  describe('shouldInject()', () => {
    it('should_return_false_when_enabled_is_false', () => {
      const injector = new ChaosInjector({ enabled: false, probability: 1.0 });
      expect(injector.shouldInject()).toBe(false);
    });

    it('should_return_false_when_enabled_but_probability_is_zero', () => {
      const injector = new ChaosInjector({ enabled: true, probability: 0 });
      expect(injector.shouldInject()).toBe(false);
    });

    it('should_return_true_when_enabled_and_probability_is_one', () => {
      const injector = new ChaosInjector({ enabled: true, probability: 1.0 });
      expect(injector.shouldInject()).toBe(true);
    });

    it('should_read_enabled_and_probability_from_env_when_no_explicit_config', () => {
      vi.stubEnv('CHAOS_MODE', 'true');
      vi.stubEnv('CHAOS_PROBABILITY', '1');
      // No explicit config – constructor reads env vars
      const injector = new ChaosInjector();
      expect(injector.shouldInject()).toBe(true);
    });
  });

  // ── injectChaos() ───────────────────────────────────────────────────────────
  describe('injectChaos()', () => {
    it('should_call_handler_directly_when_chaos_disabled_and_return_its_result', async () => {
      const injector = new ChaosInjector({ enabled: false });
      const handler = vi.fn().mockResolvedValue('clean-result');

      const result = await injector.injectChaos('test-tool', handler);

      expect(result).toBe('clean-result');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should_not_call_handler_and_throw_429_error_when_rate_limit_type_selected', async () => {
      const injector = new ChaosInjector({
        enabled: true,
        probability: 1.0,
        types: ['rate_limit'],
        maxDelayMs: 0,
      });
      const handler = vi.fn().mockResolvedValue('unreachable');

      await expect(injector.injectChaos('my-tool', handler)).rejects.toThrow(
        /429.*Too Many Requests.*Chaos Mode/,
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it('should_reverse_string_result_when_corruption_type_selected', async () => {
      const injector = new ChaosInjector({
        enabled: true,
        probability: 1.0,
        types: ['corruption'],
        maxDelayMs: 0,
      });
      // corruptData on a string always reverses it – deterministic.
      const handler = vi.fn().mockResolvedValue('hello');

      const result = await injector.injectChaos('my-tool', handler);

      expect(result).toBe('olleh');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should_call_handler_and_return_result_when_timeout_type_selected_with_zero_delay', async () => {
      // maxDelayMs=0 → Math.floor(random * 0) == 0 → setTimeout(resolve, 0) – no real wait.
      const injector = new ChaosInjector({
        enabled: true,
        probability: 1.0,
        types: ['timeout'],
        maxDelayMs: 0,
      });
      const handler = vi.fn().mockResolvedValue('delayed-result');

      const result = await injector.injectChaos('my-tool', handler);

      expect(result).toBe('delayed-result');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should_corrupt_object_by_mutating_a_key_when_corruption_type_selected', async () => {
      // Stub Math.random to consistently hit the overwrite branch (> 0.5 → delete, ≤ 0.5 → overwrite).
      // We stub to 0.3 so it takes the overwrite path.
      const randomStub = vi.spyOn(Math, 'random').mockReturnValue(0.3);
      const injector = new ChaosInjector({
        enabled: true,
        probability: 1.0,
        types: ['corruption'],
        maxDelayMs: 0,
      });
      const handler = vi.fn().mockResolvedValue({ name: 'Alice', score: 100 });

      const result = await injector.injectChaos<Record<string, unknown>>('my-tool', handler);

      // At least one key should be corrupted to the sentinel value
      const values = Object.values(result);
      expect(values).toContain('CORRUPTED_BY_BRUNELLA_CHAOS');

      randomStub.mockRestore();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createChaosRouter()
// ─────────────────────────────────────────────────────────────────────────────
describe('createChaosRouter()', () => {
  let app: express.Express;

  // Chaos env vars that the routes read / write directly.
  const CHAOS_VARS = ['CHAOS_MODE', 'CHAOS_PROBABILITY', 'CHAOS_TYPES', 'CHAOS_MAX_DELAY'] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env so each test starts from a known baseline.
    CHAOS_VARS.forEach((v) => delete process.env[v]);

    app = express();
    app.use(express.json());
    app.use('/api/chaos', createChaosRouter());
  });

  afterEach(() => {
    // Undo both vi.stubEnv() calls and any direct process.env writes made by POST /toggle.
    vi.unstubAllEnvs();
    CHAOS_VARS.forEach((v) => delete process.env[v]);
  });

  // ── GET /status ─────────────────────────────────────────────────────────────
  describe('GET /api/chaos/status', () => {
    it('should_return_200_with_default_config_when_no_chaos_env_vars_are_set', async () => {
      const res = await request(app).get('/api/chaos/status');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        enabled: false,
        probability: 0.1,
        types: expect.arrayContaining(['timeout', 'rate_limit', 'corruption']),
        maxDelayMs: 5000,
      });
    });

    it('should_return_enabled_true_and_env_backed_values_when_chaos_env_vars_are_set', async () => {
      vi.stubEnv('CHAOS_MODE', 'true');
      vi.stubEnv('CHAOS_PROBABILITY', '0.5');
      vi.stubEnv('CHAOS_TYPES', 'timeout,rate_limit');
      vi.stubEnv('CHAOS_MAX_DELAY', '2000');

      const res = await request(app).get('/api/chaos/status');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        enabled: true,
        probability: 0.5,
        types: ['timeout', 'rate_limit'],
        maxDelayMs: 2000,
      });
    });
  });

  // ── POST /toggle ─────────────────────────────────────────────────────────────
  describe('POST /api/chaos/toggle', () => {
    it('should_return_success_true_and_enabled_true_when_enabled_true_posted', async () => {
      const res = await request(app)
        .post('/api/chaos/toggle')
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status.enabled).toBe(true);
    });

    it('should_return_enabled_false_when_enabled_false_posted', async () => {
      vi.stubEnv('CHAOS_MODE', 'true');

      const res = await request(app)
        .post('/api/chaos/toggle')
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status.enabled).toBe(false);
    });

    it('should_reflect_new_probability_in_response_when_probability_posted', async () => {
      const res = await request(app)
        .post('/api/chaos/toggle')
        .send({ probability: 0.75 });

      expect(res.status).toBe(200);
      expect(res.body.status.probability).toBe(0.75);
    });

    it('should_reflect_new_types_in_response_when_types_array_posted', async () => {
      const res = await request(app)
        .post('/api/chaos/toggle')
        .send({ types: ['rate_limit', 'corruption'] });

      expect(res.status).toBe(200);
      expect(res.body.status.types).toEqual(['rate_limit', 'corruption']);
    });

    it('should_reflect_new_maxDelayMs_in_response_when_maxDelayMs_posted', async () => {
      const res = await request(app)
        .post('/api/chaos/toggle')
        .send({ maxDelayMs: 3000 });

      expect(res.status).toBe(200);
      expect(res.body.status.maxDelayMs).toBe(3000);
    });

    it('should_return_200_success_without_changing_anything_when_empty_body_posted', async () => {
      vi.stubEnv('CHAOS_MODE', 'false');

      const res = await request(app)
        .post('/api/chaos/toggle')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // enabled should still be false (unchanged)
      expect(res.body.status.enabled).toBe(false);
    });

    it('should_ignore_types_field_when_it_is_not_an_array', async () => {
      vi.stubEnv('CHAOS_TYPES', 'timeout');

      const res = await request(app)
        .post('/api/chaos/toggle')
        .send({ types: 'not-an-array' });

      expect(res.status).toBe(200);
      // types should remain unchanged (previous value from env)
      expect(res.body.status.types).toEqual(['timeout']);
    });
  });
});

describe('createV1Router()', () => {
  const CHAOS_VARS = ['CHAOS_MODE', 'CHAOS_PROBABILITY', 'CHAOS_TYPES', 'CHAOS_MAX_DELAY'] as const;
  let app: express.Express;

  beforeEach(() => {
    CHAOS_VARS.forEach((v) => delete process.env[v]);
    app = express();
    app.use(express.json());
    app.use('/api/v1', createV1Router());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    CHAOS_VARS.forEach((v) => delete process.env[v]);
  });

  it('should_mount_chaos_status_under_api_v1', async () => {
    const res = await request(app).get('/api/v1/chaos/status');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      enabled: false,
      probability: 0.1,
      types: expect.arrayContaining(['timeout', 'rate_limit', 'corruption']),
      maxDelayMs: 5000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registerChaosCommands()
// ─────────────────────────────────────────────────────────────────────────────
describe('registerChaosCommands()', () => {
  it('should_register_a_command_named_chaos_on_the_program', () => {
    const program = new Command();
    registerChaosCommands(program);

    const chaosCmd = program.commands.find((c) => c.name() === 'chaos');
    expect(chaosCmd).toBeDefined();
  });

  it('should_describe_chaos_command_with_Chaos_Engine_text', () => {
    const program = new Command();
    registerChaosCommands(program);

    const chaosCmd = program.commands.find((c) => c.name() === 'chaos');
    expect(chaosCmd?.description()).toContain('Chaos Engine');
  });

  it('should_not_register_duplicate_commands_when_called_once', () => {
    const program = new Command();
    registerChaosCommands(program);

    const chaosCmds = program.commands.filter((c) => c.name() === 'chaos');
    expect(chaosCmds).toHaveLength(1);
  });
});
