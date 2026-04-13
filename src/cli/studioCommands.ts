import type { Command } from 'commander';
import chalk from 'chalk';

import { studioFullPipeline, studioInit, studioProbe } from './studioRuntime.js';
import { generateAudioPlan } from '../tools/audioPlanTool.js';
import { ingestMediaDirectory } from '../tools/mediaAnalysisTool.js';
import { runQcChecks } from '../tools/qcTool.js';
import { renderTimelinePlan } from '../tools/renderPresetTool.js';
import { generateTimelinePlan } from '../tools/timelinePlanTool.js';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function printJson(title: string, payload: unknown): void {
  writeLine();
  writeLine(chalk.bold(title));
  writeLine(JSON.stringify(payload, null, 2));
}

function parseCsv(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function registerStudioCommands(program: Command): void {
  const studio = program.command('studio').description('Brunella Studio fashion promo post-production workflow');

  studio
    .command('init <projectName>')
    .description('Creates the Brunella Studio working directories for a project')
    .action(async (projectName: string) => {
      printJson('Studio init', await studioInit(projectName));
    });

  studio
    .command('probe')
    .description('Checks FFmpeg and DaVinci Resolve readiness')
    .action(async () => {
      printJson('Studio probe', await studioProbe());
    });

  studio
    .command('ingest')
    .description('Ingests a media directory into a studio manifest')
    .requiredOption('--input-dir <path>', 'Source media directory')
    .option('--project-name <name>', 'Studio project name')
    .option('--generate-proxies', 'Create editing proxies during ingest')
    .action(async (options: { inputDir: string; projectName?: string; generateProxies?: boolean }) => {
      printJson('Studio ingest', await ingestMediaDirectory({ inputDir: options.inputDir, projectName: options.projectName, generateProxies: options.generateProxies }));
    });

  studio
    .command('rough-cut')
    .description('Builds a rough-cut timeline plan JSON')
    .option('--input-dir <path>', 'Source media directory')
    .option('--manifest-path <path>', 'Existing ingest manifest')
    .option('--project-name <name>', 'Studio project name')
    .option('--style <style>', 'elegant | energetic | cinematic | luxury-minimal')
    .option('--target-duration <sec>', 'Target duration in seconds')
    .option('--music-track <path>', 'Optional music track')
    .action(async (options: { inputDir?: string; manifestPath?: string; projectName?: string; style?: never; targetDuration?: string; musicTrack?: string }) => {
      printJson('Studio rough-cut', await generateTimelinePlan({ inputDir: options.inputDir, manifestPath: options.manifestPath, projectName: options.projectName, style: options.style, targetDurationSec: options.targetDuration ? Number(options.targetDuration) : undefined, musicTrackPath: options.musicTrack }));
    });

  studio
    .command('audio-plan')
    .description('Builds an audio post plan JSON from a timeline and music track')
    .requiredOption('--timeline-plan <path>', 'Timeline plan JSON path')
    .requiredOption('--music-track <path>', 'Music track path')
    .option('--project-name <name>', 'Studio project name')
    .option('--style <style>', 'elegant | energetic | cinematic | luxury-minimal')
    .action(async (options: { timelinePlan: string; musicTrack: string; projectName?: string; style?: never }) => {
      printJson('Studio audio-plan', await generateAudioPlan({ timelinePlanPath: options.timelinePlan, musicTrackPath: options.musicTrack, projectName: options.projectName, style: options.style }));
    });

  studio
    .command('render')
    .description('Renders deliverables from a timeline plan with FFmpeg baseline assembly')
    .requiredOption('--project-name <name>', 'Studio project name')
    .requiredOption('--timeline-plan <path>', 'Timeline plan JSON path')
    .option('--music-track <path>', 'Optional music track path')
    .option('--presets <csv>', 'Comma-separated preset names')
    .action(async (options: { projectName: string; timelinePlan: string; musicTrack?: string; presets?: string }) => {
      printJson('Studio render', await renderTimelinePlan({ projectName: options.projectName, timelinePlanPath: options.timelinePlan, musicTrackPath: options.musicTrack, presets: parseCsv(options.presets) as never }));
    });

  studio
    .command('qc')
    .description('Runs QC on a rendered file')
    .requiredOption('--file <path>', 'Rendered file path')
    .option('--expected-duration <sec>', 'Expected duration in seconds')
    .option('--expected-width <px>', 'Expected width')
    .option('--expected-height <px>', 'Expected height')
    .action(async (options: { file: string; expectedDuration?: string; expectedWidth?: string; expectedHeight?: string }) => {
      printJson('Studio QC', await runQcChecks({ filePath: options.file, expectedDurationSec: options.expectedDuration ? Number(options.expectedDuration) : undefined, expectedWidth: options.expectedWidth ? Number(options.expectedWidth) : undefined, expectedHeight: options.expectedHeight ? Number(options.expectedHeight) : undefined }));
    });

  studio
    .command('full-pipeline')
    .alias('full')
    .description('Runs ingest -> rough-cut -> audio-plan -> render -> QC end-to-end')
    .requiredOption('--input-dir <path>', 'Source media directory')
    .option('--project-name <name>', 'Studio project name')
    .option('--style <style>', 'elegant | energetic | cinematic | luxury-minimal')
    .option('--target-duration <sec>', 'Target duration in seconds')
    .option('--music-track <path>', 'Optional music track')
    .option('--presets <csv>', 'Comma-separated preset names')
    .option('--generate-proxies', 'Create editing proxies during ingest')
    .action(async (options: { inputDir: string; projectName?: string; style?: never; targetDuration?: string; musicTrack?: string; presets?: string; generateProxies?: boolean }) => {
      printJson('Studio full pipeline', await studioFullPipeline({ inputDir: options.inputDir, projectName: options.projectName, style: options.style, targetDurationSec: options.targetDuration ? Number(options.targetDuration) : undefined, musicTrackPath: options.musicTrack, presets: parseCsv(options.presets) as never, generateProxies: options.generateProxies }));
    });
}
