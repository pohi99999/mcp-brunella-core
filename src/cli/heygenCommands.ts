import { readFile } from 'fs/promises';

import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';

const API_BASE = process.env.BRUNELLA_API_URL ?? 'http://localhost:3000';

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

async function apiFetch<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API hiba (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

function parseCsv(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function printJsonBlock(title: string, payload: unknown): void {
  writeLine();
  writeLine(chalk.bold(title));
  writeLine(JSON.stringify(payload, null, 2));
  writeLine();
}

async function readPromptFile(prompt?: string, promptFile?: string): Promise<string> {
  if (promptFile) {
    return readFile(promptFile, 'utf-8');
  }

  return prompt ?? '';
}

interface HeygenResponse {
  success: boolean;
  error?: string;
}

export function registerHeygenCommands(program: Command): void {
  const heygen = program
    .command('heygen')
    .description('HeyGen video agent eszközök');

  heygen
    .command('video-general')
    .description('HeyGen Video Agent videó generálása egy promptból')
    .requiredOption('--prompt <text>', 'Video prompt szöveg')
    .option('--prompt-file <path>', 'Prompt fájl útvonala')
    .option('--avatar-id <id>', 'Avatar azonosító')
    .option('--duration-sec <seconds>', 'Becsült hossz másodpercben')
    .option('--orientation <portrait|landscape>', 'Képarány')
    .option('--asset-ids <csv>', 'Vesszővel elválasztott asset ID-k')
    .option('--callback-id <id>', 'Egyedi callback ID')
    .option('--callback-url <url>', 'Callback URL')
    .action(async (options: {
      prompt: string;
      promptFile?: string;
      avatarId?: string;
      durationSec?: string;
      orientation?: 'portrait' | 'landscape';
      assetIds?: string;
      callbackId?: string;
      callbackUrl?: string;
    }) => {
      const spinner = ora('HeyGen videó generálás fut...').start();
      try {
        const prompt = await readPromptFile(options.prompt, options.promptFile);
        if (!prompt.trim()) {
          throw new Error('A prompt nem lehet üres.');
        }

        const data = await apiFetch<HeygenResponse & { videoId?: string; response?: unknown }>('/api/v1/heygen/video-agent/generate', 'POST', {
          prompt,
          avatarId: options.avatarId,
          durationSec: options.durationSec ? Number(options.durationSec) : undefined,
          orientation: options.orientation,
          assetIds: parseCsv(options.assetIds),
          callbackId: options.callbackId,
          callbackUrl: options.callbackUrl,
        });

        spinner.stop();
        printJsonBlock('🎬 HeyGen video generálás', data);
      } catch (error: unknown) {
        spinner.fail('HeyGen generálás sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  heygen
    .command('video-status <videoId>')
    .description('HeyGen videó státusz lekérdezése')
    .action(async (videoId: string) => {
      const spinner = ora('HeyGen státusz lekérés fut...').start();
      try {
        const data = await apiFetch<HeygenResponse & { videoId?: string; status?: string; videoUrl?: string }>('/api/v1/heygen/video-status/' + encodeURIComponent(videoId));
        spinner.stop();
        printJsonBlock('📡 HeyGen videó státusz', data);
      } catch (error: unknown) {
        spinner.fail('HeyGen státusz lekérés sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  heygen
    .command('video-share <videoId>')
    .description('Nyilvános HeyGen megosztási link generálása')
    .action(async (videoId: string) => {
      const spinner = ora('HeyGen megosztási link fut...').start();
      try {
        const data = await apiFetch<HeygenResponse & { shareUrl?: string }>('/api/v1/heygen/video/share', 'POST', {
          videoId,
        });
        spinner.stop();
        printJsonBlock('🔗 HeyGen megosztási link', data);
      } catch (error: unknown) {
        spinner.fail('HeyGen megosztási link lekérés sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  heygen
    .command('avatar-list')
    .description('HeyGen avatarok és talking photos listázása')
    .action(async () => {
      const spinner = ora('HeyGen avatar lista fut...').start();
      try {
        const data = await apiFetch<HeygenResponse & { avatars?: unknown[]; talkingPhotos?: unknown[] }>('/api/v1/heygen/avatars');
        spinner.stop();
        printJsonBlock('🧑‍🎤 HeyGen avatarok', data);
      } catch (error: unknown) {
        spinner.fail('HeyGen avatar lista sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  heygen
    .command('asset-list')
    .description('HeyGen assetek listázása')
    .action(async () => {
      const spinner = ora('HeyGen asset lista fut...').start();
      try {
        const data = await apiFetch<HeygenResponse & { assets?: unknown[]; total?: number }>('/api/v1/heygen/assets');
        spinner.stop();
        printJsonBlock('📦 HeyGen assetek', data);
      } catch (error: unknown) {
        spinner.fail('HeyGen asset lista sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  heygen
    .command('asset-upload <filePath>')
    .description('Lokális fájl feltöltése HeyGen assetként')
    .option('--content-type <mime>', 'Opcionális MIME típus')
    .action(async (filePath: string, options: { contentType?: string }) => {
      const spinner = ora('HeyGen asset feltöltés fut...').start();
      try {
        const data = await apiFetch<HeygenResponse & { assetId?: string; url?: string; name?: string; fileType?: string }>(
          '/api/v1/heygen/assets/upload',
          'POST',
          {
            filePath,
            contentType: options.contentType,
          },
        );
        spinner.stop();
        printJsonBlock('⬆️ HeyGen asset feltöltve', data);
      } catch (error: unknown) {
        spinner.fail('HeyGen asset feltöltés sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
