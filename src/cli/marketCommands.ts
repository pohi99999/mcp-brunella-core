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
          console.log(chalk.blue("\n╔═══════════════════════════════════════╗"));
          console.log(chalk.blue("║") + chalk.bold("     PIACI ELEMZÉS ÖSSZEFOGLALÓ      ") + chalk.blue("║"));
          console.log(chalk.blue("╚═══════════════════════════════════════╝\n"));
          console.log(`  Követett termékek:  ${chalk.cyan(s.productsTracked)}`);
          console.log(`  Scraper versenytárs: ${chalk.cyan(s.competitorsScraped)}`);
          console.log(`  Ár esések:          ${s.priceDropsDetected > 0 ? chalk.red(s.priceDropsDetected) : chalk.green("0")}`);
          console.log();
        } else if (data.message) {
          console.log(chalk.dim(`  ${data.message}`));
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

        console.log(chalk.blue("\n═══ MARKET WATCHER STÁTUSZ ═══\n"));

        if (marketAgent) {
          const statusColor =
            marketAgent.status === "working" ? chalk.yellow : chalk.green;
          console.log(`  Ügynök:    ${chalk.cyan("MarketIntelAgent")}`);
          console.log(`  Állapot:   ${statusColor(marketAgent.status)}`);
          if (marketAgent.currentTask) {
            console.log(`  Feladat:   ${chalk.dim(marketAgent.currentTask)}`);
          }
          if (marketAgent.lastActive) {
            console.log(
              `  Utoljára:  ${chalk.dim(new Date(marketAgent.lastActive).toLocaleString("hu-HU"))}`,
            );
          }
        } else {
          console.log(chalk.yellow("  MarketIntelAgent nem aktív."));
          console.log(chalk.dim("  Futtatás: brunella market run"));
        }
        console.log();

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
          console.log(chalk.green("\n  Nincs aktív ár riasztás."));
          return;
        }

        console.log(chalk.red(`\n═══ ÁR RIASZTÁSOK (${alerts.length}) ═══\n`));

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

          console.log(`${chalk.bold(`${idx + 1}.`)} ${severityColor(`[${alert.severity.toUpperCase()}]`)} ${chalk.cyan(alert.productName)}`);
          console.log(`   Versenytárs: ${alert.competitor}`);
          console.log(`   Ár változás: ${alert.oldPrice.toLocaleString("hu-HU")} → ${alert.newPrice.toLocaleString("hu-HU")} HUF (${changeStr})`);
          console.log(chalk.dim(`   ${new Date(alert.timestamp).toLocaleString("hu-HU")}`));
        });
        console.log();

      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });
}
