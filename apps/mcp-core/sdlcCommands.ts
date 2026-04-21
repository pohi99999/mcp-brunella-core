/**
 * @fileoverview Brunella CLI — SDLC pipeline parancsok (Hungarian)
 *
 * Parancsok:
 *   brunella sdlc status <trackId>
 *   brunella sdlc run <trackId>
 *   brunella sdlc phase <trackId> <phase>
 *   brunella sdlc reset <trackId>
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as sdlcPipeline from '@packages/core-logic/sdlcPipeline.js';
import { writeLine } from '@packages/utils/cliOutput.js';

const CONDUCTOR_PATH = path.join(process.cwd(), 'conductor');

function resolveTrackDir(trackId: string): string {
  return path.join(CONDUCTOR_PATH, 'tracks', trackId);
}

function requireTrackDir(trackId: string): string {
  const dir = resolveTrackDir(trackId);
  if (!fs.existsSync(dir)) {
    writeLine(chalk.red(`❌ Track nem található: ${trackId}`));
    process.exit(1);
  }

  const metaPath = path.join(dir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    writeLine(chalk.red(`❌ A track-hez nem tartozik meta.json: ${trackId}`));
    process.exit(1);
  }

  return dir;
}

function ensureSdlcInitialized(trackId: string, trackDir: string): void {
  const status = sdlcPipeline.getStatus(trackId, trackDir);
  if (!status.enabled) {
    sdlcPipeline.init(trackId, trackDir);
  }
}

function phaseIcon(status: sdlcPipeline.SdlcPhaseStatus): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'running':
      return '🔄';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '•';
  }
}

/**
 * Registers the `brunella sdlc` command group.
 * @param program - Commander root program.
 */
export function registerSdlcCommands(program: Command): void {
  const sdlc = program
    .command('sdlc')
    .description('SDLC pipeline parancsok conductor track-ekhez');

  sdlc
    .command('status <trackId>')
    .description('SDLC fázisok állapotának megjelenítése')
    .action((trackId: string) => {
      const trackDir = requireTrackDir(trackId);
      const status = sdlcPipeline.getStatus(trackId, trackDir);

      if (!status.enabled) {
        writeLine(chalk.yellow('⚠️ Az SDLC pipeline nincs engedélyezve erre a track-re.'));
        return;
      }

      writeLine();
      writeLine(chalk.bold(`🔄 SDLC státusz — ${trackId}`));
      writeLine(chalk.gray(`Aktuális fázis: ${chalk.cyan(status.currentPhase)}`));
      writeLine();

      sdlcPipeline.PHASE_ORDER.forEach((phase) => {
        const current = status.phases[phase];
        writeLine(`  ${phaseIcon(current)} ${chalk.white(phase.padEnd(12))} ${chalk.gray(current)}`);
      });

      if (status.complete) {
        writeLine();
        writeLine(chalk.green('🎉 Az SDLC pipeline teljesen lefutott; a track testing státuszba került.'));
      }

      writeLine();
    });

  sdlc
    .command('run <trackId>')
    .description('Teljes SDLC pipeline futtatása (auto-advance)')
    .action(async (trackId: string) => {
      const trackDir = requireTrackDir(trackId);
      ensureSdlcInitialized(trackId, trackDir);
      const spinner = ora(`SDLC pipeline indítása: ${trackId}...`).start();

      try {
        await sdlcPipeline.advance(trackId, trackDir);
        spinner.succeed(chalk.green(`SDLC pipeline kész: ${trackId}`));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail(chalk.red(`SDLC pipeline hiba: ${message}`));
        process.exit(1);
      }
    });

  sdlc
    .command('phase <trackId> <phase>')
    .description('Egy adott SDLC fázis futtatása (architect|devops|coder|qa|reviewer)')
    .action(async (trackId: string, phase: string) => {
      const validPhases = sdlcPipeline.PHASE_ORDER as readonly string[];
      if (!validPhases.includes(phase)) {
        writeLine(chalk.red(`❌ Érvénytelen fázis: ${phase}`));
        writeLine(chalk.gray(`Érvényes fázisok: ${validPhases.join(', ')}`));
        process.exit(1);
      }

      const trackDir = requireTrackDir(trackId);
      ensureSdlcInitialized(trackId, trackDir);
      const spinner = ora(`${phase} fázis futtatása...`).start();

      try {
        await sdlcPipeline.runPhase(trackId, trackDir, phase as sdlcPipeline.SdlcPhase);
        spinner.succeed(chalk.green(`${phase} fázis kész`));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        spinner.fail(chalk.red(`${phase} fázis hiba: ${message}`));
        process.exit(1);
      }
    });

  sdlc
    .command('reset <trackId>')
    .description('SDLC fázisok visszaállítása (minden fázis pending)')
    .action(async (trackId: string) => {
      const trackDir = requireTrackDir(trackId);
      ensureSdlcInitialized(trackId, trackDir);
      await sdlcPipeline.reset(trackId, trackDir);
      writeLine(chalk.green(`✅ SDLC visszaállítva: ${trackId}`));
    });
}

