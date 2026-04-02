import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const decomposerHarness = vi.hoisted(() => ({
  promptMock: vi.fn(),
  connectMock: vi.fn(),
  callToolMock: vi.fn(),
  closeMock: vi.fn(),
  spinnerStop: vi.fn(),
  spinnerFail: vi.fn(),
}));

vi.mock("inquirer", () => ({
  default: {
    prompt: decomposerHarness.promptMock,
  },
}));

vi.mock("ora", () => ({
  default: vi.fn(() => {
    const spinner = {
      start: vi.fn(() => spinner),
      stop: decomposerHarness.spinnerStop,
      fail: decomposerHarness.spinnerFail,
    };

    return spinner;
  }),
}));

vi.mock("../src/utils/mcpClient.js", () => ({
  BrunellaClient: class {
    connect = decomposerHarness.connectMock;
    callTool = decomposerHarness.callToolMock;
    close = decomposerHarness.closeMock;
  },
}));

import { registerTaskDecomposerCommands } from "../src/cli/taskDecomposerCommands.js";

describe("Task Decomposer CLI Commands", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    decomposerHarness.promptMock.mockReset();
    decomposerHarness.connectMock.mockReset();
    decomposerHarness.callToolMock.mockReset();
    decomposerHarness.closeMock.mockReset();
    decomposerHarness.spinnerStop.mockReset();
    decomposerHarness.spinnerFail.mockReset();
    decomposerHarness.connectMock.mockResolvedValue(undefined);
    decomposerHarness.closeMock.mockResolvedValue(undefined);
  });

  it("should register the decompose command", () => {
    const program = new Command();
    registerTaskDecomposerCommands(program);

    const decompose = program.commands.find((command) => command.name() === "decompose");
    expect(decompose).toBeDefined();
  });

  it("should render raw JSON output to stdout", async () => {
    const program = new Command();
    registerTaskDecomposerCommands(program);

    decomposerHarness.callToolMock.mockResolvedValue({
      content: [{ text: '{"status":"success"}' }],
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined,
    ) => {
      if (code === 1) {
        throw new Error("process.exit:1");
      }
      return undefined as never;
    }) as (code?: string | number | null | undefined) => never);

    await program.parseAsync(["node", "test", "decompose", "build dashboard", "--json"]);

    expect(decomposerHarness.connectMock).toHaveBeenCalledOnce();
    expect(decomposerHarness.callToolMock).toHaveBeenCalledWith("agent_execute", {
      agentName: "task_decomposer",
      task: "build dashboard",
      context: JSON.stringify({ defaultAgent: "Developer" }),
    });
    expect(decomposerHarness.closeMock).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain('{"status":"success"}');
  });

  it("should render decomposition summary to stdout", async () => {
    const program = new Command();
    registerTaskDecomposerCommands(program);

    decomposerHarness.callToolMock.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            status: "success",
            data: {
              originalTask: "Build feature",
              tasks: [
                {
                  id: "t1",
                  agent: "Developer",
                  task: "Implement API",
                  dependencies: [],
                  parallel: false,
                  retries: 1,
                  timeoutMs: 5000,
                },
                {
                  id: "t2",
                  agent: "Tester",
                  task: "Write tests",
                  dependencies: ["t1"],
                  parallel: true,
                  retries: 1,
                  timeoutMs: 5000,
                },
              ],
              dag: {
                nodes: [
                  { id: "t1", label: "Implement API" },
                  { id: "t2", label: "Write tests" },
                ],
                edges: [{ from: "t1", to: "t2" }],
              },
            },
          }),
        },
      ],
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined,
    ) => {
      if (code === 1) {
        throw new Error("process.exit:1");
      }
      return undefined as never;
    }) as (code?: string | number | null | undefined) => never);

    await program.parseAsync(["node", "test", "decompose", "Build feature", "--agent", "Architect"]);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("Mikro-taskok (2)");
    expect(output).toContain("t1");
    expect(output).toContain("Implement API");
    expect(output).toContain("t2");
    expect(output).toContain("Write tests");
    expect(output).toContain("[t1]");
  });

  it("should prompt for task when not provided", async () => {
    const program = new Command();
    registerTaskDecomposerCommands(program);

    decomposerHarness.promptMock.mockResolvedValue({ task: "Prompted task" });
    decomposerHarness.callToolMock.mockResolvedValue({
      content: [{ text: '{"status":"success","data":{"originalTask":"Prompted task","tasks":[],"dag":{"nodes":[],"edges":[]}}}' }],
    });
    vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined,
    ) => {
      if (code === 1) {
        throw new Error("process.exit:1");
      }
      return undefined as never;
    }) as (code?: string | number | null | undefined) => never);

    await program.parseAsync(["node", "test", "decompose"]);

    expect(decomposerHarness.promptMock).toHaveBeenCalledOnce();
    expect(decomposerHarness.callToolMock).toHaveBeenCalledWith(
      "agent_execute",
      expect.objectContaining({ task: "Prompted task" }),
    );
  });

  it("should render missing task to stderr and exit", async () => {
    const program = new Command();
    registerTaskDecomposerCommands(program);

    decomposerHarness.promptMock.mockResolvedValue({ task: "" });
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined,
    ) => {
      if (code === 1) {
        throw new Error("process.exit:1");
      }
      return undefined as never;
    }) as (code?: string | number | null | undefined) => never);

    await expect(
      program.parseAsync(["node", "test", "decompose"]),
    ).rejects.toThrow("process.exit:1");

    const output = consoleErrSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("Hiányzó feladat.");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("should render invalid decomposition to stdout and stderr appropriately", async () => {
    const program = new Command();
    registerTaskDecomposerCommands(program);

    decomposerHarness.callToolMock.mockResolvedValue({
      content: [{ text: '{"status":"success","data":{"unexpected":true}}' }],
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null | undefined,
    ) => {
      if (code === 1) {
        throw new Error("process.exit:1");
      }
      return undefined as never;
    }) as (code?: string | number | null | undefined) => never);

    await expect(
      program.parseAsync(["node", "test", "decompose", "broken task"]),
    ).rejects.toThrow("process.exit:1");

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("Érvénytelen dekompozíció válasz");
    expect(decomposerHarness.closeMock).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
