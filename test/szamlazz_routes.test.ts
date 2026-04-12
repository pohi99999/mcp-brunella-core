import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSzamlazzRoutes } from '../src/server/routes/szamlazz.js';

const { sendSzamlazzInvoiceMock } = vi.hoisted(() => ({
    sendSzamlazzInvoiceMock: vi.fn(),
}));

vi.mock('../src/server/szamlazzBridge.js', () => ({
    sendSzamlazzInvoice: sendSzamlazzInvoiceMock,
}));

vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
}));

describe('Szamlázz routes', () => {
    let tempDir: string;
    let statusPath: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'szamlazz-routes-'));
        statusPath = path.join(tempDir, 'status.json');
        process.env.BOOKKEEPING_STATUS_PATH = statusPath;
        sendSzamlazzInvoiceMock.mockReset();
        await fs.writeFile(
            statusPath,
            JSON.stringify({
                summary: {
                    total: 4,
                    completed: 2,
                },
                exceptions: [{ kind: 'existing', message: 'keep me' }],
                timestamp: '2026-04-05T00:00:00.000Z',
                updatedAt: '2026-04-05T00:00:00.000Z',
                source: 'dashboard',
            }),
            'utf8',
        );
    });

    afterEach(async () => {
        delete process.env.BOOKKEEPING_STATUS_PATH;
        await fs.rm(tempDir, { recursive: true, force: true });
        vi.clearAllMocks();
    });

    function createApp() {
        const app = express();
        app.use(express.json());
        app.use('/api/v1/szamlazz', createSzamlazzRoutes());
        app.use('/api/v1/invoice', createSzamlazzRoutes());
        return app;
    }

    it('sends invoices and writes a compact success snapshot back to bookkeeping', async () => {
        sendSzamlazzInvoiceMock.mockResolvedValue({
            success: true,
            statusCode: 200,
            contentType: 'text/xml; charset=utf-8',
            documentType: 'text',
            responseText: '<response>ok</response>',
        });

        const app = createApp();
        const response = await request(app)
            .post('/api/v1/szamlazz/create')
            .send({
                xml: '<xml>invoice</xml>',
                requestId: 'req-123',
                source: 'n8n',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result).toMatchObject({
            success: true,
            statusCode: 200,
            documentType: 'text',
        });
        expect(response.body.snapshot).toMatchObject({
            source: 'api',
            summary: {
                total: 4,
                completed: 2,
                lastInvoiceSend: {
                    success: true,
                    statusCode: 200,
                    contentType: 'text/xml; charset=utf-8',
                    documentType: 'text',
                    requestId: 'req-123',
                    source: 'n8n',
                    xmlLength: 18,
                },
            },
            exceptions: [{ kind: 'existing', message: 'keep me' }],
        });
        expect(sendSzamlazzInvoiceMock).toHaveBeenCalledWith('<xml>invoice</xml>');

        const stored = JSON.parse(await fs.readFile(statusPath, 'utf8')) as Record<string, unknown>;
        expect(stored).toMatchObject({
            source: 'api',
            summary: {
                total: 4,
                completed: 2,
                lastInvoiceSend: {
                    success: true,
                    statusCode: 200,
                    requestId: 'req-123',
                    source: 'n8n',
                },
            },
        });
    });

    it('exposes the invoice create alias for the same Számlázz send flow', async () => {
        sendSzamlazzInvoiceMock.mockResolvedValue({
            success: true,
            statusCode: 200,
            contentType: 'text/xml; charset=utf-8',
            documentType: 'text',
            responseText: '<response>ok</response>',
        });

        const app = createApp();
        const response = await request(app)
            .post('/api/v1/invoice/create')
            .send({
                invoiceXml: '<xml>invoice-alias</xml>',
                requestId: 'alias-req-1',
                source: 'wf-6',
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.result).toMatchObject({
            success: true,
            statusCode: 200,
            documentType: 'text',
        });
        expect(response.body.snapshot.summary.lastInvoiceSend).toMatchObject({
            success: true,
            requestId: 'alias-req-1',
            source: 'wf-6',
            xmlLength: '<xml>invoice-alias</xml>'.length,
        });
        expect(sendSzamlazzInvoiceMock).toHaveBeenCalledWith('<xml>invoice-alias</xml>');
    });

    it('records failures through the invoice alias and preserves the existing bookkeeping snapshot history', async () => {
        sendSzamlazzInvoiceMock.mockResolvedValue({
            success: false,
            statusCode: 400,
            contentType: 'text/plain; charset=utf-8',
            documentType: 'text',
            error: 'invalid XML',
        });

        const app = createApp();
        const response = await request(app)
            .post('/api/v1/invoice/send')
            .send({
                xmlPayload: '<xml>broken</xml>',
                requestId: 'req-456',
            });

        expect(response.status).toBe(502);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('invalid XML');
        expect(response.body.snapshot.summary.lastInvoiceSend).toMatchObject({
            success: false,
            statusCode: 400,
            contentType: 'text/plain; charset=utf-8',
            requestId: 'req-456',
            source: 'api',
        });
        expect(response.body.snapshot.summary.lastInvoiceSendError).toBe('invalid XML');
        expect(response.body.snapshot.exceptions).toHaveLength(2);
        expect(sendSzamlazzInvoiceMock).toHaveBeenCalledWith('<xml>broken</xml>');

        const stored = JSON.parse(await fs.readFile(statusPath, 'utf8')) as Record<string, unknown>;
        expect(stored).toMatchObject({
            summary: {
                lastInvoiceSendError: 'invalid XML',
            },
        });
    });

    it('returns the current bookkeeping snapshot through the status endpoint', async () => {
        const app = createApp();

        const response = await request(app).get('/api/v1/szamlazz/status');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.snapshot).toMatchObject({
            summary: {
                total: 4,
                completed: 2,
            },
            exceptions: [{ kind: 'existing', message: 'keep me' }],
            source: 'dashboard',
        });
    });
});
