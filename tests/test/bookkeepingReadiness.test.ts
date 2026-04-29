import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { buildBookkeepingReadinessReport } from '@packages/utils/bookkeepingReadiness.js';

async function createTempWorkspace(): Promise<string> {
    return mkdtemp(path.join(os.tmpdir(), 'bookkeeping-readiness-'));
}

describe('bookkeeping readiness report', () => {
    it('returns ready when all required inputs are present', async () => {
        const cwd = await createTempWorkspace();

        try {
            await mkdir(path.join(cwd, 'data', 'bank-imports'), { recursive: true });

            const report = buildBookkeepingReadinessReport({
                cwd,
                env: {
                    SZAMLAZZ_HU_API_KEY: 'super-secret-value',
                    SZAMLAZZ_HU_BANK_ACCOUNT: 'HU123456789',
                    SZAMLAZZ_HU_TAX_NUMBER: '12345678-1-42',
                    NAV_USERNAME: 'nav-user',
                    NAV_PASSWORD: 'nav-password',
                    NAV_SIGNING_KEY: 'nav-signing-key',
                    NAV_EXCHANGE_KEY: 'nav-exchange-key',
                    GMAIL_IMAP_USER: 'imap-user@example.com',
                    GMAIL_APP_PASSWORD: 'app-password',
                },
            });

            expect(report.status).toBe('ready');
            expect(report.summary).toEqual({
                total: 4,
                ready: 4,
                blocked: 0,
            });
            expect(report.missing).toEqual([]);
            expect(report.checks.every((check) => check.status === 'ready')).toBe(true);
            expect(JSON.stringify(report)).not.toContain('super-secret-value');
        } finally {
            await rm(cwd, { recursive: true, force: true });
        }
    });

    it('accepts workspace oauth files when app password is absent', async () => {
        const cwd = await createTempWorkspace();

        try {
            const credentialsDir = path.join(cwd, 'credentials');
            await mkdir(credentialsDir, { recursive: true });
            await mkdir(path.join(cwd, 'data', 'bank-imports'), { recursive: true });

            const credentialsFile = path.join(credentialsDir, 'workspace.json');
            const tokenFile = path.join(credentialsDir, 'workspace-token.json');
            await writeFile(credentialsFile, '{}');
            await writeFile(tokenFile, '{}');

            const report = buildBookkeepingReadinessReport({
                cwd,
                env: {
                    SZAMLAZZ_HU_API_KEY: 'szamla-key',
                    SZAMLAZZ_HU_BANK_ACCOUNT: 'HU123456789',
                    SZAMLAZZ_HU_TAX_NUMBER: '12345678-1-42',
                    NAV_USERNAME: 'nav-user',
                    NAV_PASSWORD: 'nav-password',
                    NAV_SIGNING_KEY: 'nav-signing-key',
                    NAV_EXCHANGE_KEY: 'nav-exchange-key',
                    GMAIL_IMAP_USER: 'imap-user@example.com',
                    GOOGLE_WORKSPACE_CREDENTIALS_FILE: path.relative(cwd, credentialsFile),
                    GOOGLE_WORKSPACE_TOKEN_FILE: path.relative(cwd, tokenFile),
                },
            });

            expect(report.status).toBe('ready');
            expect(report.summary.ready).toBe(4);
            expect(report.checks.find((check) => check.id === 'imap-access')?.status).toBe('ready');
        } finally {
            await rm(cwd, { recursive: true, force: true });
        }
    });

    it('reports missing prerequisites when credentials are absent', async () => {
        const cwd = await createTempWorkspace();

        try {
            const report = buildBookkeepingReadinessReport({
                cwd,
                env: {},
            });

            expect(report.status).toBe('blocked');
            expect(report.summary).toEqual({
                total: 4,
                ready: 0,
                blocked: 4,
            });
            expect(report.missing).toEqual([
                'szamlazz.hu API kulcs',
                'NAV Online Számla kredencial',
                'Gmail IMAP hozzáférés',
                'Bank import mappa',
            ]);
            expect(report.checks.map((check) => check.status)).toEqual([
                'missing',
                'missing',
                'missing',
                'missing',
            ]);
        } finally {
            await rm(cwd, { recursive: true, force: true });
        }
    });
});
