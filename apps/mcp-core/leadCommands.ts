/**
 * Lead Mining CLI Commands (Master Track 1 - Phase 4)
 *
 * Parancsok:
 *  - brunella leads run <query>   — Lead mining indítása
 *  - brunella leads status        — Utolsó job státusza
 *  - brunella leads list          — Legutóbbi leadek listája
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

interface LeadRunResponse {
  jobId: string;
  message: string;
}

interface LeadJob {
  id: string;
  query: string;
  status: string;
  created_at: string;
}

interface LeadStatusResponse {
  jobs: LeadJob[];
}

interface LeadRecord {
  id: string;
  company_name: string;
  contact_email?: string;
  email_status?: string;
  icebreaker_text?: string;
  created_at: string;
}

interface LeadListResponse {
  leads: LeadRecord[];
}

function writeLine(message = ""): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ""): void {
  process.stderr.write(`${message}\n`);
}

export function registerLeadCommands(program: Command): void {
  const leads = program
    .command("leads")
    .description("B2B Lead Mining parancsok (LeadMiningAgent)");

  leads
    .command("run")
    .description("Lead mining indítása — Google Maps scraping + icebreaker + email validáció")
    .argument("[query]", 'Keresési lekérdezés (pl. "fogorvos Budapest")', "fogorvos Budapest")
    .option("--limit <number>", "Maximum lead szám", "10")
    .action(async (query: string, opts: { limit: string }) => {
      const spinner = ora(`Lead mining indítása: "${query}"...`).start();

      try {
        const res = await fetch(`${API_BASE}/api/v1/business-jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "lead_mining",
            query,
            metadata: { limit: parseInt(opts.limit, 10) },
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          spinner.fail(chalk.red(`API hiba (${res.status}): ${err}`));
          process.exit(1);
        }

        const data = await res.json() as LeadRunResponse;
        spinner.succeed(chalk.green(`Lead mining elindítva! Job ID: ${chalk.bold(data.jobId)}`));
        writeLine(chalk.dim(`  Lekérdezés: "${query}" | Limit: ${opts.limit}`));
        writeLine(chalk.dim(`  Állapot: brunella leads status`));
      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        writeError(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  leads
    .command("status")
    .description("Utolsó lead mining job állapota és statisztikái")
    .option("--limit <number>", "Megjelenített jobok száma", "5")
    .action(async (opts: { limit: string }) => {
      const spinner = ora("Job adatok lekérése...").start();

      try {
        const res = await fetch(
          `${API_BASE}/api/v1/business-jobs?type=lead_mining&limit=${opts.limit}`,
        );

        if (!res.ok) {
          spinner.fail(chalk.red(`API hiba (${res.status})`));
          process.exit(1);
        }

        const data = await res.json() as LeadStatusResponse;
        spinner.stop();

        if (!data.jobs || data.jobs.length === 0) {
          writeLine(chalk.yellow("Nincs korábbi lead mining job. Futtatás: brunella leads run"));
          return;
        }

        writeLine(chalk.blue("\n╔═══════════════════════════════════════════════════════════════╗"));
        writeLine(chalk.blue("║") + chalk.bold("          LEAD MINING JOB STATISZTIKA                       ") + chalk.blue("║"));
        writeLine(chalk.blue("╚═══════════════════════════════════════════════════════════════╝\n"));

        data.jobs.forEach((job, idx) => {
          const statusColor = job.status === "completed" ? chalk.green : job.status === "failed" ? chalk.red : chalk.yellow;
          writeLine(`${chalk.bold(`#${idx + 1}`)} ${chalk.dim(job.id.slice(0, 8))}... | ${statusColor(job.status)} | "${job.query}"`);
          writeLine(chalk.dim(`   Létrehozva: ${new Date(job.created_at).toLocaleString("hu-HU")}`));
        });
        writeLine();

      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        writeError(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });

  leads
    .command("list")
    .description("Legutóbbi leadek listázása")
    .option("--job-id <id>", "Szűrés job ID szerint")
    .option("--limit <number>", "Megjelenített leadek száma", "20")
    .action(async (opts: { jobId?: string; limit: string }) => {
      const spinner = ora("Leadek lekérése...").start();

      try {
        const url = opts.jobId
          ? `${API_BASE}/api/v1/business-jobs/leads/${opts.jobId}`
          : `${API_BASE}/api/v1/business-jobs/leads/all`;

        const res = await fetch(url);

        if (!res.ok) {
          spinner.fail(chalk.red(`API hiba (${res.status})`));
          process.exit(1);
        }

        const data = await res.json() as LeadListResponse;
        spinner.stop();

        if (!data.leads || data.leads.length === 0) {
          writeLine(chalk.yellow("Nincsenek leadek. Futtatás: brunella leads run"));
          return;
        }

        const shown = data.leads.slice(0, parseInt(opts.limit, 10));

        writeLine(chalk.blue(`\n═══ LEADEK (${shown.length}/${data.leads.length}) ═══\n`));

        shown.forEach((lead, idx) => {
          const emailColor = lead.email_status === "valid" ? chalk.green : lead.email_status === "invalid" ? chalk.red : chalk.yellow;
          writeLine(`${chalk.bold(`${idx + 1}.`)} ${chalk.cyan(lead.company_name)}`);
          if (lead.contact_email) {
            writeLine(`   Email: ${emailColor(lead.contact_email)} ${lead.email_status ? `(${lead.email_status})` : ""}`);
          }
          if (lead.icebreaker_text) {
            const ib = lead.icebreaker_text.slice(0, 80);
            writeLine(`   Icebreaker: ${chalk.dim(ib)}${lead.icebreaker_text.length > 80 ? "..." : ""}`);
          }
        });
        writeLine();

      } catch (e: unknown) {
        spinner.fail(chalk.red("Kapcsolódási hiba"));
        writeError(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
      }
    });
}
