/**
 * Memória (User Preferences) CLI Commands — Magyar nyelvű preferencia-kezelő
 *
 * Parancsok:
 *   brunella memoria mentés        — Preferencia mentése
 *   brunella memoria lista          — Preferenciák listázása
 *   brunella memoria kontextus      — LLM kontextus lekérdezése
 *   brunella memoria törlés         — Preferencia törlése
 *   brunella memoria takarítás      — Lejárt preferenciák törlése
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

export function registerMemoriaCommands(program: Command): void {
  const memoria = program
    .command("memoria")
    .description("🧠 Felhasználói preferenciák és memória kezelése");

  // brunella memoria mentés
  memoria
    .command("mentés")
    .alias("save")
    .description("Új preferencia mentése")
    .option("-u, --user <userId>", "Felhasználó azonosító", "default")
    .action(async (options: { user: string }) => {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "key",
          message: "🔑 Preferencia kulcs:",
          validate: (input: string) => input.length > 0 || "Adj meg egy kulcsot",
        },
        {
          type: "input",
          name: "value",
          message: "📝 Érték:",
          validate: (input: string) => input.length > 0 || "Adj meg egy értéket",
        },
        {
          type: "list",
          name: "memory_type",
          message: "🧠 Memória típus:",
          choices: [
            { name: "📚 Szemantikus (tények, tudás)", value: "semantic" },
            { name: "📖 Epizodikus (események, munkamenetek)", value: "episodic" },
            { name: "⚙️  Procedurális (eljárások, minták)", value: "procedural" },
          ],
          default: "semantic",
        },
        {
          type: "number",
          name: "ttl_days",
          message: "⏳ Lejárat (napokban, 0 = nem jár le):",
          default: 0,
        },
      ]);

      const spinner = ora("Preferencia mentése...").start();
      try {
        const result = await apiFetch<{ success: boolean; message?: string; error?: string }>(
          "/api/v1/preferences",
          {
            method: "POST",
            body: JSON.stringify({
              user_id: options.user,
              key: answers.key,
              value: answers.value,
              memory_type: answers.memory_type,
              ttl_days: answers.ttl_days > 0 ? answers.ttl_days : undefined,
            }),
          },
        );

        if (result.success) {
          spinner.succeed(chalk.green(`✅ Preferencia mentve: "${answers.key}"`));
        } else {
          spinner.fail(chalk.red(`Hiba: ${result.error}`));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  // brunella memoria lista
  memoria
    .command("lista")
    .alias("list")
    .description("Preferenciák listázása")
    .option("-u, --user <userId>", "Felhasználó azonosító", "default")
    .option("-t, --type <type>", "Memória típus szűrő (episodic/semantic/procedural)")
    .option("-l, --limit <limit>", "Maximum sorok száma", "20")
    .action(async (options: { user: string; type?: string; limit: string }) => {
      const spinner = ora("Preferenciák lekérdezése...").start();
      try {
        let query = `/api/v1/preferences/${options.user}?limit=${options.limit}`;
        if (options.type) query += `&memory_type=${options.type}`;

        const result = await apiFetch<{
          success: boolean;
          count?: number;
          preferences?: Array<{
            key: string;
            value: string;
            memory_type: string;
            confidence: number;
            updated_at: string;
            access_count: number;
          }>;
          error?: string;
        }>(query);

        spinner.stop();

        if (result.success && result.preferences) {
          writeLine(chalk.blue("\n╔════════════════════════════════════════╗"));
          writeLine(chalk.blue("║") + chalk.bold("  🧠 FELHASZNÁLÓI PREFERENCIÁK         ") + chalk.blue("║"));
          writeLine(chalk.blue("╚════════════════════════════════════════╝\n"));
          writeLine(chalk.dim(`  Felhasználó: ${options.user} | Összesen: ${result.count}\n`));

          if (result.preferences.length === 0) {
            writeLine(chalk.yellow("  Nincsenek preferenciák."));
            return;
          }

          const typeEmoji: Record<string, string> = {
            semantic: "📚",
            episodic: "📖",
            procedural: "⚙️",
          };

          result.preferences.forEach((p, i) => {
            const emoji = typeEmoji[p.memory_type] || "📝";
            writeLine(
              `  ${chalk.bold(`#${i + 1}`)} ${emoji} ${chalk.cyan(p.key)} = ${chalk.white(p.value.substring(0, 60))}${p.value.length > 60 ? "..." : ""}`,
            );
            writeLine(
              chalk.dim(
                `      Típus: ${p.memory_type} | Bizonyosság: ${(p.confidence * 100).toFixed(0)}% | Hozzáférés: ${p.access_count}x | ${new Date(p.updated_at).toLocaleString("hu-HU")}`,
              ),
            );
          });
          writeLine();
        } else {
          writeLine(chalk.red(`Hiba: ${result.error || "Ismeretlen hiba"}`));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  // brunella memoria kontextus
  memoria
    .command("kontextus")
    .alias("context")
    .description("LLM kontextus lekérdezése a felhasználó preferenciáiból")
    .option("-u, --user <userId>", "Felhasználó azonosító", "default")
    .action(async (options: { user: string }) => {
      const spinner = ora("Kontextus lekérdezése...").start();
      try {
        const result = await apiFetch<{
          success: boolean;
          context?: string;
          stats?: {
            total: number;
            by_type: Record<string, number>;
            by_category: Record<string, number>;
          };
          error?: string;
        }>(`/api/v1/preferences/context/${options.user}`);

        spinner.stop();

        if (result.success) {
          writeLine(chalk.blue("\n╔════════════════════════════════════════╗"));
          writeLine(chalk.blue("║") + chalk.bold("  🧠 LLM KONTEXTUS                    ") + chalk.blue("║"));
          writeLine(chalk.blue("╚════════════════════════════════════════╝\n"));

          if (result.stats) {
            writeLine(chalk.cyan("  📊 Statisztikák:"));
            writeLine(chalk.dim(`     Összes preferencia: ${result.stats.total}`));
            if (result.stats.by_type) {
              Object.entries(result.stats.by_type).forEach(([type, count]) => {
                writeLine(chalk.dim(`     ${type}: ${count}`));
              });
            }
            writeLine();
          }

          if (result.context) {
            writeLine(chalk.cyan("  📝 Kontextus szöveg:"));
            writeLine(chalk.gray(`  ${result.context.replace(/\n/g, "\n  ")}`));
          } else {
            writeLine(chalk.yellow("  Nincs kontextus (üres preferenciák)."));
          }
          writeLine();
        } else {
          writeLine(chalk.red(`Hiba: ${result.error}`));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  // brunella memoria törlés
  memoria
    .command("törlés")
    .alias("delete")
    .description("Preferencia törlése")
    .option("-u, --user <userId>", "Felhasználó azonosító", "default")
    .action(async (options: { user: string }) => {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "key",
          message: "🗑️  Törlendő preferencia kulcs:",
          validate: (input: string) => input.length > 0 || "Adj meg egy kulcsot",
        },
        {
          type: "confirm",
          name: "confirm",
          message: "Biztosan törlöd?",
          default: false,
        },
      ]);

      if (!answers.confirm) {
        writeLine(chalk.yellow("Törlés megszakítva."));
        return;
      }

      const spinner = ora("Preferencia törlése...").start();
      try {
        const result = await apiFetch<{ success: boolean; deleted?: boolean; error?: string }>(
          `/api/v1/preferences/${options.user}/${encodeURIComponent(answers.key)}`,
          { method: "DELETE" },
        );

        if (result.success && result.deleted) {
          spinner.succeed(chalk.green(`✅ Preferencia törölve: "${answers.key}"`));
        } else if (result.success && !result.deleted) {
          spinner.warn(chalk.yellow(`⚠️  Nem található: "${answers.key}"`));
        } else {
          spinner.fail(chalk.red(`Hiba: ${result.error}`));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  // brunella memoria takarítás
  memoria
    .command("takarítás")
    .alias("purge")
    .description("Lejárt preferenciák törlése")
    .action(async () => {
      const spinner = ora("Lejárt preferenciák törlése...").start();
      try {
        const result = await apiFetch<{ success: boolean; purged?: number; error?: string }>(
          "/api/v1/preferences/purge",
          { method: "POST" },
        );

        if (result.success) {
          spinner.succeed(chalk.green(`✅ Takarítás kész! ${result.purged || 0} lejárt bejegyzés törölve.`));
        } else {
          spinner.fail(chalk.red(`Hiba: ${result.error}`));
        }
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        console.error(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });
}

