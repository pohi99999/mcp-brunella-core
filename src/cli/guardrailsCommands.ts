/**
 * Guardrails & Telemetry CLI Commands
 * Track: guardrails_evaluation_20260323 + observability_opentelemetry_20260323 Phase 4
 *
 * Parancsok:
 *  - brunella guardrails status    — Guardrails állapot
 *  - brunella guardrails test      — Teszt redakció
 *  - brunella telemetry stats      — Telemetria összesítő
 *  - brunella telemetry traces     — Legutóbbi trace-ek
 */

import { Command } from "commander";
import chalk from "chalk";

const API_BASE = process.env.API_BASE_URL || "http://localhost:3000";

interface GuardrailsStats {
  strictMode: boolean;
  confidenceThreshold: number;
  validationsPassed: number;
  validationsFailed: number;
  avgConfidence?: number;
  redactionsTriggered: number;
}

interface TelemetryModelUsage {
  input?: number;
  output?: number;
}

interface TelemetryStats {
  activeSpans: number;
  completedSpans: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  tokensByModel?: Record<string, TelemetryModelUsage>;
}

interface TelemetryTrace {
  status: 'success' | 'error' | 'running';
  duration: number;
  agentName: string;
  operation: string;
  traceId: string;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message = ''): void {
  process.stderr.write(`${message}\n`);
}

export function registerGuardrailsCommands(program: Command): void {
  const guardrails = program
    .command("guardrails")
    .description("Guardrails & Evaluáció parancsok");

  guardrails
    .command("status")
    .description("Guardrails konfiguráció és statisztikák")
    .action(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/guardrails/stats`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const stats = await res.json() as GuardrailsStats;

        writeLine(chalk.bold.green("\n🛡️  Guardrails Állapot\n"));
        writeLine(`  Strict Mode:        ${stats.strictMode ? chalk.red('BE (hard-fail)') : chalk.green('KI (soft-fail)')}`);
        writeLine(`  Confidence Küszöb:  ${chalk.cyan(stats.confidenceThreshold)}`);
        writeLine(`  Validáció OK:       ${chalk.green(stats.validationsPassed)}`);
        writeLine(`  Validáció Hiba:     ${chalk.yellow(stats.validationsFailed)}`);
        writeLine(`  Átl. Confidence:    ${chalk.cyan(stats.avgConfidence?.toFixed(2) || '—')}`);
        writeLine(`  PII Redakciók:      ${chalk.red(stats.redactionsTriggered)}`);
        writeLine("");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`\n❌ Guardrails API nem elérhető: ${message}`));
        writeError(chalk.gray("  Indítsd el a szervert: npm start\n"));
      }
    });

  guardrails
    .command("test")
    .description("PII redakció tesztelése egy szövegen")
    .argument("<text>", "Szöveg redakció teszteléshez")
    .action(async (text: string) => {
      // Dinamikus import — nem terheli a CLI indulást
      const { redactText } = await import("../security/redactor.js");
      const result = redactText(text);

      writeLine(chalk.bold("\n🔒 Redakció Eredmény\n"));
      writeLine(`  Eredeti:   ${chalk.gray(text)}`);
      writeLine(`  Redaktált: ${chalk.green(result.redacted)}`);
      if (result.hadFindings) {
        writeLine(`  Találatok: ${result.findings.map(f => chalk.yellow(`${f.type}(${f.count})`)).join(', ')}`);
      } else {
        writeLine(`  ${chalk.green('Nincs PII/titok találat.')}`);
      }
      writeLine("");
    });
}

export function registerTelemetryCommands(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description("OpenTelemetry & Observability parancsok");

  telemetry
    .command("stats")
    .description("Telemetria összesítő — spanek, tokenek")
    .action(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/telemetry/stats`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const stats = await res.json() as TelemetryStats;

        writeLine(chalk.bold.blue("\n📊 Telemetria Összesítő\n"));
        writeLine(`  Aktív Spanek:       ${chalk.yellow(stats.activeSpans)}`);
        writeLine(`  Befejezett Spanek:  ${chalk.green(stats.completedSpans)}`);
        writeLine(`  Input Tokenek:      ${chalk.cyan(stats.totalInputTokens?.toLocaleString() || '0')}`);
        writeLine(`  Output Tokenek:     ${chalk.cyan(stats.totalOutputTokens?.toLocaleString() || '0')}`);

        if (stats.tokensByModel && Object.keys(stats.tokensByModel).length > 0) {
          writeLine(chalk.bold("\n  Token Használat Modell Szerint:"));
          for (const [model, usage] of Object.entries(stats.tokensByModel)) {
            writeLine(`    ${chalk.gray(model)}: ↑${usage.input?.toLocaleString() ?? '0'} / ↓${usage.output?.toLocaleString() ?? '0'}`);
          }
        }
        writeLine("");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`\n❌ Telemetria API nem elérhető: ${message}`));
        writeError(chalk.gray("  Indítsd el a szervert: npm start\n"));
      }
    });

  telemetry
    .command("traces")
    .description("Legutóbbi trace-ek listája")
    .option("-n <count>", "Trace szám", "10")
    .action(async (opts: { n: string }) => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/telemetry/traces?limit=${opts.n}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const traces = await res.json() as TelemetryTrace[];

        writeLine(chalk.bold.blue(`\n📋 Legutóbbi ${opts.n} Trace\n`));
        if (traces.length === 0) {
          writeLine(chalk.gray("  Még nincs trace adat.\n"));
          return;
        }

        for (const t of traces) {
          const statusIcon = t.status === 'success' ? chalk.green('✓') : t.status === 'error' ? chalk.red('✗') : chalk.yellow('⟳');
          const durStr = t.duration > 1000 ? `${(t.duration / 1000).toFixed(1)}s` : `${t.duration}ms`;
          writeLine(`  ${statusIcon} ${chalk.bold(t.agentName)}::${t.operation} ${chalk.gray(durStr)} ${chalk.dim(t.traceId.slice(0, 8))}`);
        }
        writeLine("");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        writeError(chalk.red(`\n❌ Telemetria API nem elérhető: ${message}`));
      }
    });
}
