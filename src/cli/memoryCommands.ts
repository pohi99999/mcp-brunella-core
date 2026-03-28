 

import type { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { promises as fs } from "fs";
import path from "path";

const API_BASE = process.env.BRUNELLA_API_URL || process.env.API_BASE_URL || "http://localhost:3000";

interface MemoryStatsResponse {
  summary: {
    totalEntries: number;
    avgConfidence: number;
    totalReuses: number;
  };
  agents: Array<{
    agentName: string;
    totalEntries: number;
    avgConfidence: number;
    totalReuses: number;
    cache: { hits: number; misses: number; hitRate: number };
  }>;
}

async function fetchJson<T>(pathName: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${pathName}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data as T;
}

async function showStats(): Promise<void> {
  const stats = await fetchJson<MemoryStatsResponse>("/api/v1/memory/structured/stats");
  console.log(chalk.bold.cyan("\n🧠 Agent Memória & Tanulás\n"));
  console.log(`  Összes entry:        ${chalk.white(stats.summary.totalEntries)}`);
  console.log(`  Átl. confidence:     ${chalk.white(stats.summary.avgConfidence.toFixed(2))}`);
  console.log(`  Pattern reuse:       ${chalk.white(stats.summary.totalReuses)}`);
  console.log("");

  for (const agent of stats.agents) {
    console.log(chalk.bold(agent.agentName));
    console.log(`  Entries:             ${agent.totalEntries}`);
    console.log(`  Avg confidence:      ${agent.avgConfidence.toFixed(2)}`);
    console.log(`  Cache hits/misses:   ${agent.cache.hits}/${agent.cache.misses}`);
    console.log(`  Hit rate:            ${(agent.cache.hitRate * 100).toFixed(1)}%\n`);
  }
}

async function purgeMemory(minConfidence = 0.5): Promise<void> {
  const result = await fetchJson<{ success: boolean; removed: number }>("/api/v1/memory/structured/purge", {
    method: "POST",
    body: JSON.stringify({ minConfidence }),
  });
  console.log(chalk.green(`\n✅ Törölt structured memory sorok: ${result.removed}\n`));
}

async function exportMemory(format: "jsonl" | "json" = "jsonl"): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/memory/structured/export?format=${format}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const content = await response.text();
  const filePath = path.resolve(process.cwd(), `memory-export-${Date.now()}.${format}`);
  await fs.writeFile(filePath, content, "utf8");
  console.log(chalk.green(`\n✅ Export elkészült: ${filePath}\n`));
}

async function syncGolden(): Promise<void> {
  const result = await fetchJson<{ success: boolean; synced: number; failed: number; skipped: number }>("/api/v1/memory/structured/golden/sync", {
    method: "POST",
  });
  console.log(chalk.green(`\n✅ Golden sync: ${result.synced} synced / ${result.failed} failed / ${result.skipped} skipped\n`));
}

export function registerMemoryCommands(program: Command): void {
  const memory = program.command("memory").description("Structured agent memória parancsok");

  memory
    .command("stats")
    .description("Agent-szintű memória statisztika")
    .action(async () => {
      await showStats();
    });

  memory
    .command("purge")
    .description("Expired és low-confidence memória elemek törlése")
    .option("--min-confidence <value>", "Minimum confidence", "0.5")
    .action(async (options: { minConfidence: string }) => {
      await purgeMemory(Number(options.minConfidence));
    });

  memory
    .command("export")
    .description("Structured memory export JSON/JSONL")
    .option("--format <format>", "json vagy jsonl", "jsonl")
    .action(async (options: { format: "json" | "jsonl" }) => {
      await exportMemory(options.format);
    });

  memory
    .command("sync")
    .description("Lokális golden mirror szinkronizálása D1-be")
    .action(async () => {
      await syncGolden();
    });

  memory.action(async () => {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Memória menü:",
        choices: [
          { name: "📊 Statisztikák", value: "stats" },
          { name: "🧹 Purge expired + low-confidence", value: "purge" },
          { name: "📦 Export JSONL", value: "export" },
          { name: "☁️ Golden sync D1-be", value: "sync" },
          { name: "❌ Kilépés", value: "cancel" },
        ],
      },
    ]);

    if (action === "stats") await showStats();
    if (action === "purge") await purgeMemory();
    if (action === "export") await exportMemory();
    if (action === "sync") await syncGolden();
  });
}
