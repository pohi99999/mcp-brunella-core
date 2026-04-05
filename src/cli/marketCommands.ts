/**
 * Market Watcher CLI Commands (Master Track 3 - Phase 4)
 *
 * Parancsok:
 *  - brunella market run <kategória>  — Piaci figyelés indítása
 *  - brunella market status           — Aktív figyelések listája
 *  - brunella market alerts           — Ár riasztások megjelenítése
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { writeLine } from '../utils/cliOutput.js';

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

export function registerMarketCommands(program: Command): void {
  const market = program
    .command("market")
    .description("Piaci hírszerzés parancsok (MarketIntelAgent)");

  market
    .command("run")
    .description("Piaci figyelés indítása — versenytárs ár scraping + trend elemzés")
    .argument("[category]", 'Termék kategória (pl. "industrial valves")', "general products")
    .option("--competitors <list>", "Versenytársak vesszővel elválasztva")
    .option("--url <url>", "Konkrét URL figyelése")
    .action(async (category: string, opts: { competitors?: string; url?: string }) => {
      const spinner = ora(`Piaci figyelés indítása: "${category}"...`).start();

      try {
        const metadata: Record<string, unknown> = { productCategory: category };
        if (opts.competitors) {
          metadata.competitors = opts.competitors.split(",").map((c) => c.trim());
        }
        if (opts.url) {
          metadata.url = opts.url;
        }

        const res = await fetch(`${API_BASE}/api/agents/MarketIntel/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: category,
            context: metadata,
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          spinner.fail(chalk.red(`API hiba (${res.status}): ${err}`));
          process.exit(1);
        }

        const data = await res.json() as { status: string; data?: { summary?: { productsTracked: number; competitorsScraped: number; priceDropsDetected: number } }; message?: string };
        spinner.succeed(chalk.green("Piaci elemzés lefutott!"));

        if (data.data?.summary) {
          const s = data.data.summary;
          writeLine(chalk.blue("\n╔═══════════════════════════════════════╗"));
          writeLine(chalk.blue("║") + chalk.bold("     PIACI ELEMZÉS ÖSSZEFOGLALÓ      ") + chalk.blue("║"));
          writeLine(chalk.blue("╚═══════════════════════════════════════╝\n"));
          writeLine(`  Követett termékek:  ${chalk.cyan(s.productsTracked)}`);
          writeLine(`  Scraper versenytárs: ${chalk.cyan(s.competitorsScraped)}`);
          writeLine(`  Ár esések:          ${s.priceDropsDetected > 0 ? chalk.red(s.priceDropsDetected) : chalk.green("0")}`);
          writeLine();
        } else if (data.message) {
          writeLine(chalk.dim(`  ${data.message}`));
        }

      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  market
    .command("status")
    .description("Futó és legutóbbi piaci figyelési sessziók")
    .action(async () => {
      const spinner = ora("Piaci hírszerzés állapot lekérése...").start();

      try {
        const res = await fetch(`${API_BASE}/api/agents`);

        if (!res.ok) {
          spinner.fail(chalk.red(`API hiba (${res.status})`));
          process.exit(1);
        }

        const data = await res.json() as {
          agents: Array<{ name: string; status: string; currentTask?: string; lastActive?: string }>;
        };
        spinner.stop();

        const marketAgent = data.agents?.find(
          (a) => a.name === "MarketIntel" || a.name === "market_intel",
        );

        writeLine(chalk.blue("\n═══ MARKET WATCHER STÁTUSZ ═══\n"));

        if (marketAgent) {
          const statusColor =
            marketAgent.status === "working" ? chalk.yellow : chalk.green;
          writeLine(`  Ügynök:    ${chalk.cyan("MarketIntelAgent")}`);
          writeLine(`  Állapot:   ${statusColor(marketAgent.status)}`);
          if (marketAgent.currentTask) {
            writeLine(`  Feladat:   ${chalk.dim(marketAgent.currentTask)}`);
          }
          if (marketAgent.lastActive) {
            writeLine(
              `  Utoljára:  ${chalk.dim(new Date(marketAgent.lastActive).toLocaleString("hu-HU"))}`,
            );
          }
        } else {
          writeLine(chalk.yellow("  MarketIntelAgent nem aktív."));
          writeLine(chalk.dim("  Futtatás: brunella market run"));
        }
        writeLine();

      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  market
    .command("alerts")
    .description("Legutóbbi ár riasztások megjelenítése (>10% ár változás)")
    .option("--category <name>", "Szűrés termék kategória szerint")
    .action(async (opts: { category?: string }) => {
      const spinner = ora("Riasztások lekérése...").start();

      try {
        const url = opts.category
          ? `${API_BASE}/api/agents/MarketIntel/execute`
          : `${API_BASE}/api/agents/MarketIntel/execute`;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: opts.category || "general products",
            context: { taskType: "monitor_market" },
          }),
        });

        if (!res.ok) {
          spinner.fail(chalk.red(`API hiba (${res.status})`));
          process.exit(1);
        }

        const data = await res.json() as {
          data?: { alerts?: Array<{ productName: string; competitor: string; oldPrice: number; newPrice: number; priceChangePercent: number; severity: string; timestamp: string }> };
        };
        spinner.stop();

        const alerts = data.data?.alerts || [];

        if (alerts.length === 0) {
          writeLine(chalk.green("\n  Nincs aktív ár riasztás."));
          return;
        }

        writeLine(chalk.red(`\n═══ ÁR RIASZTÁSOK (${alerts.length}) ═══\n`));

        alerts.forEach((alert, idx) => {
          const severityColor =
            alert.severity === "critical"
              ? chalk.red
              : alert.severity === "warning"
                ? chalk.yellow
                : chalk.blue;
          const changeStr =
            alert.priceChangePercent > 0
              ? chalk.red(`+${alert.priceChangePercent.toFixed(1)}%`)
              : chalk.green(`${alert.priceChangePercent.toFixed(1)}%`);

          writeLine(`${chalk.bold(`${idx + 1}.`)} ${severityColor(`[${alert.severity.toUpperCase()}]`)} ${chalk.cyan(alert.productName)}`);
          writeLine(`   Versenytárs: ${alert.competitor}`);
          writeLine(`   Ár változás: ${alert.oldPrice.toLocaleString("hu-HU")} → ${alert.newPrice.toLocaleString("hu-HU")} HUF (${changeStr})`);
          writeLine(chalk.dim(`   ${new Date(alert.timestamp).toLocaleString("hu-HU")}`));
        });
        writeLine();

      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });
}
