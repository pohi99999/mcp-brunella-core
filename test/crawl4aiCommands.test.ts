import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const crawl4aiHarness = vi.hoisted(() => ({
  promptMock: vi.fn(),
  spinnerSucceed: vi.fn(),
  spinnerWarn: vi.fn(),
  spinnerFail: vi.fn(),
}));

vi.mock("inquirer", () => ({
  default: {
    prompt: crawl4aiHarness.promptMock,
  },
}));

vi.mock("ora", () => ({
  default: vi.fn(() => {
    const spinner = {
      start: vi.fn(() => spinner),
      succeed: crawl4aiHarness.spinnerSucceed,
      warn: crawl4aiHarness.spinnerWarn,
      fail: crawl4aiHarness.spinnerFail,
    };

    return spinner;
  }),
}));

import { registerCrawl4aiCommands } from "../src/cli/crawl4aiCommands.js";

describe("Crawl4AI CLI Commands", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    crawl4aiHarness.promptMock.mockReset();
    crawl4aiHarness.spinnerSucceed.mockReset();
    crawl4aiHarness.spinnerWarn.mockReset();
    crawl4aiHarness.spinnerFail.mockReset();
  });

  it("should register the crawl4ai command group with expected subcommands", () => {
    const program = new Command();
    registerCrawl4aiCommands(program);

    const crawl4ai = program.commands.find((command) => command.name() === "crawl4ai");
    expect(crawl4ai).toBeDefined();
    expect(crawl4ai?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["status", "crawl", "batch"]),
    );
  });

  it("should render unavailable status details to stdout", async () => {
    const program = new Command();
    registerCrawl4aiCommands(program);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: () =>
        Promise.resolve(JSON.stringify({
          available: false,
          python_api: "http://localhost:8000",
          error: "service offline",
        })),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(["node", "test", "crawl4ai", "status"]);

    expect(crawl4aiHarness.spinnerWarn).toHaveBeenCalledWith(expect.stringContaining("Crawl4AI nem elérhető"));
    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("Python API: http://localhost:8000");
    expect(output).toContain("Hiba: service offline");
    expect(output).toContain("Indítsd el: cd myai && uvicorn server:app --port 8000");
  });

  it("should render crawl result to stdout", async () => {
    const program = new Command();
    registerCrawl4aiCommands(program);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: () =>
        Promise.resolve(JSON.stringify({
          success: true,
          data: {
            title: "Example Page",
            url: "https://example.com",
            markdown: "# Example\nBody",
          },
        })),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(["node", "test", "crawl4ai", "crawl", "https://example.com"]);

    expect(crawl4aiHarness.spinnerSucceed).toHaveBeenCalledWith(expect.stringContaining("Crawl sikeres"));
    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("CRAWL4AI EREDMÉNY");
    expect(output).toContain("Cím: Example Page");
    expect(output).toContain("URL: https://example.com");
    expect(output).toContain("Előnézet");
  });

  it("should prompt for crawl url when not provided", async () => {
    const program = new Command();
    registerCrawl4aiCommands(program);

    crawl4aiHarness.promptMock.mockResolvedValue({ url: "https://prompted.example" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: () =>
        Promise.resolve(JSON.stringify({
          success: true,
          data: {
            url: "https://prompted.example",
            markdown: "hello",
          },
        })),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(["node", "test", "crawl4ai", "crawl"]);

    expect(crawl4aiHarness.promptMock).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("URL: https://prompted.example");
  });

  it("should render batch results to stdout", async () => {
    const program = new Command();
    registerCrawl4aiCommands(program);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      text: () =>
        Promise.resolve(JSON.stringify({
          success: true,
          data: {
            results: [
              { url: "https://a.example", status: "success" },
              { url: "https://b.example", status: "error" },
            ],
          },
        })),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(["node", "test", "crawl4ai", "batch", "--urls", "https://a.example", "https://b.example"]);

    expect(crawl4aiHarness.spinnerSucceed).toHaveBeenCalledWith(expect.stringContaining("Batch crawl kész"));
    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("#1");
    expect(output).toContain("https://a.example");
    expect(output).toContain("https://b.example");
  });

  it("should render fetch failures to stderr and exit", async () => {
    const program = new Command();
    registerCrawl4aiCommands(program);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as (code?: string | number | null | undefined) => never);

    await expect(
      program.parseAsync(["node", "test", "crawl4ai", "status"]),
    ).rejects.toThrow("process.exit");

    expect(crawl4aiHarness.spinnerFail).toHaveBeenCalledWith(expect.stringContaining("Kapcsolódási hiba"));
    const output = consoleErrSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("Connection refused");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
