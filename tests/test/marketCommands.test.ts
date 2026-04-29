import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

const marketHarness = vi.hoisted(() => ({
  spinnerSucceed: vi.fn(),
  spinnerStop: vi.fn(),
  spinnerFail: vi.fn(),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => {
    const spinner = {
      start: vi.fn(() => spinner),
      succeed: marketHarness.spinnerSucceed,
      stop: marketHarness.spinnerStop,
      fail: marketHarness.spinnerFail,
    };

    return spinner;
  }),
}));

import { registerMarketCommands } from "@apps/mcp-core/commands/marketCommands.js";

describe("Market CLI Commands", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    marketHarness.spinnerSucceed.mockReset();
    marketHarness.spinnerStop.mockReset();
    marketHarness.spinnerFail.mockReset();
  });

  it("should register the market command group with expected subcommands", () => {
    const program = new Command();
    registerMarketCommands(program);

    const market = program.commands.find((command) => command.name() === "market");
    expect(market).toBeDefined();
    expect(market?.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["run", "status", "alerts"]),
    );
  });

  it("should render market run summary to stdout", async () => {
    const program = new Command();
    registerMarketCommands(program);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "success",
          data: {
            summary: {
              productsTracked: 8,
              competitorsScraped: 3,
              priceDropsDetected: 1,
            },
          },
        }),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync([
      "node",
      "test",
      "market",
      "run",
      "industrial valves",
      "--competitors",
      "acme,globex",
      "--url",
      "https://example.com",
    ]);

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/api/agents/MarketIntel/execute",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"task":"industrial valves"');
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"productCategory":"industrial valves"');
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"competitors":["acme","globex"]');
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toContain('"url":"https://example.com"');
    expect(marketHarness.spinnerSucceed).toHaveBeenCalledWith(expect.stringContaining("Piaci elemzés lefutott"));

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("PIACI ELEMZÉS ÖSSZEFOGLALÓ");
    expect(output).toContain("Követett termékek:");
    expect(output).toContain("Scraper versenytárs:");
    expect(output).toContain("Ár esések:");
  });

  it("should render market status to stdout for active agent", async () => {
    const program = new Command();
    registerMarketCommands(program);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          agents: [
            {
              name: "MarketIntel",
              status: "working",
              currentTask: "tracking price drops",
              lastActive: "2026-04-01T21:00:00.000Z",
            },
          ],
        }),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(["node", "test", "market", "status"]);

    expect(marketHarness.spinnerStop).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("MARKET WATCHER STÁTUSZ");
    expect(output).toContain("MarketIntelAgent");
    expect(output).toContain("Állapot:");
    expect(output).toContain("Feladat:");
    expect(output).toContain("Utoljára:");
  });

  it("should render alerts to stdout", async () => {
    const program = new Command();
    registerMarketCommands(program);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            alerts: [
              {
                productName: "Valve 3000",
                competitor: "Globex",
                oldPrice: 10000,
                newPrice: 8500,
                priceChangePercent: -15,
                severity: "critical",
                timestamp: "2026-04-01T21:00:00.000Z",
              },
            ],
          },
        }),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(["node", "test", "market", "alerts", "--category", "valves"]);

    expect(marketHarness.spinnerStop).toHaveBeenCalledOnce();
    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("ÁR RIASZTÁSOK (1)");
    expect(output).toContain("Valve 3000");
    expect(output).toContain("Versenytárs: Globex");
    expect(output).toContain("Ár változás:");
  });

  it("should render no-alert state to stdout", async () => {
    const program = new Command();
    registerMarketCommands(program);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            alerts: [],
          },
        }),
    } as Response);
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    await program.parseAsync(["node", "test", "market", "alerts"]);

    const output = consoleSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("Nincs aktív ár riasztás.");
  });

  it("should render fetch failures to stderr and exit", async () => {
    const program = new Command();
    registerMarketCommands(program);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Connection refused"));
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as (code?: string | number | null | undefined) => never);

    await expect(
      program.parseAsync(["node", "test", "market", "status"]),
    ).rejects.toThrow("process.exit");

    expect(marketHarness.spinnerFail).toHaveBeenCalledWith(expect.stringContaining("Kapcsolódási hiba"));
    const output = consoleErrSpy.mock.calls.map((args) => args.map(String).join(' ')).join('');
    expect(output).toContain("Connection refused");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
