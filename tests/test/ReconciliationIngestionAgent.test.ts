import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentContext } from '@packages/agents/BaseAgent.js';

vi.mock('@packages/agents/BaseAgent.js', () => ({
  BaseAgent: class {},
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
}));

import { logInfo } from '@packages/utils/logger.js';
import { ReconciliationIngestionAgent } from '@packages/agents/ReconciliationIngestionAgent.js';

describe('ReconciliationIngestionAgent', () => {
  const agent = new ReconciliationIngestionAgent();
  const logInfoMock = vi.mocked(logInfo);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a failure when no data is provided', async () => {
    const context: AgentContext = { task: 'ingest financial data' };

    const result = await agent.executeTask(context);

    expect(result.success).toBe(false);
    expect(result.message).toBe('No data provided for ingestion');
  });

  it('detects NAV XML and normalizes invoice entries', async () => {
    const xml = '<root><invoiceData><invoiceNumber>INV-001</invoiceNumber></invoiceData><invoiceNumber>INV-002</invoiceNumber></root>';
    const context: AgentContext = {
      task: 'ingest financial data',
      payload: { data: xml, format: 'auto' },
    };

    const result = await agent.executeTask(context);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Financial data ingested: 2 entries processed.');
    expect(result.data).toMatchObject({
      format_detected: 'auto',
      entries_count: 2,
      entries: [
        {
          id: 'INV-001',
          type: 'invoice',
          source: 'NAV',
          date: expect.any(String),
          raw: xml,
        },
        {
          id: 'INV-002',
          type: 'invoice',
          source: 'NAV',
          date: expect.any(String),
          raw: xml,
        },
      ],
    });
    expect(logInfoMock).toHaveBeenCalledWith('ReconciliationIngestionAgent', 'Detected NAV XML format');
  });

  it('detects bank CSV and normalizes transaction rows', async () => {
    const csv = '2026-04-06;1250.50;Acme Corp;REF-001\n2026-04-07;200;Beta Ltd;REF-002\n';
    const context: AgentContext = {
      task: 'ingest financial data',
      payload: { data: csv, format: 'auto' },
    };

    const result = await agent.executeTask(context);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Financial data ingested: 2 entries processed.');
    expect(result.data).toMatchObject({
      format_detected: 'auto',
      entries_count: 2,
      entries: [
        {
          id: expect.stringMatching(/^bank-\d+-0$/),
          type: 'transaction',
          amount: 1250.5,
          partner: 'Acme Corp',
          reference: 'REF-001',
          date: '2026-04-06',
        },
        {
          id: expect.stringMatching(/^bank-\d+-1$/),
          type: 'transaction',
          amount: 200,
          partner: 'Beta Ltd',
          reference: 'REF-002',
          date: '2026-04-07',
        },
      ],
    });
    expect(logInfoMock).toHaveBeenCalledWith('ReconciliationIngestionAgent', 'Detected Bank CSV format');
  });

  it('rejects unsupported formats that do not match NAV or bank CSV', async () => {
    const context: AgentContext = {
      task: 'ingest financial data',
      payload: { data: 'plain text payload', format: 'auto' },
    };

    const result = await agent.executeTask(context);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unsupported or undetectable format: auto');
    expect(logInfoMock).not.toHaveBeenCalledWith('ReconciliationIngestionAgent', 'Detected NAV XML format');
    expect(logInfoMock).not.toHaveBeenCalledWith('ReconciliationIngestionAgent', 'Detected Bank CSV format');
  });

  it('treats malformed non-string payload data as missing input', async () => {
    const context: AgentContext = {
      task: 'ingest financial data',
      payload: { data: 42, format: 'auto' },
    };

    const result = await agent.executeTask(context);

    expect(result.success).toBe(false);
    expect(result.message).toBe('No data provided for ingestion');
    expect(logInfoMock).not.toHaveBeenCalledWith('ReconciliationIngestionAgent', 'Detected NAV XML format');
    expect(logInfoMock).not.toHaveBeenCalledWith('ReconciliationIngestionAgent', 'Detected Bank CSV format');
  });
});
