import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { agentManager } from '../../agents/AgentManager.js';

type CashEntryType = 'KP_IN' | 'KP_OUT';
type CashEntrySource = 'manual' | 'email' | 'import';

interface CashEntry {
  id: number;
  date: string;
  type: CashEntryType;
  amount: number;
  description: string;
  invoiceNumber?: string;
  source: CashEntrySource;
  syncedSheets: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CashEntrySummary {
  total: number;
  income: number;
  expense: number;
  balance: number;
  syncedSheets: number;
  pendingSheets: number;
  byType: Record<CashEntryType, number>;
}

interface CashEntryListResponse {
  success: boolean;
  entries: CashEntry[];
  total: number;
  offset: number;
  limit: number;
}

interface CashEntryResponse {
  success: boolean;
  entry: CashEntry;
}

interface CashEntrySummaryResponse {
  success: boolean;
  summary: CashEntrySummary;
  timestamp: string;
}

const API_BASE = process.env.BRUNELLA_API_BASE_URL || 'http://localhost:3000';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('hu-HU');
}

function entryTitle(entry: CashEntry): string {
  const syncLabel = entry.syncedSheets ? 'Sheets' : 'Pending';
  return `${entry.id}. ${formatDate(entry.date)} · ${formatCurrency(entry.amount)} · ${syncLabel}`;
}

async function requestJson<T>(path: string, init: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = text.trim().length > 0 ? JSON.parse(text) as T : undefined;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
          ? (parsed as { error: string }).error
          : `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    if (parsed === undefined) {
      throw new Error('Üres válasz érkezett az API-tól.');
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function ingestSampleData(): Promise<void> {
  const spinner = ora('Banki és NAV adatok beolvasása...').start();

  try {
    const navResult = await agentManager.delegate('NavAgent', 'Process NAV invoices from samples') as { data?: unknown[] };
    const bankResult = await agentManager.delegate('BankAgent', 'Process bank transactions from samples') as { data?: unknown[] };

    spinner.stop();
    console.log(chalk.green(`✅ NAV számlák: ${navResult.data?.length || 0} db`));
    console.log(chalk.green(`✅ Banki tételek: ${bankResult.data?.length || 0} db`));
  } catch (error) {
    spinner.fail('Hiba az adatok beolvasása során.');
    console.error(chalk.red(error));
  }
}

async function runMatching(): Promise<void> {
  const spinner = ora('Intelligens párosítás folyamatban...').start();

  try {
    const result = await agentManager.delegate('MatchingAgent', 'Match all PENDING bank transactions') as {
      status: string;
      data?: { total: number; matched: number; manual: number };
      error?: string;
    };

    spinner.stop();

    if (result.status === 'success') {
      const { total, matched, manual } = result.data ?? { total: 0, matched: 0, manual: 0 };
      console.log(
        boxen(
          chalk.white(`Összes tétel: ${chalk.bold(total)}\n`) +
          chalk.green(`Párosítva: ${chalk.bold(matched)}\n`) +
          chalk.yellow(`Kézi ellenőrzés: ${chalk.bold(manual)}`),
          { title: 'Eredmény', padding: 1, borderColor: 'green' },
        ),
      );
      return;
    }

    console.log(chalk.red('Hiba a párosításban: ') + (result.error || 'Ismeretlen hiba'));
  } catch (error) {
    spinner.fail('Hiba a párosító ügynök futtatásakor.');
    console.error(chalk.red(error));
  }
}

function showStatus(): void {
  console.log(chalk.cyan('\n--- Könyvelési Állapot ---'));
  console.log(chalk.gray('Használt adatbázis: ') + chalk.white('data/bookkeeping.db'));
  console.log(chalk.gray('Aktív ügynökök: ') + chalk.white('BankAgent, NavAgent, MatchingAgent'));
  console.log(chalk.yellow('\nTipp: A részletes elemzéshez használd a Web Dashboard-ot.'));
}

async function showCashSummary(): Promise<void> {
  const spinner = ora('KP összegzés lekérése...').start();

  try {
    const response = await requestJson<CashEntrySummaryResponse>('/api/v1/bookkeeping/cash-summary');
    spinner.stop();

    console.log(
      boxen(
        chalk.white(`Összes tétel: ${chalk.bold(response.summary.total)}\n`) +
        chalk.green(`Bevétel: ${chalk.bold(formatCurrency(response.summary.income))}\n`) +
        chalk.red(`Kiadás: ${chalk.bold(formatCurrency(response.summary.expense))}\n`) +
        chalk.white(`Egyenleg: ${chalk.bold(formatCurrency(response.summary.balance))}\n`) +
        chalk.blue(`Sheetsben: ${chalk.bold(response.summary.syncedSheets)}\n`) +
        chalk.yellow(`Függő: ${chalk.bold(response.summary.pendingSheets)}`),
        { title: 'KP Összegzés', padding: 1, borderColor: 'yellow' },
      ),
    );
  } catch (error) {
    spinner.fail('Nem sikerült lekérni az összegzést.');
    console.error(chalk.red(error));
  }
}

async function listCashEntries(): Promise<void> {
  const spinner = ora('KP tételek lekérése...').start();

  try {
    const response = await requestJson<CashEntryListResponse>('/api/v1/bookkeeping/cash-entries?limit=10&offset=0');
    spinner.stop();

    if (response.entries.length === 0) {
      console.log(chalk.gray('Még nincs rögzített KP tétel.'));
      return;
    }

    console.log(
      boxen(
        response.entries
          .map((entry) => {
            const syncLabel = entry.syncedSheets ? chalk.green('SYNCED') : chalk.yellow('PENDING');
            const typeLabel = entry.type === 'KP_IN' ? chalk.green(entry.type) : chalk.red(entry.type);
            return `${chalk.bold(entryTitle(entry))}\n${typeLabel} · ${syncLabel} · ${entry.source}\n${entry.description}${entry.invoiceNumber ? `\nSzámlaszám: ${entry.invoiceNumber}` : ''}`;
          })
          .join('\n\n'),
        { title: 'Legutóbbi KP tételek', padding: 1, borderColor: 'yellow' },
      ),
    );
  } catch (error) {
    spinner.fail('Nem sikerült lekérni a KP tételeket.');
    console.error(chalk.red(error));
  }
}

async function createCashEntryFlow(): Promise<void> {
  const { date, type, amount, description, invoiceNumber, source, syncedSheets } = await inquirer.prompt([
    {
      type: 'input',
      name: 'date',
      message: 'Dátum (YYYY-MM-DD):',
      default: new Date().toISOString().slice(0, 10),
    },
    {
      type: 'list',
      name: 'type',
      message: 'Típus:',
      choices: [
        { name: 'KP_IN - Bevétel', value: 'KP_IN' },
        { name: 'KP_OUT - Kiadás', value: 'KP_OUT' },
      ],
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Összeg:',
      validate: (value: string) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? true : 'Adj meg egy pozitív számot.';
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Leírás:',
      validate: (value: string) => value.trim().length > 0 ? true : 'A leírás kötelező.',
    },
    {
      type: 'input',
      name: 'invoiceNumber',
      message: 'Számlaszám (opcionális):',
    },
    {
      type: 'list',
      name: 'source',
      message: 'Forrás:',
      choices: [
        { name: 'manual', value: 'manual' },
        { name: 'email', value: 'email' },
        { name: 'import', value: 'import' },
      ],
    },
    {
      type: 'confirm',
      name: 'syncedSheets',
      message: 'Sheetsben már szinkronizálva?',
      default: false,
    },
  ]);

  const spinner = ora('KP tétel mentése...').start();

  try {
    await requestJson<CashEntryResponse>(
      '/api/v1/bookkeeping/cash-entries',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          type,
          amount: Number(amount),
          description,
          ...(invoiceNumber?.trim() ? { invoice_number: invoiceNumber.trim() } : {}),
          source,
          synced_sheets: syncedSheets,
        }),
      },
      10000,
    );

    spinner.succeed('KP tétel mentve.');
  } catch (error) {
    spinner.fail('Nem sikerült menteni a KP tételt.');
    console.error(chalk.red(error));
  }
}

async function toggleCashEntrySyncFlow(): Promise<void> {
  const response = await requestJson<CashEntryListResponse>('/api/v1/bookkeeping/cash-entries?limit=20&offset=0');
  if (response.entries.length === 0) {
    console.log(chalk.gray('Nincs módosítható KP tétel.'));
    return;
  }

  const { entryId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'entryId',
      message: 'Melyik tétel szinkron státuszát szeretnéd váltani?',
      choices: response.entries.map((entry) => ({
        name: `${entryTitle(entry)} · ${entry.description}`,
        value: entry.id,
      })),
    },
  ]);

  const selected = response.entries.find((entry) => entry.id === entryId);
  if (!selected) {
    console.log(chalk.red('A kiválasztott tétel nem található.'));
    return;
  }

  const spinner = ora('Szinkron állapot frissítése...').start();

  try {
    await requestJson<CashEntryResponse>(
      `/api/v1/bookkeeping/cash-entries/${encodeURIComponent(String(selected.id))}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synced_sheets: !selected.syncedSheets }),
      },
      10000,
    );

    spinner.succeed('Szinkron állapot frissítve.');
  } catch (error) {
    spinner.fail('Nem sikerült frissíteni a szinkron állapotot.');
    console.error(chalk.red(error));
  }
}

async function cashMenu(): Promise<void> {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'KP pénztár művelet:',
        choices: [
          { name: '📋 Utolsó tételek listázása', value: 'list' },
          { name: '➕ Új KP tétel felvitele', value: 'create' },
          { name: '🧾 KP összegzés', value: 'summary' },
          { name: '🔁 Szinkron státusz váltása', value: 'toggle' },
          { name: '↩️ Vissza', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') {
      return;
    }

    if (action === 'list') {
      await listCashEntries();
      continue;
    }

    if (action === 'create') {
      await createCashEntryFlow();
      continue;
    }

    if (action === 'summary') {
      await showCashSummary();
      continue;
    }

    if (action === 'toggle') {
      await toggleCashEntrySyncFlow();
    }
  }
}

/**
 * Könyvelés Automatizálás CLI Felület
 * Lehetővé teszi a banki bizonylatok, NAV számlák és KP tételek kezelését.
 */
export async function bookkeepingCommand() {
  console.log(
    boxen(chalk.blue.bold('📊 Brunella Könyvelés Automatizálás'), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'blue',
    }),
  );

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Válassz műveletet:',
        choices: [
          { name: '📥 Adatok Ingesztálása (Bank + NAV)', value: 'ingest' },
          { name: '⚖️ Automatikus Párosítás Indítása', value: 'match' },
          { name: '💵 KP pénztár kezelése', value: 'cash' },
          { name: '📋 Függő Tételek Megtekintése', value: 'status' },
          { name: '❌ Kilépés', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') {
      return;
    }

    if (action === 'ingest') {
      await ingestSampleData();
      continue;
    }

    if (action === 'match') {
      await runMatching();
      continue;
    }

    if (action === 'cash') {
      await cashMenu();
      continue;
    }

    if (action === 'status') {
      showStatus();
    }
  }
}
