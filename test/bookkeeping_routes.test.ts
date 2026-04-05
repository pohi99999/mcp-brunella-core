import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { initDB, saveTransaction, createCashEntry } from '../src/data/bookkeeping_db.js';
import { createBookkeepingRoutes } from '../src/server/routes/bookkeeping.js';
import type { BookkeepingTransaction } from '../src/types/bookkeeping.d.js';

const { delegateMock } = vi.hoisted(() => ({
    delegateMock: vi.fn(),
}));

const { readinessMock, readinessReport } = vi.hoisted(() => ({
    readinessMock: vi.fn(),
    readinessReport: {
        status: 'blocked',
        timestamp: '2026-04-05T00:00:00.000Z',
        summary: {
            total: 4,
            ready: 2,
            blocked: 2,
        },
        missing: ['szamlazz.hu API kulcs', 'Gmail IMAP hozzáférés'],
        checks: [
            {
                id: 'szamlazz-hu',
                label: 'szamlazz.hu API kulcs',
                status: 'ready',
                required: true,
                details: 'szamlazz.hu API kulcs konfigurálva.',
            },
            {
                id: 'nav-online-szamla',
                label: 'NAV Online Számla kredencial',
                status: 'ready',
                required: true,
                details: 'NAV Online Számla kredencial konfigurálva.',
            },
            {
                id: 'imap-access',
                label: 'Gmail IMAP hozzáférés',
                status: 'missing',
                required: true,
                details: 'Hiányzik: GMAIL_IMAP_USER, GMAIL_APP_PASSWORD',
            },
            {
                id: 'bank-imports',
                label: 'Bank import mappa',
                status: 'missing',
                required: true,
                details: 'Hozd létre a mappát vagy ellenőrizd az útvonalat: data/bank-imports',
            },
        ],
    },
}));

vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('../src/agents/AgentManager.js', () => ({
    agentManager: {
        delegate: delegateMock,
    },
}));

vi.mock('../src/utils/bookkeepingReadiness.js', () => ({
    buildBookkeepingReadinessReport: readinessMock,
}));

describe('Bookkeeping routes', () => {
    let tempDir: string;
    let statusPath: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bookkeeping-routes-'));
        statusPath = path.join(tempDir, 'status.json');
        process.env.BOOKKEEPING_STATUS_PATH = statusPath;
        initDB(':memory:');
        seedDatabase();
        delegateMock.mockReset();
        readinessMock.mockReset();
        readinessMock.mockReturnValue(readinessReport);
        delegateMock.mockResolvedValue({
            status: 'delegated',
        });
    });

    afterEach(async () => {
        delete process.env.BOOKKEEPING_STATUS_PATH;
        await fs.rm(tempDir, { recursive: true, force: true });
        vi.clearAllMocks();
    });

    function createApp() {
        const app = express();
        app.use(express.json());
        app.use('/api/v1/bookkeeping', createBookkeepingRoutes());
        return app;
    }

    function seedDatabase() {
        const transactions: BookkeepingTransaction[] = [
            {
                id: 'bank_1',
                source: 'BankAgent',
                data: {
                    reference: 'BANK-001',
                    amount: 150000,
                    partner: 'Partner A',
                    date: '2026-03-29',
                },
                status: 'PENDING_MATCH',
            },
            {
                id: 'nav_1',
                source: 'NAV',
                data: {
                    invoiceNumber: 'INV-100',
                    amount: 87000,
                },
                status: 'PENDING_MATCH',
            },
            {
                id: 'bank_2',
                source: 'BankAgent',
                data: {
                    reference: 'BANK-002',
                    amount: 42000,
                    partner: 'Partner B',
                    date: '2026-03-28',
                },
                status: 'COMPLETED',
            },
        ];

        for (const transaction of transactions) {
            saveTransaction(transaction);
        }

        createCashEntry({
            date: '2026-03-29',
            type: 'KP_IN',
            amount: 15000,
            description: 'Keszpenzes bevetelek',
            source: 'manual',
            syncedSheets: false,
        });

        createCashEntry({
            date: '2026-03-30',
            type: 'KP_OUT',
            amount: 2500,
            description: 'Irodaszer beszerzes',
            invoiceNumber: 'INV-200',
            source: 'email',
            syncedSheets: true,
        });
    }

    it('returns bookkeeping status and persists snapshots', async () => {
        const app = createApp();

        const getResponse = await request(app).get('/api/v1/bookkeeping/status');
        expect(getResponse.status).toBe(200);
        expect(getResponse.body.pendingTransactions).toBe(2);
        expect(getResponse.body.summary).toMatchObject({
            total: 3,
            pending: 2,
            completed: 1,
            manualReview: 0,
            unmatched: 0,
            partiallyMatched: 0,
            error: 0,
        });
        expect(getResponse.body.summary.bySource).toMatchObject({
            BankAgent: 2,
            NAV: 1,
        });
        expect(getResponse.body.snapshot).toBeNull();
        expect(getResponse.body.readiness).toEqual(readinessReport);

        const patchPayload = {
            summary: {
                total: 3,
                pending: 2,
                completed: 1,
                manualReview: 0,
                unmatched: 0,
                partiallyMatched: 0,
                error: 0,
                byStatus: {
                    PENDING_MATCH: 2,
                    COMPLETED: 1,
                },
                bySource: {
                    BankAgent: 2,
                    NAV: 1,
                },
            },
            exceptions: [{ id: 'exc-1', kind: 'manual-review' }],
            timestamp: '2026-03-29T12:00:00.000Z',
            source: 'dashboard',
        };

        const patchResponse = await request(app)
            .patch('/api/v1/bookkeeping/status')
            .send(patchPayload);

        expect(patchResponse.status).toBe(200);
        expect(patchResponse.body.snapshot).toMatchObject(patchPayload);

        const storedStatus = JSON.parse(await fs.readFile(statusPath, 'utf8')) as Record<string, unknown>;
        expect(storedStatus).toMatchObject(patchPayload);
        expect(typeof storedStatus.updatedAt).toBe('string');
    });

    it('returns the readiness report through the dedicated endpoint', async () => {
        const app = createApp();

        const response = await request(app).get('/api/v1/bookkeeping/readiness');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            success: true,
            ...readinessReport,
        });
    });

    it('lists and reads transactions through the dedicated transaction endpoints', async () => {
        const app = createApp();

        const listResponse = await request(app)
            .get('/api/v1/bookkeeping/transactions')
            .query({ status: 'PENDING_MATCH', limit: 1, offset: 0 });

        expect(listResponse.status).toBe(200);
        expect(listResponse.body.total).toBe(2);
        expect(listResponse.body.entries).toHaveLength(1);
        expect(listResponse.body.entries[0]).toMatchObject({
            id: 'bank_1',
            source: 'BankAgent',
            status: 'PENDING_MATCH',
        });

        const singleResponse = await request(app).get('/api/v1/bookkeeping/transactions/nav_1');

        expect(singleResponse.status).toBe(200);
        expect(singleResponse.body.entry).toMatchObject({
            id: 'nav_1',
            source: 'NAV',
            status: 'PENDING_MATCH',
        });
    });

    it('lists, creates and updates cash entries', async () => {
        const app = createApp();

        const listResponse = await request(app)
            .get('/api/v1/bookkeeping/cash-entries')
            .query({ type: 'KP_IN', limit: 1, offset: 0 });

        expect(listResponse.status).toBe(200);
        expect(listResponse.body.total).toBe(1);
        expect(listResponse.body.entries).toHaveLength(1);
        expect(listResponse.body.entries[0]).toMatchObject({
            id: 1,
            type: 'KP_IN',
            syncedSheets: false,
        });

        const createResponse = await request(app)
            .post('/api/v1/bookkeeping/cash-entries')
            .send({
                date: '2026-03-31',
                type: 'KP_IN',
                amount: 9900,
                description: 'Napi bevetelek',
                source: 'manual',
                syncedSheets: 'true',
            });

        expect(createResponse.status).toBe(201);
        expect(createResponse.body.entry).toMatchObject({
            id: 3,
            type: 'KP_IN',
            amount: 9900,
            description: 'Napi bevetelek',
            syncedSheets: true,
        });

        const readResponse = await request(app).get('/api/v1/bookkeeping/cash-entries/3');
        expect(readResponse.status).toBe(200);
        expect(readResponse.body.entry).toMatchObject({
            id: 3,
            type: 'KP_IN',
            amount: 9900,
            syncedSheets: true,
        });

        const patchResponse = await request(app)
            .patch('/api/v1/bookkeeping/cash-entries/3')
            .send({ syncedSheets: false, description: 'Frissitett bevetelek' });

        expect(patchResponse.status).toBe(200);
        expect(patchResponse.body.entry).toMatchObject({
            id: 3,
            syncedSheets: false,
            description: 'Frissitett bevetelek',
        });
    });

    it('returns cash summaries from the dedicated summary endpoint', async () => {
        const app = createApp();

        const response = await request(app).get('/api/v1/bookkeeping/cash-summary');

        expect(response.status).toBe(200);
        expect(response.body.summary).toMatchObject({
            total: 2,
            income: 15000,
            expense: 2500,
            balance: 12500,
            syncedSheets: 1,
            pendingSheets: 1,
        });
        expect(response.body.summary.byType).toMatchObject({
            KP_IN: 1,
            KP_OUT: 1,
        });
    });

    it('updates transaction records and delegates reconciliation', async () => {
        const app = createApp();

        const patchResponse = await request(app)
            .patch('/api/v1/bookkeeping/transactions/bank_1')
            .send({
                status: 'COMPLETED',
                matchedInvoice: 'INV-123',
            });

        expect(patchResponse.status).toBe(200);
        expect(patchResponse.body.transaction).toMatchObject({
            id: 'bank_1',
            status: 'COMPLETED',
            matchedInvoice: 'INV-123',
        });

        const reconcileResponse = await request(app)
            .post('/api/v1/bookkeeping/reconcile')
            .send({
                transactionIds: ['bank_1', 'nav_1'],
            });

        expect(reconcileResponse.status).toBe(200);
        expect(reconcileResponse.body).toMatchObject({
            success: true,
            result: {
                status: 'delegated',
            },
        });
        expect(delegateMock).toHaveBeenCalledWith(
            'MatchingAgent',
            'Match all PENDING bank transactions',
            undefined,
        );
    });
});
