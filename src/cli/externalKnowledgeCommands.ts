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

function parsePipeList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readOptionalFile(path?: string): Promise<string | undefined> {
  if (!path) {
    return undefined;
  }
  return readFile(path, 'utf-8');
}

function printJsonBlock(title: string, payload: unknown): void {
  writeLine();
  writeLine(chalk.bold(title));
  writeLine(JSON.stringify(payload, null, 2));
  writeLine();
}

interface SourceResponse {
  success: boolean;
  source?: unknown;
  error?: string;
}

interface CardResponse {
  success: boolean;
  card?: unknown;
  error?: string;
}

interface ReviewQueueResponse {
  success: boolean;
  items: unknown[];
  count: number;
}

interface SearchResponse {
  success: boolean;
  results: unknown[];
  count: number;
}

export function registerExternalKnowledgeCommands(program: Command): void {
  const knowledge = program
    .command('knowledge')
    .description('Külső tudás ingest és canonical knowledge parancsok');

  knowledge
    .command('beolvas-web <url>')
    .description('Weboldal ingest a staged tudásrétegbe')
    .option('--title <title>', 'Opcionális felülírt cím')
    .option('--content-file <path>', 'Lokális fájlból betöltött tartalom a fetch helyett')
    .option('--author <author>', 'Szerző')
    .option('--language <language>', 'Nyelv, pl. hu vagy en')
    .option('--tags <csv>', 'Vesszővel elválasztott tagek')
    .action(async (url: string, options: { title?: string; contentFile?: string; author?: string; language?: string; tags?: string }) => {
      const spinner = ora('Web tudás ingest fut...').start();
      try {
        const content = await readOptionalFile(options.contentFile);
        const data = await apiFetch<SourceResponse>('/api/v1/knowledge/sources/web', 'POST', {
          url,
          title: options.title,
          content,
          author: options.author,
          language: options.language,
          tags: parseCsv(options.tags),
        });
        spinner.stop();
        printJsonBlock('📥 Web source beolvasva', data.source ?? data);
      } catch (error: unknown) {
        spinner.fail('Web ingest sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  knowledge
    .command('beolvas-youtube <url>')
    .description('YouTube transcript ingest a staged tudásrétegbe')
    .requiredOption('--transcript-file <path>', 'Transcript fájl útvonala')
    .option('--title <title>', 'Opcionális videócím')
    .option('--channel <channel>', 'Csatorna vagy szerző')
    .option('--language <language>', 'Nyelv')
    .option('--tags <csv>', 'Vesszővel elválasztott tagek')
    .action(async (url: string, options: { transcriptFile: string; title?: string; channel?: string; language?: string; tags?: string }) => {
      const spinner = ora('YouTube transcript ingest fut...').start();
      try {
        const transcript = await readFile(options.transcriptFile, 'utf-8');
        const data = await apiFetch<SourceResponse>('/api/v1/knowledge/sources/youtube', 'POST', {
          url,
          transcript,
          title: options.title,
          channel: options.channel,
          language: options.language,
          tags: parseCsv(options.tags),
        });
        spinner.stop();
        printJsonBlock('🎬 YouTube source beolvasva', data.source ?? data);
      } catch (error: unknown) {
        spinner.fail('YouTube ingest sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  knowledge
    .command('kartya')
    .description('Provisional knowledge card létrehozása screened source-okból')
    .requiredOption('--source-ids <csv>', 'Forrás ID-k vesszővel elválasztva')
    .requiredOption('--summary <text>', 'Tömör összefoglaló')
    .requiredOption('--claims <list>', 'Claim lista | karakterrel elválasztva')
    .option('--title <title>', 'Kártyacím')
    .option('--evidence <list>', 'Evidence lista | karakterrel elválasztva')
    .option('--tags <csv>', 'Vesszővel elválasztott tagek')
    .option('--entities <list>', 'Entitások | karakterrel elválasztva')
    .option('--confidence <score>', '0..1 közötti confidence érték')
    .action(async (options: {
      sourceIds: string;
      summary: string;
      claims: string;
      title?: string;
      evidence?: string;
      tags?: string;
      entities?: string;
      confidence?: string;
    }) => {
      const spinner = ora('Knowledge card létrehozása...').start();
      try {
        const data = await apiFetch<CardResponse>('/api/v1/knowledge/cards', 'POST', {
          sourceIds: parseCsv(options.sourceIds),
          title: options.title,
          summary: options.summary,
          claims: parsePipeList(options.claims),
          evidence: parsePipeList(options.evidence),
          tags: parseCsv(options.tags),
          entities: parsePipeList(options.entities),
          confidence: options.confidence ? Number(options.confidence) : undefined,
        });
        spinner.stop();
        printJsonBlock('🗂️ Provisional knowledge card létrehozva', data.card ?? data);
      } catch (error: unknown) {
        spinner.fail('Knowledge card létrehozás sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  knowledge
    .command('sor')
    .description('Governance review queue listázása')
    .option('--limit <n>', 'Maximum elemszám', '20')
    .action(async (options: { limit: string }) => {
      const spinner = ora('Review queue lekérése...').start();
      try {
        const data = await apiFetch<ReviewQueueResponse>(`/api/v1/knowledge/review-queue?limit=${encodeURIComponent(options.limit)}`);
        spinner.stop();
        printJsonBlock(`📋 Review queue (${data.count})`, data.items);
      } catch (error: unknown) {
        spinner.fail('Review queue lekérés sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  knowledge
    .command('keres <query>')
    .description('Canonical knowledge card keresés')
    .option('--limit <n>', 'Maximum elemszám', '10')
    .option('--include-provisional', 'A provisional kártyákat is vegye bele', false)
    .action(async (query: string, options: { limit: string; includeProvisional?: boolean }) => {
      const spinner = ora('Knowledge keresés fut...').start();
      try {
        const params = new URLSearchParams({
          query,
          limit: options.limit,
          includeProvisional: options.includeProvisional ? 'true' : 'false',
        });
        const data = await apiFetch<SearchResponse>(`/api/v1/knowledge/search?${params.toString()}`);
        spinner.stop();
        printJsonBlock(`🔎 Knowledge találatok (${data.count})`, data.results);
      } catch (error: unknown) {
        spinner.fail('Knowledge keresés sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  knowledge
    .command('promotal <cardId>')
    .description('Provisional knowledge card canonical státuszra emelése')
    .requiredOption('--reviewer <name>', 'Jóváhagyó neve vagy azonosítója')
    .option('--note <text>', 'Megjegyzés / single-source approval indoklás')
    .action(async (cardId: string, options: { reviewer: string; note?: string }) => {
      const spinner = ora('Knowledge card promóció fut...').start();
      try {
        const data = await apiFetch<CardResponse>(`/api/v1/knowledge/cards/${encodeURIComponent(cardId)}/promote`, 'POST', {
          reviewer: options.reviewer,
          note: options.note,
        });
        spinner.stop();
        printJsonBlock('✅ Canonical knowledge card', data.card ?? data);
      } catch (error: unknown) {
        spinner.fail('Knowledge card promóció sikertelen');
        writeLine(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
