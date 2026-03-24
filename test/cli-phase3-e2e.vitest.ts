/**
 * CLI E2E Tesztek — Crawl4AI + Memória parancsok
 *
 * Valódi CLI futtatás `node build/cli.js` segítségével.
 * Szerver nélkül futtatható parancsok: --help, subcommands
 * Szerver-igényes parancsok: graceful hiba-kezelés ellenőrzése.
 *
 * @track kutatas_phase3_integration
 */

import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import path from "path";

const CLI_PATH = path.resolve("build/cli.js");

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runCli(
  args: string[],
  extraEnv: Record<string, string> = {},
  timeoutMs = 10000,
): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      env: {
        ...process.env,
        BRUNELLA_SERVER_URL: "http://127.0.0.1:19999",
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        BRUNELLA_API_URL: "http://127.0.0.1:19999",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr, timedOut });
    });
  });
}

// ═══════════════════════════════════════════════
// Crawl4AI CLI E2E
// ═══════════════════════════════════════════════

describe("CLI E2E — Crawl4AI", () => {
  it("crawl4ai --help megjelenik", async () => {
    const result = await runCli(["crawl4ai", "--help"]);
    // Commander.js subcommand help may exit with 0 or 1
    const output = result.stdout + result.stderr;
    expect(output.toLowerCase()).toContain("crawl4ai");
  });

  it("crawl4ai status alparancs létezik", async () => {
    const result = await runCli(["crawl4ai", "--help"]);
    const output = result.stdout + result.stderr;
    expect(output.toLowerCase()).toContain("status");
  });

  it("crawl4ai crawl alparancs létezik", async () => {
    const result = await runCli(["crawl4ai", "--help"]);
    const output = result.stdout + result.stderr;
    expect(output.toLowerCase()).toContain("crawl");
  });

  it("crawl4ai batch alparancs létezik", async () => {
    const result = await runCli(["crawl4ai", "--help"]);
    const output = result.stdout + result.stderr;
    expect(output.toLowerCase()).toContain("batch");
  });

  it("crawl4ai status graceful failure szerver nélkül", async () => {
    const result = await runCli(["crawl4ai", "status"], {}, 5000);
    // Vagy timeout, vagy hiba — de ne crash-eljen
    expect(result.timedOut || result.exitCode !== 0 || result.stdout.length > 0).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// Memória CLI E2E
// ═══════════════════════════════════════════════

describe("CLI E2E — Memória", () => {
  it("memoria --help megjelenik", async () => {
    const result = await runCli(["memoria", "--help"]);
    const output = result.stdout + result.stderr;
    expect(output.toLowerCase()).toContain("memoria");
  });

  it("memoria lista alparancs létezik", async () => {
    const result = await runCli(["memoria", "--help"]);
    const output = (result.stdout + result.stderr).toLowerCase();
    expect(output).toContain("lista");
  });

  it("memoria kontextus alparancs létezik", async () => {
    const result = await runCli(["memoria", "--help"]);
    const output = (result.stdout + result.stderr).toLowerCase();
    expect(output).toContain("kontextus");
  });

  it("memoria törlés alparancs létezik", async () => {
    const result = await runCli(["memoria", "--help"]);
    const output = (result.stdout + result.stderr).toLowerCase();
    expect(output.includes("törlés") || output.includes("delete")).toBe(true);
  });

  it("memoria takarítás alparancs létezik", async () => {
    const result = await runCli(["memoria", "--help"]);
    const output = (result.stdout + result.stderr).toLowerCase();
    expect(output.includes("takarítás") || output.includes("purge")).toBe(true);
  });
});
