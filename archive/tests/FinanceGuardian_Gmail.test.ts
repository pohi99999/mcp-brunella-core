import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceGuardian } from '../src/agents/FinanceGuardian.js';
import * as unifiedWorkspace from '../src/tools/unifiedWorkspace.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock UnifiedWorkspaceClient
vi.mock('../src/tools/unifiedWorkspace.js', () => {
  return {
    getWorkspaceClient: vi.fn().mockResolvedValue({
      searchEmails: vi.fn().mockResolvedValue([{ id: 'msg123' }]),
      getEmailAttachments: vi.fn().mockResolvedValue([
        { filename: 'invoice.pdf', data: Buffer.from('mock pdf content') }
      ])
    })
  };
});

// Mock fs/promises
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined)
  };
});

describe('FinanceGuardian - Gmail PDF Download', () => {
  let agent: FinanceGuardian;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new FinanceGuardian();
  });

  it('should successfully search and download PDF invoices from Gmail', async () => {
    const task = "Download PDF invoice from Gmail";
    const context = { query: 'from:billing@company.com' };
    
    const result = await agent.executeTask({ task, ...context });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Sikeresen letöltöttem');
    expect(result.data).toBeDefined();
    
    // Verify directory creation
    expect(fs.mkdir).toHaveBeenCalled();
    
    // Verify file write
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('msg123_invoice.pdf'),
      expect.any(Buffer)
    );
  });

  it('should handle no results from Gmail', async () => {
    const workspaceMock = await unifiedWorkspace.getWorkspaceClient();
    vi.mocked(workspaceMock.searchEmails).mockResolvedValueOnce([]);

    const task = "Download PDF invoice from Gmail";
    const result = await agent.executeTask({ task });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Nem találtam újabb PDF számlát');
    expect(result.data).toEqual({ downloadedFiles: [] });
  });
});
