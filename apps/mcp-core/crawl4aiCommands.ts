/**
 * Crawl4AI CLI Commands — Magyar nyelvű web crawling CLI
 *
 * Parancsok:
 *   brunella crawl4ai crawl <url>     — Egyedi URL crawlolása
 *   brunella crawl4ai batch           — Több URL interaktív crawlolása
 *   brunella crawl4ai status          — Crawl4AI szolgáltatás állapota
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { writeLine } from '@packages/utils/cliOutput.js';

const API_BASE = process.env.BRUNELLA_API_URL || "http://localhost:3000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const text = await response.text();
  if (!text) throw new Error(`Üres válasz: ${path}`);
  return JSON.parse(text) as T;
}

export function registerCrawl4aiCommands(program: Command): void {
  const crawl4ai = program
    .command("crawl4ai")
    .description("🕷️ Intelligens web crawling — Crawl4AI");

  // brunella crawl4ai status
  crawl4ai
    .command("status")
    .alias("állapot")
    .description("Crawl4AI szolgáltatás állapotának ellenőrzése")
    .action(async () => {
      const spinner = ora("Crawl4AI állapot ellenőrzése...").start();
      try {
        const data = await apiFetch<{
          available: boolean;
          python_api: string;
          error?: string;
        }>("/api/v1/crawl4ai/status");

        if (data.available) {
          spinner.succeed(chalk.green("✅ Crawl4AI elérhető"));
          writeLine(chalk.dim(`   Python API: ${data.python_api}`));
        } else {
          spinner.warn(chalk.yellow("⚠️  Crawl4AI nem elérhető"));
          writeLine(chalk.dim(`   Python API: ${data.python_api}`));
          if (data.error) {
            writeLine(chalk.red(`   Hiba: ${data.error}`));
          }
          writeLine(chalk.dim("   Indítsd el: cd myai && uvicorn server:app --port 8000"));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  // brunella crawl4ai crawl <url>
  crawl4ai
    .command("crawl")
    .alias("begyűjt")
    .description("Egyedi URL crawlolása és tartalom kinyerése")
    .argument("[url]", "Crawlolandó URL")
    .option("-s, --selector <selector>", "CSS selector, amire várakozik")
    .option("--schema <json>", "Struktúrált kinyerés JSON séma")
    .action(async (url: string | undefined, options: { selector?: string; schema?: string }) => {
      if (!url) {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "url",
            message: "🌐 Crawlolandó URL:",
            validate: (input: string) => input.startsWith("http") || "Érvényes URL-t adj meg (http...)",
          },
        ]);
        url = answers.url;
      }

      const spinner = ora(`Crawling: ${chalk.cyan(url!)}`).start();
      try {
        const body: Record<string, unknown> = { url };
        if (options.selector) body.wait_for_selector = options.selector;
        if (options.schema) body.extract_schema = options.schema;

        const result = await apiFetch<{
          success: boolean;
          data?: { markdown?: string; title?: string; url?: string };
          error?: string;
        }>("/api/v1/crawl4ai/crawl", {
          method: "POST",
          body: JSON.stringify(body),
        });

        if (result.success && result.data) {
          spinner.succeed(chalk.green("✅ Crawl sikeres!"));
          writeLine(chalk.blue("\n╔════════════════════════════════════╗"));
          writeLine(chalk.blue("║") + chalk.bold("  CRAWL4AI EREDMÉNY                ") + chalk.blue("║"));
          writeLine(chalk.blue("╚════════════════════════════════════╝\n"));
          if (result.data.title) {
            writeLine(chalk.cyan(`  📄 Cím: ${result.data.title}`));
          }
          writeLine(chalk.cyan(`  🔗 URL: ${result.data.url || url}`));
          const markdown = result.data.markdown || "";
          writeLine(chalk.cyan(`  📊 Méret: ${markdown.length} karakter\n`));
          // Preview: első 500 karakter
          if (markdown.length > 0) {
            const preview = markdown.substring(0, 500);
            writeLine(chalk.dim("  --- Előnézet (első 500 karakter) ---"));
            writeLine(chalk.gray(`  ${preview.replace(/\n/g, "\n  ")}...`));
          }
        } else {
          spinner.fail(chalk.red(`Crawl hiba: ${result.error || "Ismeretlen hiba"}`));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  // brunella crawl4ai batch
  crawl4ai
    .command("batch")
    .alias("csoportos")
    .description("Több URL párhuzamos crawlolása")
    .option("-u, --urls <urls...>", "URL-ek szóközzel elválasztva")
    .action(async (options: { urls?: string[] }) => {
      let urls = options.urls;

      if (!urls || urls.length === 0) {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "urls",
            message: "🌐 URL-ek (vesszővel elválasztva):",
            validate: (input: string) => input.length > 5 || "Adj meg legalább egy URL-t",
          },
        ]);
        urls = (answers.urls as string).split(",").map((u: string) => u.trim()).filter(Boolean);
      }

      const spinner = ora(`Batch crawl: ${urls.length} URL...`).start();
      try {
        const result = await apiFetch<{
          success: boolean;
          data?: { results?: Array<{ url: string; status: string }> };
          error?: string;
        }>("/api/v1/crawl4ai/batch", {
          method: "POST",
          body: JSON.stringify({ urls }),
        });

        if (result.success && result.data?.results) {
          spinner.succeed(chalk.green(`✅ Batch crawl kész! ${result.data.results.length} eredmény`));
          result.data.results.forEach((r, i) => {
            const statusColor = r.status === "success" ? chalk.green : chalk.red;
            writeLine(`  ${chalk.bold(`#${i + 1}`)} ${statusColor(r.status)} | ${r.url}`);
          });
        } else {
          spinner.fail(chalk.red(`Batch hiba: ${result.error || "Ismeretlen hiba"}`));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });
}

