/**
 * Unit Tests - UnifiedWorkspaceClient (Google Workspace Integration)
 * 
 * Test suite for Google Workspace API wrapper (Gmail, Sheets, Drive, Calendar).
 * Uses mocked Google API clients for testing without real credentials.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedWorkspaceClient, resetWorkspaceClient } from '../src/tools/unifiedWorkspace.js';
import * as fs from 'fs/promises';

// Mock Google Auth utility
vi.mock('../src/utils/googleAuth.js', () => ({
  getGoogleAuth: vi.fn().mockResolvedValue({
    credentials: {
      installed: {
        client_id: 'mock_client_id',
        client_secret: 'mock_client_secret',
        redirect_uris: ['http://localhost'],
      },
    },
    setCredentials: vi.fn(),
  }),
}));

// Mock Google APIs
vi.mock('googleapis', () => {
  class MockOAuth2 {
    setCredentials = vi.fn();
    generateAuthUrl = vi.fn(() => 'https://accounts.google.com/o/oauth2/auth?...');
    getToken = vi.fn(async () => ({
      tokens: {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expiry_date: Date.now() + 3600000,
      },
    }));
  }

  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      gmail: vi.fn(() => ({
        users: {
          drafts: {
            create: vi.fn(async () => ({
              data: { id: 'draft_123', message: {} },
            })),
          },
          messages: {
            list: vi.fn(async () => ({
              data: {
                messages: [
                  { id: 'msg_1', threadId: 'thread_1' },
                  { id: 'msg_2', threadId: 'thread_2' },
                ],
              },
            })),
            get: vi.fn(async () => ({
              data: {
                id: 'msg_1',
                payload: {
                  parts: [
                    {
                      filename: 'invoice.pdf',
                      body: { attachmentId: 'attach_1' },
                    },
                  ],
                },
              },
            })),
            attachments: {
              get: vi.fn(async () => ({
                data: {
                  data: Buffer.from('mock file content').toString('base64'),
                },
              })),
            },
          },
          getProfile: vi.fn(async () => ({
            data: { emailAddress: 'test@example.com' },
          })),
        },
      })),
      sheets: vi.fn(() => ({
        spreadsheets: {
          create: vi.fn(async () => ({
            data: {
              spreadsheetId: 'sheet_123',
              spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet_123',
            },
          })),
          values: {
            get: vi.fn(async () => ({
              data: {
                values: [
                  ['Name', 'Email', 'Status'],
                  ['Alice', 'alice@example.com', 'Active'],
                ],
              },
            })),
            append: vi.fn(async () => ({
              data: {
                updates: { updatedRows: 1 },
              },
            })),
            update: vi.fn(async () => ({
              data: {
                updatedRows: 1,
              },
            })),
          },
        },
      })),
      drive: vi.fn(() => ({
        files: {
          create: vi.fn(async () => ({
            data: {
              id: 'file_123',
              webViewLink: 'https://drive.google.com/file/d/file_123/view',
            },
          })),
          list: vi.fn(async () => ({
            data: {
              files: [
                { id: 'file_1', name: 'doc1.pdf', mimeType: 'application/pdf' },
                { id: 'file_2', name: 'doc2.txt', mimeType: 'text/plain' },
              ],
            },
          })),
        },
      })),
      calendar: vi.fn(() => ({
        events: {
          insert: vi.fn(async () => ({
            data: {
              id: 'event_123',
              htmlLink: 'https://calendar.google.com/event?eid=event_123',
            },
          })),
        },
        calendarList: {
          list: vi.fn(async () => ({
            data: {
              items: [
                { id: 'cal_1', summary: 'Work' },
                { id: 'cal_2', summary: 'Personal' },
              ],
            },
          })),
        },
      })),
      chat: vi.fn(() => ({
        spaces: {
          list: vi.fn(async () => ({
            data: { spaces: [{ name: 'spaces/test-space', displayName: 'Test Space' }] },
          })),
          messages: {
            create: vi.fn(async () => ({
              data: { name: 'spaces/test/messages/msg_1' },
            })),
            list: vi.fn(async () => ({
              data: {
                messages: [{ name: 'spaces/test-space/messages/msg_1', text: 'Hello' }],
              },
            })),
          },
        },
      })),
    },
  };
});

// Mock fs.readFile for credentials/token loading
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: actual,
    ...actual,
    readFile: vi.fn(async (path: string) => {
      if (path.includes('google-oauth2-credentials.json') || path.includes('google_credentials.json')) {
        return JSON.stringify({
          installed: {
            client_id: 'mock_client_id',
            client_secret: 'mock_client_secret',
            redirect_uris: ['http://localhost'],
          },
        });
      }
      if (path.includes('google-token.json') || path.includes('google_token.json')) {
        return JSON.stringify({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expiry_date: Date.now() + 3600000,
        });
      }
      throw new Error('File not found');
    }),
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
  };
});

describe('UnifiedWorkspaceClient', () => {
  let client: UnifiedWorkspaceClient;

  beforeEach(async () => {
    resetWorkspaceClient();
    client = new UnifiedWorkspaceClient({ scopes: [] });
    await client.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ======================================================================
  // Initialization & Authentication
  // ======================================================================

  describe('Initialization', () => {
    it('should initialize with default scopes', async () => {
      expect(client).toBeDefined();
    });

    it.skip('should load credentials from config directory', async () => {
      // Skipped: credentials loading now handled by getGoogleAuth utility
    });

    it.skip('should throw error if credentials file is missing', async () => {
      // Skipped: credentials loading now handled by getGoogleAuth utility
    });
  });

  // ======================================================================
  // Gmail Operations
  // ======================================================================

  describe('Gmail - Email Draft Creation', () => {
    it('should create an email draft with required fields', async () => {
      const draft = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test email body',
      };

      const result = await client.createEmailDraft(draft);

      expect(result).toHaveProperty('draftId');
      expect(result).toHaveProperty('url');
      expect(result.draftId).toBe('draft_123');
      expect(result.url).toContain('mail.google.com');
    });

    it('should create an email draft with attachments (placeholder)', async () => {
      const draft = {
        to: 'recipient@example.com',
        subject: 'Invoice Attached',
        body: 'Please find the invoice attached.',
        attachments: ['./data/invoice.pdf'],
      };

      const result = await client.createEmailDraft(draft);

      expect(result.draftId).toBe('draft_123');
    });

    it('should automatically initialize if Gmail client not initialized', async () => {
      resetWorkspaceClient();
      const newClient = new UnifiedWorkspaceClient({ scopes: [] });
      
      const draft = {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
      };

      const result = await newClient.createEmailDraft(draft);
      expect(result.draftId).toBe('draft_123');
    });
  });

  describe('Gmail - Email Search', () => {
    it('should search emails by query', async () => {
      const results = await client.searchEmails('is:unread', 10);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0].id).toBe('msg_1');
    });

    it('should return empty array if no emails match query', async () => {
      const { google } = await import('googleapis');
      vi.mocked(google.gmail).mockReturnValueOnce({
        users: {
          messages: {
            list: vi.fn(async () => ({ data: { messages: [] } })),
          },
        },
      } as any);

      resetWorkspaceClient();
      const newClient = new UnifiedWorkspaceClient({ scopes: [] });
      await newClient.initialize();

      const results = await newClient.searchEmails('from:nobody@example.com');

      expect(results).toEqual([]);
    });

    it('should handle Gmail API errors gracefully', async () => {
      const { google } = await import('googleapis');
      vi.mocked(google.gmail).mockReturnValueOnce({
        users: {
          messages: {
            list: vi.fn(async () => {
              throw new Error('Gmail API error');
            }),
          },
        },
      } as any);

      resetWorkspaceClient();
      const newClient = new UnifiedWorkspaceClient({ scopes: [] });
      await newClient.initialize();

      const results = await newClient.searchEmails('test query');

      expect(results).toEqual([]);
    });
  });

  describe('Gmail - Email Attachments', () => {
    it('should retrieve email attachments', async () => {
      const attachments = await client.getEmailAttachments('msg_1');

      expect(attachments).toHaveLength(1);
      expect(attachments[0].filename).toBe('invoice.pdf');
      expect(attachments[0].data).toBeInstanceOf(Buffer);
    });

    it('should return empty array if no attachments found', async () => {
      const { google } = await import('googleapis');
      vi.mocked(google.gmail).mockReturnValueOnce({
        users: {
          messages: {
            get: vi.fn(async () => ({
              data: { id: 'msg_2', payload: { parts: [] } },
            })),
          },
        },
      } as any);

      resetWorkspaceClient();
      const newClient = new UnifiedWorkspaceClient({ scopes: [] });
      await newClient.initialize();

      const attachments = await newClient.getEmailAttachments('msg_2');

      expect(attachments).toEqual([]);
    });
  });

  // ======================================================================
  // Google Sheets Operations
  // ======================================================================

  describe('Google Sheets - Sheet Operations', () => {
    it('should read data from a spreadsheet', async () => {
      const result = await client.performSheetOperation({
        spreadsheetId: 'sheet_123',
        range: 'Sheet1!A1:C10',
        values: [],
        operation: 'read',
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(['Name', 'Email', 'Status']);
    });

    it('should append data to a spreadsheet', async () => {
      const result = await client.performSheetOperation({
        spreadsheetId: 'sheet_123',
        range: 'Sheet1!A1',
        values: [['Bob', 'bob@example.com', 'Pending']],
        operation: 'append',
      });

      expect(result).toHaveProperty('updates');
      expect(result.updates.updatedRows).toBe(1);
    });

    it('should update data in a spreadsheet', async () => {
      const result = await client.performSheetOperation({
        spreadsheetId: 'sheet_123',
        range: 'Sheet1!A2:C2',
        values: [['Alice Updated', 'alice@example.com', 'Inactive']],
        operation: 'update',
      });

      expect(result).toHaveProperty('updatedRows');
      expect(result.updatedRows).toBe(1);
    });

    it('should throw error for unknown sheet operation', async () => {
      await expect(
        client.performSheetOperation({
          spreadsheetId: 'sheet_123',
          range: 'Sheet1!A1',
          values: [],
          operation: 'delete' as any,
        })
      ).rejects.toThrow('Unknown sheet operation');
    });
  });

  describe('Google Sheets - Spreadsheet Creation', () => {
    it('should create a new spreadsheet', async () => {
      const result = await client.createSpreadsheet('Test Spreadsheet');

      expect(result).toHaveProperty('spreadsheetId');
      expect(result).toHaveProperty('url');
      expect(result.spreadsheetId).toBe('sheet_123');
      expect(result.url).toContain('docs.google.com');
    });
  });

  // ======================================================================
  // Google Drive Operations
  // ======================================================================

  describe('Google Drive - File Upload', () => {
    it('should upload a file to Google Drive', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.from('mock file content'));

      const result = await client.uploadFile({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        localPath: './data/test.pdf',
      });

      expect(result).toHaveProperty('fileId');
      expect(result).toHaveProperty('webViewLink');
      expect(result.fileId).toBe('file_123');
      expect(result.webViewLink).toContain('drive.google.com');
    });

    it('should upload file to specific folder', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.from('mock file content'));

      const result = await client.uploadFile({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        localPath: './data/test.pdf',
        parents: ['folder_123'],
      });

      expect(result.fileId).toBe('file_123');
    });

    it('should throw error if localPath is missing', async () => {
      await expect(
        client.uploadFile({
          name: 'test.pdf',
          mimeType: 'application/pdf',
        })
      ).rejects.toThrow('localPath is required');
    });

    it('should create a new Google Doc', async () => {
      const result = await client.createDocument('Mock content', 'Mock Title');

      expect(result).toBe('https://drive.google.com/file/d/file_123/view');
    });
  });

  describe('Google Drive - File Listing', () => {
    it('should list files in Drive', async () => {
      const files = await client.listFiles();

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('doc1.pdf');
      expect(files[1].name).toBe('doc2.txt');
    });

    it('should list files in specific folder', async () => {
      const files = await client.listFiles('folder_123');

      expect(files).toHaveLength(2);
    });

    it('should handle Drive API errors gracefully', async () => {
      const { google } = await import('googleapis');
      vi.mocked(google.drive).mockReturnValueOnce({
        files: {
          list: vi.fn(async () => {
            throw new Error('Drive API error');
          }),
        },
      } as any);

      resetWorkspaceClient();
      const newClient = new UnifiedWorkspaceClient({ scopes: [] });
      await newClient.initialize();

      const files = await newClient.listFiles();

      expect(files).toEqual([]);
    });
  });

  // ======================================================================
  // Google Calendar Operations
  // ======================================================================

  describe('Google Calendar - Event Creation', () => {
    it('should create a calendar event', async () => {
      const event = {
        summary: 'Team Meeting',
        description: 'Discuss Q2 roadmap',
        start: {
          dateTime: '2026-02-25T10:00:00',
          timeZone: 'Europe/Budapest',
        },
        end: {
          dateTime: '2026-02-25T11:00:00',
          timeZone: 'Europe/Budapest',
        },
        attendees: [{ email: 'team@example.com' }],
      };

      const result = await client.createCalendarEvent(event);

      expect(result).toHaveProperty('eventId');
      expect(result).toHaveProperty('htmlLink');
      expect(result.eventId).toBe('event_123');
      expect(result.htmlLink).toContain('calendar.google.com');
    });

    it('should create event in specific calendar', async () => {
      const event = {
        summary: 'Personal Reminder',
        start: {
          dateTime: '2026-02-26T14:00:00',
          timeZone: 'Europe/Budapest',
        },
        end: {
          dateTime: '2026-02-26T15:00:00',
          timeZone: 'Europe/Budapest',
        },
      };

      const result = await client.createCalendarEvent(event, 'personal_cal_id');

      expect(result.eventId).toBe('event_123');
    });
  });

  // ======================================================================
  // Factory Function & Singleton
  // ======================================================================

  describe('Factory Function', () => {
    it('should return singleton instance on subsequent calls', async () => {
      const { getWorkspaceClient } = await import('../src/tools/unifiedWorkspace.js');

      const client1 = await getWorkspaceClient();
      const client2 = await getWorkspaceClient();

      expect(client1).toBe(client2);
    });

    it('should reset singleton on resetWorkspaceClient()', async () => {
      const { getWorkspaceClient, resetWorkspaceClient } = await import(
        '../src/tools/unifiedWorkspace.js'
      );

      const client1 = await getWorkspaceClient();
      resetWorkspaceClient();
      const client2 = await getWorkspaceClient();

      // Should be different instances after reset
      expect(client1).not.toBe(client2);
    });
  });
});
