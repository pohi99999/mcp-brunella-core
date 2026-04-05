import { existsSync, statSync } from 'fs';
import path from 'path';
import type {
  BookkeepingReadinessCheck,
  BookkeepingReadinessReport,
} from '../types/bookkeeping.d.js';

export interface BookkeepingReadinessOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
}

function isConfiguredString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }

  if (normalized.startsWith('<') && normalized.endsWith('>')) {
    return false;
  }

  return !['todo', 'tbd', 'example', 'changeme', 'replace-me'].includes(normalized.toLowerCase());
}

function isExistingDirectory(targetPath: string): boolean {
  try {
    return existsSync(targetPath) && statSync(targetPath).isDirectory();
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = String((error as { code?: unknown }).code);
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return false;
      }
    }

    throw error;
  }
}

function createCheck(
  id: string,
  label: string,
  ready: boolean,
  readyDetails: string,
  missingDetails: string,
): BookkeepingReadinessCheck {
  return {
    id,
    label,
    required: true,
    status: ready ? 'ready' : 'missing',
    details: ready ? readyDetails : missingDetails,
  };
}

function buildEnvGroupCheck(
  id: string,
  label: string,
  keys: string[],
  env: Record<string, string | undefined>,
): BookkeepingReadinessCheck {
  const missing = keys.filter((key) => !isConfiguredString(env[key]));
  const ready = missing.length === 0;

  return createCheck(
    id,
    label,
    ready,
    `${label} konfigurálva.`,
    `Hiányzik: ${missing.join(', ')}`,
  );
}

function buildImapCheck(
  env: Record<string, string | undefined>,
  cwd: string,
): BookkeepingReadinessCheck {
  const imapUserReady = isConfiguredString(env.GMAIL_IMAP_USER);
  const appPasswordReady = isConfiguredString(env.GMAIL_APP_PASSWORD);

  const workspaceCredentialsPath = isConfiguredString(env.GOOGLE_WORKSPACE_CREDENTIALS_FILE)
    ? path.resolve(cwd, env.GOOGLE_WORKSPACE_CREDENTIALS_FILE.trim())
    : null;
  const workspaceTokenPath = isConfiguredString(env.GOOGLE_WORKSPACE_TOKEN_FILE)
    ? path.resolve(cwd, env.GOOGLE_WORKSPACE_TOKEN_FILE.trim())
    : null;

  const workspaceOAuthReady =
    imapUserReady &&
    workspaceCredentialsPath !== null &&
    workspaceTokenPath !== null &&
    isExistingDirectory(path.dirname(workspaceCredentialsPath)) &&
    existsSync(workspaceCredentialsPath) &&
    existsSync(workspaceTokenPath);

  if (imapUserReady && appPasswordReady) {
    return createCheck(
      'imap-access',
      'Gmail IMAP hozzáférés',
      true,
      'GMAIL_IMAP_USER + GMAIL_APP_PASSWORD konfigurálva.',
      'GMAIL_IMAP_USER + GMAIL_APP_PASSWORD vagy Workspace OAuth fájlok hiányoznak.',
    );
  }

  if (workspaceOAuthReady) {
    return createCheck(
      'imap-access',
      'Gmail IMAP hozzáférés',
      true,
      `GMAIL_IMAP_USER + ${workspaceCredentialsPath} + ${workspaceTokenPath} konfigurálva.`,
      'GMAIL_IMAP_USER + GMAIL_APP_PASSWORD vagy Workspace OAuth fájlok hiányoznak.',
    );
  }

  const missing = ['GMAIL_IMAP_USER'];
  if (!appPasswordReady) {
    missing.push('GMAIL_APP_PASSWORD');
  }
  if (!isConfiguredString(env.GOOGLE_WORKSPACE_CREDENTIALS_FILE)) {
    missing.push('GOOGLE_WORKSPACE_CREDENTIALS_FILE');
  }
  if (!isConfiguredString(env.GOOGLE_WORKSPACE_TOKEN_FILE)) {
    missing.push('GOOGLE_WORKSPACE_TOKEN_FILE');
  }

  return createCheck(
    'imap-access',
    'Gmail IMAP hozzáférés',
    false,
    'GMAIL_IMAP_USER + GMAIL_APP_PASSWORD konfigurálva.',
    `Hiányzik: ${Array.from(new Set(missing)).join(', ')}`,
  );
}

function buildBankImportCheck(cwd: string): BookkeepingReadinessCheck {
  const bankImportDir = path.resolve(cwd, 'data', 'bank-imports');
  const ready = isExistingDirectory(bankImportDir);

  return createCheck(
    'bank-imports',
    'Bank import mappa',
    ready,
    `Bank import mappa elérhető: ${bankImportDir}`,
    `Hozd létre a mappát vagy ellenőrizd az útvonalat: ${bankImportDir}`,
  );
}

export function buildBookkeepingReadinessReport(
  options: BookkeepingReadinessOptions = {},
): BookkeepingReadinessReport {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  const checks = [
    buildEnvGroupCheck(
      'szamlazz-hu',
      'szamlazz.hu API kulcs',
      ['SZAMLAZZ_HU_API_KEY', 'SZAMLAZZ_HU_BANK_ACCOUNT', 'SZAMLAZZ_HU_TAX_NUMBER'],
      env,
    ),
    buildEnvGroupCheck(
      'nav-online-szamla',
      'NAV Online Számla kredencial',
      ['NAV_USERNAME', 'NAV_PASSWORD', 'NAV_SIGNING_KEY', 'NAV_EXCHANGE_KEY'],
      env,
    ),
    buildImapCheck(env, cwd),
    buildBankImportCheck(cwd),
  ];

  const missing = checks.filter((check) => check.status !== 'ready').map((check) => check.label);
  const readyCount = checks.length - missing.length;

  return {
    status: missing.length === 0 ? 'ready' : 'blocked',
    timestamp: new Date().toISOString(),
    summary: {
      total: checks.length,
      ready: readyCount,
      blocked: missing.length,
    },
    missing,
    checks,
  };
}
