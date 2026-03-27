import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceAutomationAgent } from '../src/agents/InvoiceAutomationAgent.js';
import { getWorkspaceClient } from '../src/tools/unifiedWorkspace.js';
import { getBifrostGateway } from '../src/core/bifrost_gateway.js';

vi.mock('../src/tools/unifiedWorkspace.js');
vi.mock('../src/core/bifrost_gateway.js');
vi.mock('../src/utils/logger.js');

describe('InvoiceAutomationAgent', () => {
  let agent: InvoiceAutomationAgent;
  let mockWorkspace: any;
  let mockGateway: any;

  beforeEach(() => {
    process.env.INVOICE_SPREADSHEET_ID = 'test-sheet-id';
    agent = new InvoiceAutomationAgent();
    mockWorkspace = {
      searchEmails: vi.fn().mockResolvedValue([{ id: 'msg123' }]),
      getEmailAttachments: vi.fn().mockResolvedValue([{ filename: 'invoice.pdf', data: Buffer.from('fake-pdf') }]),
      findFolder: vi.fn().mockResolvedValue({ id: 'fold123' }),
      createFolder: vi.fn().mockResolvedValue({ id: 'fold456' }),
      uploadFileFromBuffer: vi.fn().mockResolvedValue({ webViewLink: 'http://drive.com/file' }),
      performSheetOperation: vi.fn().mockResolvedValue({ success: true }),
      modifyEmail: vi.fn().mockResolvedValue({ success: true }),
    };
    (getWorkspaceClient as any).mockResolvedValue(mockWorkspace);

    mockGateway = {
      generate: vi.fn().mockResolvedValue({
        success: true,
        content: JSON.stringify({
          vendorName: 'Test Vendor',
          invoiceNumber: 'INV-001',
          amount: 5000,
          currency: 'HUF',
          date: '2026-03-26'
        })
      }),
    };
    (getBifrostGateway as any).mockReturnValue(mockGateway);
  });

  it('should process invoices from gmail and save them to drive and sheets', async () => {
    const result = await agent.execute('process all invoices');

    expect(result.success).toBe(true);
    expect(mockWorkspace.searchEmails).toHaveBeenCalled();
    expect(mockWorkspace.getEmailAttachments).toHaveBeenCalledWith('msg123');
    expect(mockGateway.generate).toHaveBeenCalled();
    expect(mockWorkspace.uploadFileFromBuffer).toHaveBeenCalled();
    expect(mockWorkspace.performSheetOperation).toHaveBeenCalled();
  });

  it('should handle failure and label the email for manual check', async () => {
    mockGateway.generate.mockResolvedValue({
      success: false,
      error: 'Vision failed'
    });

    const result = await agent.execute('process');

    expect(result.success).toBe(true); // Workflow itself succeeds but logs failure per item
    expect(mockWorkspace.modifyEmail).toHaveBeenCalledWith('msg123', expect.objectContaining({
      addLabelIds: ['Brunella-Manual-Check']
    }));
  });
});
