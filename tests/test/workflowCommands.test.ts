import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const workflowHarness = vi.hoisted(() => ({
  promptMock: vi.fn(),
  addDispatch: vi.fn(),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: workflowHarness.promptMock,
  },
}));

vi.mock('../src/core/copilotBridgeState.js', () => ({
  copilotBridgeState: {
    addDispatch: workflowHarness.addDispatch,
  },
}));

import { registerWorkflowCommands } from '../src/cli/workflowCommands.js';

describe('Workflow CLI Commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    workflowHarness.promptMock.mockReset();
    workflowHarness.addDispatch.mockReset();
  });

  it('should register the workflow command group with expected subcommands', () => {
    const program = new Command();
    registerWorkflowCommands(program);

    const workflow = program.commands.find((command) => command.name() === 'workflow');
    expect(workflow).toBeDefined();
    expect(workflow?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(['preview', 'run', 'status']),
    );
  });

  it('should render workflow preview to stdout', async () => {
    const program = new Command();
    registerWorkflowCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          workflow: {
            id: 'wf-1',
            name: 'Lead flow',
            nodes: [
              { id: 'n1', label: 'Collect leads', agentName: 'Developer', dependsOn: [] },
              { id: 'n2', label: 'Validate leads', agentName: 'Evaluator', dependsOn: ['n1'] },
            ],
          },
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'workflow', 'preview', 'Lead task']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Workflow Preview: Lead flow');
    expect(output).toContain('n1 Collect leads');
    expect(output).toContain('Agent: Developer');
    expect(output).toContain('DependsOn: n1');
  });

  it('should render workflow run results and bridge dispatch to stdout', async () => {
    const program = new Command();
    registerWorkflowCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          result: {
            status: 'completed',
            durationMs: 245,
            completedNodeIds: ['n1', 'n2'],
            warnings: ['slow-step'],
          },
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'workflow', 'run', 'Lead task', '--copilot-orchestrate']);

    expect(workflowHarness.addDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: 'Developer',
        task: 'Lead task',
        status: 'queued',
      }),
    );
    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Workflow orchestration enabled. Dispatch naplózva.');
    expect(output).toContain('Workflow futás kész');
    expect(output).toContain('Status:      completed');
    expect(output).toContain('Node-ok:     n1, n2');
    expect(output).toContain('Warnings:    slow-step');
  });

  it('should render empty workflow status state to stdout', async () => {
    const program = new Command();
    registerWorkflowCommands(program);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ workflows: [] }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'workflow', 'status']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Workflow státuszok');
    expect(output).toContain('Még nincs workflow futás.');
  });

  it('should drive interactive menu flows with inquirer prompts', async () => {
    const program = new Command();
    registerWorkflowCommands(program);

    workflowHarness.promptMock
      .mockResolvedValueOnce({ action: 'preview' })
      .mockResolvedValueOnce({ task: 'Interactive task', agent: 'Researcher' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          workflow: {
            id: 'wf-2',
            name: 'Interactive flow',
            nodes: [{ id: 'n1', label: 'Inspect', agentName: 'Researcher', dependsOn: [] }],
          },
        }),
    } as Response);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    await program.parseAsync(['node', 'test', 'workflow']);

    const output = stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Workflow Preview: Interactive flow');
    expect(workflowHarness.promptMock).toHaveBeenCalledTimes(2);
  });
});
