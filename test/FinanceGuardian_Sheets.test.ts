import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceGuardian } from '../src/agents/FinanceGuardian.js';
import * as unifiedWorkspace from '../src/tools/unifiedWorkspace.js';

// Mock UnifiedWorkspaceClient
vi.mock('../src/tools/unifiedWorkspace.js', () => {
  return {
    getWorkspaceClient: vi.fn().mockResolvedValue({
      performSheetOperation: vi.fn().mockResolvedValue({ status: 'success' })
    })
  };
});

describe('FinanceGuardian - Google Sheets Export', () => {
  let agent: FinanceGuardian;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new FinanceGuardian();
  });

  it('should successfully export invoice data to Google Sheets', async () => {
    const invoiceData = { invoice_number: 'INV-002', vendor_name: 'Sheet Vendor', amount: 2000 };
    const spreadsheetId = 'test-sheet-id';

    const result = await agent.executeTask({
      task: "Export invoice to Google Sheets",
      invoiceData,
      spreadsheetId
    });

    const workspaceMock = await unifiedWorkspace.getWorkspaceClient();
    expect(workspaceMock.performSheetOperation).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'append',
      spreadsheetId: 'test-sheet-id',
      values: expect.arrayContaining([expect.arrayContaining(['INV-002', 'Sheet Vendor', 2000])])
    }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('sikeresen exportálva');
  });

  it('should fail if spreadsheetId is missing', async () => {
    const invoiceData = { invoice_number: 'INV-002' };
    
    // Ensure env var is not set for this test
    const oldId = process.env.INVOICE_SPREADSHEET_ID;
    delete process.env.INVOICE_SPREADSHEET_ID;

    const result = await agent.executeTask({
      task: "Export invoice to Google Sheets",
      invoiceData
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Hiányzó Google Sheets ID');
    
    // Restore
    process.env.INVOICE_SPREADSHEET_ID = oldId;
  });
});
