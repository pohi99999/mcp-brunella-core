/**
 * Unified Workspace Tool - Google Workspace API Integration
 * 
 * Consolidated Google API operations for BAS Enterprise Suite modules.
 * Handles: Gmail, Google Sheets, Google Drive, Calendar
 * 
 * @module tools/unifiedWorkspace
 * @version 1.0.0
 */

import { google, Auth } from 'googleapis';
import { logInfo, logError } from '../utils/logger.js';
import { getGoogleAuth } from '../utils/googleAuth.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WorkspaceConfig {
  credentialsPath?: string;
  tokenPath?: string;
  scopes: string[];
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  attachments?: string[];
}

export interface SheetOperation {
  spreadsheetId: string;
  range: string;
  values: any[][];
  operation: 'append' | 'update' | 'read';
}

export interface DriveFileInfo {
  name: string;
  mimeType: string;
  parents?: string[];
  localPath?: string; // For upload
}

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: { email: string }[];
}

// ============================================================================
// Unified Workspace Client
// ============================================================================

export class UnifiedWorkspaceClient {
  private auth: Auth.OAuth2Client | undefined;
  private gmail: any;
  private sheets: any;
  private drive: any;
  private calendar: any;

  constructor(private config: WorkspaceConfig) {}

  /**
   * Initialize authentication with Google Workspace
   */
  async initialize(): Promise<void> {
    try {
      logInfo('UnifiedWorkspace', 'Initializing Google Workspace authentication via utility...');

      // Use shared auth utility
      this.auth = await getGoogleAuth() as Auth.OAuth2Client;

      // Initialize service clients
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });

      logInfo('UnifiedWorkspace', '✅ Google Workspace initialized successfully');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to initialize: ${errorMsg}`);
      throw new Error(`Google Workspace init failed: ${errorMsg}`, { cause: error });
    }
  }

  // ========================================================================
  // Gmail Operations
  // ========================================================================

  /**
   * Create email draft (requires human approval before sending)
   */
  async createEmailDraft(draft: EmailDraft): Promise<{ draftId: string; url: string }> {
    if (!this.gmail) {
      await this.initialize();
    }

    try {
      logInfo('UnifiedWorkspace', `Creating email draft to: ${draft.to}`);

      const message = this.createEmailMessage(draft);
      const response = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: Buffer.from(message).toString('base64url'),
          },
        },
      });

      const draftId = response.data.id;
      const url = `https://mail.google.com/mail/u/0/#drafts/${draftId}`;

      logInfo('UnifiedWorkspace', `✅ Draft created: ${draftId}`);
      return { draftId, url };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to create email draft: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Search emails by query
   */
  async searchEmails(query: string, maxResults: number = 10): Promise<any[]> {
    if (!this.gmail) {
      await this.initialize();
    }

    try {
      logInfo('UnifiedWorkspace', `Searching emails: "${query}"`);

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      return response.data.messages || [];
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Email search failed: ${errorMsg}`);
      return [];
    }
  }

  /**
   * Modify email labels
   */
  async modifyEmail(messageId: string, options: { addLabelIds?: string[], removeLabelIds?: string[] }): Promise<void> {
    if (!this.gmail) {
      await this.initialize();
    }

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: options.addLabelIds,
          removeLabelIds: options.removeLabelIds,
        },
      });
      logInfo('UnifiedWorkspace', `✅ Email modified: ${messageId}`);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to modify email: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Get email attachments (for invoice processing, etc.)
   */
  async getEmailAttachments(messageId: string): Promise<{ filename: string; data: Buffer }[]> {
    if (!this.gmail) {
      await this.initialize();
    }

    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });

      const attachments: { filename: string; data: Buffer }[] = [];

      if (message.data.payload?.parts) {
        for (const part of message.data.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            const attachment = await this.gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: messageId,
              id: part.body.attachmentId,
            });

            attachments.push({
              filename: part.filename,
              data: Buffer.from(attachment.data.data, 'base64'),
            });
          }
        }
      }

      return attachments;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to get attachments: ${errorMsg}`);
      return [];
    }
  }

  // ========================================================================
  // Google Sheets Operations
  // ========================================================================

  /**
   * Batch operations on Google Sheets (read/write/append)
   */
  async performSheetOperation(operation: SheetOperation): Promise<any> {
    if (!this.sheets) {
      await this.initialize();
    }

    try {
      logInfo('UnifiedWorkspace', `Sheet ${operation.operation}: ${operation.spreadsheetId}`);

      switch (operation.operation) {
        case 'read': {
          const readResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: operation.spreadsheetId,
            range: operation.range,
          });
          return readResponse.data.values || [];
        }

        case 'append': {
          const appendResponse = await this.sheets.spreadsheets.values.append({
            spreadsheetId: operation.spreadsheetId,
            range: operation.range,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: operation.values,
            },
          });
          return appendResponse.data;
        }

        case 'update': {
          const updateResponse = await this.sheets.spreadsheets.values.update({
            spreadsheetId: operation.spreadsheetId,
            range: operation.range,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: operation.values,
            },
          });
          return updateResponse.data;
        }

        default: {
          throw new Error(`Unknown sheet operation: ${operation.operation}`);
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Sheet operation failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Create new spreadsheet
   */
  async createSpreadsheet(title: string): Promise<{ spreadsheetId: string; url: string }> {
    if (!this.sheets) {
      await this.initialize();
    }

    try {
      const response = await this.sheets.spreadsheets.create({
        resource: {
          properties: {
            title,
          },
        },
      });

      const spreadsheetId = response.data.spreadsheetId!;
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      logInfo('UnifiedWorkspace', `✅ Spreadsheet created: ${title}`);
      return { spreadsheetId, url };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to create spreadsheet: ${errorMsg}`);
      throw error;
    }
  }

  // ========================================================================
  // Google Drive Operations
  // ========================================================================

  /**
   * Upload file to Google Drive
   */
  async uploadFile(fileInfo: DriveFileInfo): Promise<{ fileId: string; webViewLink: string }> {
    if (!this.drive) {
      await this.initialize();
    }

    try {
      if (!fileInfo.localPath) {
        throw new Error('localPath is required for file upload');
      }

      logInfo('UnifiedWorkspace', `Uploading file: ${fileInfo.name}`);

      const fileMetadata: any = {
        name: fileInfo.name,
        mimeType: fileInfo.mimeType,
      };

      if (fileInfo.parents) {
        fileMetadata.parents = fileInfo.parents;
      }

      const media = {
        mimeType: fileInfo.mimeType,
        body: await fs.readFile(fileInfo.localPath),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
      });

      logInfo('UnifiedWorkspace', `✅ File uploaded: ${response.data.id}`);
      return {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `File upload failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Upload file from Buffer
   */
  async uploadFileFromBuffer(data: Buffer, name: string, mimeType: string, parentId?: string): Promise<{ fileId: string; webViewLink: string }> {
    if (!this.drive) {
      await this.initialize();
    }

    try {
      const fileMetadata: any = {
        name,
        mimeType,
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const stream = new (await import('stream')).PassThrough();
      stream.end(data);

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType,
          body: stream,
        },
        fields: 'id,webViewLink',
      });

      logInfo('UnifiedWorkspace', `✅ File uploaded from buffer: ${response.data.id}`);
      return {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `File upload from buffer failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Find a folder by name
   */
  async findFolder(name: string, parentId?: string): Promise<{ id: string, name: string } | null> {
    if (!this.drive) {
      await this.initialize();
    }

    try {
      let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
      if (parentId) {
        q += ` and '${parentId}' in parents`;
      }

      const response = await this.drive.files.list({
        q,
        fields: 'files(id, name)',
        pageSize: 1,
      });

      return response.data.files && response.data.files.length > 0 ? response.data.files[0] : null;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Find folder failed: ${errorMsg}`);
      return null;
    }
  }

  /**
   * Create a folder
   */
  async createFolder(name: string, parentId?: string): Promise<{ id: string, name: string }> {
    if (!this.drive) {
      await this.initialize();
    }

    try {
      const fileMetadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });

      logInfo('UnifiedWorkspace', `✅ Folder created: ${name} (${response.data.id})`);
      return response.data;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Create folder failed: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Create a new Google Doc
   */
  async createDocument(content: string, title?: string): Promise<string> {
    if (!this.drive) {
      await this.initialize();
    }

    try {
      logInfo('UnifiedWorkspace', `Creating Google Doc: ${title || 'Untitled Document'}`);

      const response = await this.drive.files.create({
        requestBody: {
          name: title || 'Untitled Document',
          mimeType: 'application/vnd.google-apps.document',
        },
        media: {
          mimeType: 'text/plain',
          body: content,
        },
        fields: 'webViewLink',
      });

      logInfo('UnifiedWorkspace', `✅ Google Doc created: ${response.data.webViewLink}`);
      return response.data.webViewLink;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to create Google Doc: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * List files in a Drive folder
   */
  async listFiles(folderId?: string, query?: string): Promise<any[]> {
    if (!this.drive) {
      await this.initialize();
    }

    try {
      let q = query || '';
      if (folderId) {
        q += (q ? ' and ' : '') + `'${folderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
        pageSize: 100,
      });

      return response.data.files || [];
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to list files: ${errorMsg}`);
      return [];
    }
  }

  // ========================================================================
  // Google Calendar Operations
  // ========================================================================

  /**
   * Create calendar event
   */
  async createCalendarEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<{ eventId: string; htmlLink: string }> {
    if (!this.calendar) {
      await this.initialize();
    }

    try {
      logInfo('UnifiedWorkspace', `Creating calendar event: ${event.summary}`);

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      logInfo('UnifiedWorkspace', `✅ Event created: ${response.data.id}`);
      return {
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to create event: ${errorMsg}`);
      throw error;
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Create RFC 2822 email message
   */
  private createEmailMessage(draft: EmailDraft): string {
    const boundary = '===============boundary==';
    let message = '';

    message += `To: ${draft.to}\r\n`;
    message += `Subject: ${draft.subject}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/plain; charset=UTF-8\r\n\r\n`;
    message += `${draft.body}\r\n\r\n`;
    message += `--${boundary}--`;

    return message;
  }
}

// ============================================================================
// Factory Function for Easy Initialization
// ============================================================================

let _workspaceClient: UnifiedWorkspaceClient | null = null;

export async function getWorkspaceClient(config?: Partial<WorkspaceConfig>): Promise<UnifiedWorkspaceClient> {
  if (_workspaceClient) {
    return _workspaceClient;
  }

  const fullConfig: WorkspaceConfig = {
    scopes: [],
    ...config,
  };

  _workspaceClient = new UnifiedWorkspaceClient(fullConfig);
  // Do not initialize here to allow lazy auth
  return _workspaceClient;
}

export function resetWorkspaceClient(): void {
  _workspaceClient = null;
}
