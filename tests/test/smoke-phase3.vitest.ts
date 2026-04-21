/**
 * Phase 3 Smoke Tesztek — Crawl4AI + User Preferences + Zod Bridge
 *
 * Gyors ellenőrzés: modulok importálhatók, API route-ok inicializálhatók,
 * MCP tool handlerek hívhatók, CLI parancsok regisztrálhatók.
 *
 * @track kutatas_phase3_integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- MOCK-OK ---

vi.mock("../src/utils/logger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock("../src/server/SocketService.js", () => ({
  socketService: { emit: vi.fn() },
}));

// --- 1. Crawl4AI Tool Import Smoke ---

describe("Crawl4AI Tool — Import Smoke", () => {
  it("crawl4aiTool modul importálható", async () => {
    const mod = await import("../src/tools/crawl4aiTool.js");
    expect(mod.crawl4aiCrawlHandler).toBeTypeOf("function");
    expect(mod.crawl4aiBatchHandler).toBeTypeOf("function");
  });
});

// --- 2. Memory Tool Import Smoke ---

describe("Memory Tool — Import Smoke", () => {
  it("memoryTool modul importálható", async () => {
    const mod = await import("../src/tools/memoryTool.js");
    expect(mod.memoryStoreHandler).toBeTypeOf("function");
    expect(mod.memoryQueryHandler).toBeTypeOf("function");
    expect(mod.memoryContextHandler).toBeTypeOf("function");
    expect(mod.memoryDeleteHandler).toBeTypeOf("function");
    expect(mod.memoryPurgeHandler).toBeTypeOf("function");
  });
});

// --- 3. Zod Python Bridge Import Smoke ---

describe("Python Bridge (Zod) — Import Smoke", () => {
  it("pythonBridge modul és sémák importálhatók", async () => {
    const mod = await import("../src/utils/pythonBridge.js");
    expect(mod.CrawlResultSchema).toBeDefined();
    expect(mod.ExecuteResultSchema).toBeDefined();
    expect(mod.validatePythonResponse).toBeTypeOf("function");
    expect(mod.parseAndValidate).toBeTypeOf("function");
  });

  it("CrawlResultSchema alapértelmezett validáció", async () => {
    const { CrawlResultSchema } = await import("../src/utils/pythonBridge.js");
    const result = CrawlResultSchema.safeParse({
      status: "success",
      url: "https://example.com",
      markdown: "# Test",
    });
    expect(result.success).toBe(true);
  });

  it("CrawlResultSchema hibás status elutasítása", async () => {
    const { CrawlResultSchema } = await import("../src/utils/pythonBridge.js");
    const result = CrawlResultSchema.safeParse({
      status: "invalid",
      url: "https://example.com",
    });
    expect(result.success).toBe(false);
  });
});

// --- 4. Crawl4AI Route Import Smoke ---

describe("Crawl4AI Route — Import Smoke", () => {
  it("crawl4ai route factory importálható", async () => {
    const mod = await import("../src/server/routes/crawl4ai.js");
    expect(mod.createCrawl4aiRouter).toBeTypeOf("function");
  });

  it("crawl4ai router Express Router-t ad vissza", async () => {
    const { createCrawl4aiRouter } = await import("../src/server/routes/crawl4ai.js");
    const router = createCrawl4aiRouter();
    expect(router).toBeDefined();
    expect(typeof router).toBe("function"); // Express Router is a function
  });
});

// --- 5. Preferences Route Import Smoke ---

describe("Preferences Route — Import Smoke", () => {
  it("preferences route factory importálható", async () => {
    const mod = await import("../src/server/routes/preferences.js");
    expect(mod.createPreferencesRouter).toBeTypeOf("function");
  });

  it("preferences router Express Router-t ad vissza", async () => {
    const { createPreferencesRouter } = await import("../src/server/routes/preferences.js");
    const router = createPreferencesRouter();
    expect(router).toBeDefined();
    expect(typeof router).toBe("function");
  });
});

// --- 6. CLI Command Registration Smoke ---

describe("CLI Command Registration — Smoke", () => {
  it("crawl4aiCommands regisztrálható", async () => {
    const { Command } = await import("commander");
    const { registerCrawl4aiCommands } = await import("../src/cli/crawl4aiCommands.js");
    const program = new Command();
    expect(() => registerCrawl4aiCommands(program)).not.toThrow();
    const crawl4aiCmd = program.commands.find((c) => c.name() === "crawl4ai");
    expect(crawl4aiCmd).toBeDefined();
    expect(crawl4aiCmd!.description()).toContain("Crawl4AI");
  });

  it("memoriaCommands regisztrálható", async () => {
    const { Command } = await import("commander");
    const { registerMemoriaCommands } = await import("../src/cli/memoriaCommands.js");
    const program = new Command();
    expect(() => registerMemoriaCommands(program)).not.toThrow();
    const memoriaCmd = program.commands.find((c) => c.name() === "memoria");
    expect(memoriaCmd).toBeDefined();
    expect(memoriaCmd!.description()).toContain("memória");
  });

  it("crawl4ai alparancsok regisztrálva", async () => {
    const { Command } = await import("commander");
    const { registerCrawl4aiCommands } = await import("../src/cli/crawl4aiCommands.js");
    const program = new Command();
    registerCrawl4aiCommands(program);
    const crawl4aiCmd = program.commands.find((c) => c.name() === "crawl4ai")!;
    const subNames = crawl4aiCmd.commands.map((c) => c.name());
    expect(subNames).toContain("status");
    expect(subNames).toContain("crawl");
    expect(subNames).toContain("batch");
  });

  it("memoria alparancsok regisztrálva", async () => {
    const { Command } = await import("commander");
    const { registerMemoriaCommands } = await import("../src/cli/memoriaCommands.js");
    const program = new Command();
    registerMemoriaCommands(program);
    const memoriaCmd = program.commands.find((c) => c.name() === "memoria")!;
    const subNames = memoriaCmd.commands.map((c) => c.name());
    expect(subNames).toContain("mentés");
    expect(subNames).toContain("lista");
    expect(subNames).toContain("kontextus");
    expect(subNames).toContain("törlés");
    expect(subNames).toContain("takarítás");
  });
});

// --- 7. Zod Validation Functional Smoke ---

describe("Zod Validation — Funkcionális Smoke", () => {
  it("validatePythonResponse sikeres validáció", async () => {
    const { CrawlResultSchema, validatePythonResponse } = await import("../src/utils/pythonBridge.js");
    const data = {
      status: "success",
      url: "https://test.com",
      markdown: "# Hello",
      title: "Test Page",
    };
    const result = validatePythonResponse(CrawlResultSchema, data, "/test");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe("https://test.com");
      expect(result.data.markdown).toBe("# Hello");
    }
  });

  it("parseAndValidate JSON parsing + validáció", async () => {
    const { CrawlResultSchema, parseAndValidate } = await import("../src/utils/pythonBridge.js");
    const jsonStr = JSON.stringify({
      status: "success",
      url: "https://test.com",
      markdown: "content",
    });
    const result = parseAndValidate(CrawlResultSchema, jsonStr, "/test");
    expect(result.success).toBe(true);
  });

  it("parseAndValidate hibás JSON kezelése", async () => {
    const { CrawlResultSchema, parseAndValidate } = await import("../src/utils/pythonBridge.js");
    const result = parseAndValidate(CrawlResultSchema, "not-json", "/test");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
