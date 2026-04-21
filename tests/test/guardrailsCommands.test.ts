import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { registerGuardrailsCommands, registerTelemetryCommands } from '../src/cli/guardrailsCommands.js';

describe('Guardrails CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should register guardrails and telemetry command groups', () => {
    const program = new Command();
    registerGuardrailsCommands(program);
    registerTelemetryCommands(program);

    expect(program.commands.find((command) => command.name() === 'guardrails')).toBeDefined();
    expect(program.commands.find((command) => command.name() === 'telemetry')).toBeDefined();
  });

  it('should render guardrails status to stdout', async () => {
    const program = new Command();
    registerGuardrailsCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          strictMode: true,
          confidenceThreshold: 0.82,
          validationsPassed: 12,
          validationsFailed: 1,
          avgConfidence: 0.91,
          redactionsTriggered: 4,
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'guardrails', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Guardrails Állapot');
    expect(output).toContain('Strict Mode:');
    expect(output).toContain('Confidence Küszöb:');
    expect(output).toContain('Validáció OK:');
    expect(output).toContain('PII Redakciók:');
  });

  it('should render guardrails test results to stdout', async () => {
    const program = new Command();
    registerGuardrailsCommands(program);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'guardrails', 'test', 'Email: test@example.com']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Redakció Eredmény');
    expect(output).toContain('Eredeti:');
    expect(output).toContain('Redaktált:');
    expect(output).toContain('Találatok:');
  });

  it('should render telemetry stats to stdout', async () => {
    const program = new Command();
    registerTelemetryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          activeSpans: 3,
          completedSpans: 14,
          totalInputTokens: 1200,
          totalOutputTokens: 800,
          tokensByModel: {
            'gpt-5-mini': { input: 700, output: 500 },
          },
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'telemetry', 'stats']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Telemetria Összesítő');
    expect(output).toContain('Aktív Spanek:');
    expect(output).toContain('Befejezett Spanek:');
    expect(output).toContain('Token Használat Modell Szerint');
    expect(output).toContain('gpt-5-mini');
  });

  it('should render telemetry traces to stdout', async () => {
    const program = new Command();
    registerTelemetryCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            status: 'success',
            duration: 120,
            agentName: 'Developer',
            operation: 'refactor',
            traceId: 'trace-12345678',
          },
        ]),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'telemetry', 'traces', '-n', '1']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Legutóbbi 1 Trace');
    expect(output).toContain('Developer::refactor');
    expect(output).toContain('trace-12');
  });
});
