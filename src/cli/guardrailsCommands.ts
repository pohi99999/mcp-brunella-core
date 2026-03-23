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
        const stats = await res.json();

        console.log(chalk.bold.green("\n🛡️  Guardrails Állapot\n"));
        console.log(`  Strict Mode:        ${stats.strictMode ? chalk.red('BE (hard-fail)') : chalk.green('KI (soft-fail)')}`);
        console.log(`  Confidence Küszöb:  ${chalk.cyan(stats.confidenceThreshold)}`);
        console.log(`  Validáció OK:       ${chalk.green(stats.validationsPassed)}`);
        console.log(`  Validáció Hiba:     ${chalk.yellow(stats.validationsFailed)}`);
        console.log(`  Átl. Confidence:    ${chalk.cyan(stats.avgConfidence?.toFixed(2) || '—')}`);
        console.log(`  PII Redakciók:      ${chalk.red(stats.redactionsTriggered)}`);
        console.log("");
      } catch (err: any) {
        console.log(chalk.red(`\n❌ Guardrails API nem elérhető: ${err.message}`));
        console.log(chalk.gray("  Indítsd el a szervert: npm start\n"));
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

      console.log(chalk.bold("\n🔒 Redakció Eredmény\n"));
      console.log(`  Eredeti:   ${chalk.gray(text)}`);
      console.log(`  Redaktált: ${chalk.green(result.redacted)}`);
      if (result.hadFindings) {
        console.log(`  Találatok: ${result.findings.map(f => chalk.yellow(`${f.type}(${f.count})`)).join(', ')}`);
      } else {
        console.log(`  ${chalk.green('Nincs PII/titok találat.')}`);
      }
      console.log("");
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
        const stats = await res.json();

        console.log(chalk.bold.blue("\n📊 Telemetria Összesítő\n"));
        console.log(`  Aktív Spanek:       ${chalk.yellow(stats.activeSpans)}`);
        console.log(`  Befejezett Spanek:  ${chalk.green(stats.completedSpans)}`);
        console.log(`  Input Tokenek:      ${chalk.cyan(stats.totalInputTokens?.toLocaleString() || '0')}`);
        console.log(`  Output Tokenek:     ${chalk.cyan(stats.totalOutputTokens?.toLocaleString() || '0')}`);

        if (stats.tokensByModel && Object.keys(stats.tokensByModel).length > 0) {
          console.log(chalk.bold("\n  Token Használat Modell Szerint:"));
          for (const [model, usage] of Object.entries(stats.tokensByModel) as any) {
            console.log(`    ${chalk.gray(model)}: ↑${usage.input?.toLocaleString()} / ↓${usage.output?.toLocaleString()}`);
          }
        }
        console.log("");
      } catch (err: any) {
        console.log(chalk.red(`\n❌ Telemetria API nem elérhető: ${err.message}`));
        console.log(chalk.gray("  Indítsd el a szervert: npm start\n"));
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
        const traces = await res.json();

        console.log(chalk.bold.blue(`\n📋 Legutóbbi ${opts.n} Trace\n`));
        if (traces.length === 0) {
          console.log(chalk.gray("  Még nincs trace adat.\n"));
          return;
        }

        for (const t of traces) {
          const statusIcon = t.status === 'success' ? chalk.green('✓') : t.status === 'error' ? chalk.red('✗') : chalk.yellow('⟳');
          const durStr = t.duration > 1000 ? `${(t.duration / 1000).toFixed(1)}s` : `${t.duration}ms`;
          console.log(`  ${statusIcon} ${chalk.bold(t.agentName)}::${t.operation} ${chalk.gray(durStr)} ${chalk.dim(t.traceId.slice(0, 8))}`);
        }
        console.log("");
      } catch (err: any) {
        console.log(chalk.red(`\n❌ Telemetria API nem elérhető: ${err.message}`));
      }
    });
}
