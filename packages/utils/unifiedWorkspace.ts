/**
 * Unified Workspace Tool - Google Workspace API Integration
 * 
 * Consolidated Google API operations for BAS Enterprise Suite modules.
 * Handles: Gmail, Google Sheets, Google Drive, Calendar
 * 
 * @module tools/unifiedWorkspace
 * @version 1.0.0
 */

import { google } from 'googleapis';
import type { Auth } from 'googleapis';
import { logInfo, logError } from '@packages/utils/logger.js';
import { getGoogleAuth } from '@packages/utils/googleAuth.js';
import * as fs from 'fs/promises';

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
  cc?: string[];
  attachments?: string[];
}

export interface EmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

export interface SheetOperation {
  spreadsheetId: string;
  range: string;
  values: unknown[][];
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

type SheetCellValue = string | number | boolean | null;
type SheetRow = SheetCellValue[];
type SheetRows = SheetRow[];

interface GoogleAuthClient {
  setCredentials(credentials: unknown): void;
}

function isGoogleAuthClient(value: unknown): value is GoogleAuthClient {
  return typeof value === 'object' && value !== null && typeof (value as GoogleAuthClient).setCredentials === 'function';
}

interface GmailDraftCreateResponse {
  data: { id?: string | null };
}

interface GmailMessageSummary {
  id?: string | null;
  threadId?: string | null;
}

interface GmailMessageListResponse {
  data: { messages?: GmailMessageSummary[] | null };
}

interface GmailMessageAttachment {
  data: { data: string };
}

interface GmailMessageAttachmentResponse {
  data: { data: string };
}

interface GmailMessagePart {
  filename?: string | null;
  body?: { attachmentId?: string | null } | null;
}

interface GmailMessageData {
  payload?: { parts?: GmailMessagePart[] | null } | null;
}

interface GmailMessageGetResponse {
  data: GmailMessageData;
}

interface GmailUsersDraftsResource {
  create(request: {
    userId: string;
    requestBody: {
      message: { raw: string };
    };
  }): Promise<GmailDraftCreateResponse>;
}

interface GmailUsersMessagesResource {
  list(request: {
    userId: string;
    q: string;
    maxResults: number;
  }): Promise<GmailMessageListResponse>;
  get(request: {
    userId: string;
    id: string;
  }): Promise<GmailMessageGetResponse>;
  modify(request: {
    userId: string;
    id: string;
    requestBody: {
      addLabelIds?: string[];
      removeLabelIds?: string[];
    };
  }): Promise<{ data: unknown }>;
  attachments: {
    get(request: {
      userId: string;
      messageId: string;
      id: string;
    }): Promise<GmailMessageAttachmentResponse>;
  };
}

interface GmailUsersResource {
  drafts: GmailUsersDraftsResource;
  messages: GmailUsersMessagesResource;
  getProfile(request: { userId: string }): Promise<{ data: { emailAddress?: string | null } }>;
}

interface SheetsReadResponse {
  data: { values?: SheetRows | null };
}

interface SheetsServiceClient {
  spreadsheets: {
    create(request: {
      resource: {
        properties: { title: string };
      };
    }): Promise<{ data: { spreadsheetId?: string | null; spreadsheetUrl?: string | null } }>;
    values: {
      get(request: {
        spreadsheetId: string;
        range: string;
      }): Promise<SheetsReadResponse>;
      append(request: {
        spreadsheetId: string;
        range: string;
        valueInputOption: 'USER_ENTERED';
        resource: {
          values: unknown[][];
        };
      }): Promise<{ data: SheetMutationResult }>;
      update(request: {
        spreadsheetId: string;
        range: string;
        valueInputOption: 'USER_ENTERED';
        resource: {
          values: unknown[][];
        };
      }): Promise<{ data: SheetMutationResult }>;
    };
  };
}

interface DriveFileRequestBody {
  name: string;
  mimeType: string;
  parents?: string[];
}

interface DriveFileCreateResponse {
  data: { id?: string | null; webViewLink?: string | null };
}

interface DriveFileListItem {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
}

interface DriveFileListResponse {
  data: { files?: DriveFileListItem[] | null };
}

interface DriveServiceClient {
  files: {
    create(request: {
      requestBody: DriveFileRequestBody;
      media?: {
        mimeType: string;
        body: string | Buffer | NodeJS.ReadableStream;
      };
      fields?: string;
    }): Promise<DriveFileCreateResponse>;
    list(request: {
      q?: string;
      fields?: string;
      pageSize?: number;
    }): Promise<DriveFileListResponse>;
  };
}

interface CalendarEventInsertResponse {
  data: { id?: string | null; htmlLink?: string | null };
}

interface CalendarServiceClient {
  events: {
    insert(request: {
      calendarId: string;
      requestBody: CalendarEvent;
    }): Promise<CalendarEventInsertResponse>;
  };
}

type SheetReadResult = SheetRows;
interface SheetMutationResult {
  [key: string]: unknown;
  updatedRows?: number | null;
  updates?: { updatedRows?: number | null; [key: string]: unknown };
}
type SheetOperationResult = SheetReadResult | SheetMutationResult;

// ============================================================================
// Unified Workspace Client
// ============================================================================

export class UnifiedWorkspaceClient {
  private auth: Auth.OAuth2Client | undefined;

  private gmail: ReturnType<typeof google.gmail> | undefined;

  private sheets: ReturnType<typeof google.sheets> | undefined;

  private drive: ReturnType<typeof google.drive> | undefined;

  private calendar: ReturnType<typeof google.calendar> | undefined;

  private chat: ReturnType<typeof google.chat> | undefined;

  constructor(private config: WorkspaceConfig) {}

  /**
   * Initialize authentication with Google Workspace
   */
  async initialize(): Promise<void> {
    try {
      logInfo('UnifiedWorkspace', 'Initializing Google Workspace authentication via utility...');

      // Use shared auth utility
      const auth = await getGoogleAuth();

      if (!isGoogleAuthClient(auth)) {
        throw new Error('Google auth utility returned an invalid OAuth2 client');
      }

      this.auth = auth as Auth.OAuth2Client;

      // Initialize service clients
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      if (typeof google.chat === 'function') { this.chat = google.chat({ version: 'v1', auth: this.auth }); }

      logInfo('UnifiedWorkspace', '✅ Google Workspace initialized successfully');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to initialize: ${errorMsg}`);
      throw new Error(`Google Workspace init failed: ${errorMsg}`, { cause: error });
    }
  }

  private async getGmailClient(): Promise<ReturnType<typeof google.gmail>> {
    if (!this.gmail) {
      await this.initialize();
    }

    if (!this.gmail) {
      throw new Error('Gmail client is not initialized');
    }

    return this.gmail;
  }

  private async getSheetsClient(): Promise<ReturnType<typeof google.sheets>> {
    if (!this.sheets) {
      await this.initialize();
    }

    if (!this.sheets) {
      throw new Error('Sheets client is not initialized');
    }

    return this.sheets;
  }

  private async getDriveClient(): Promise<ReturnType<typeof google.drive>> {
    if (!this.drive) {
      await this.initialize();
    }

    if (!this.drive) {
      throw new Error('Drive client is not initialized');
    }

    return this.drive;
  }

  private async getCalendarClient(): Promise<ReturnType<typeof google.calendar>> {
    if (!this.calendar) {
      await this.initialize();
    }

    if (!this.calendar) {
      throw new Error('Calendar client is not initialized');
    }

    return this.calendar;
  }

  private async getChatClient(): Promise<ReturnType<typeof google.chat>> {
    if (!this.chat) {
      await this.initialize();
    }

    if (!this.chat) {
      throw new Error('Chat client is not initialized');
    }

    return this.chat;
  }

  // ========================================================================
  // Gmail Operations
  // ========================================================================

  /**
   * Create email draft (requires human approval before sending)
   */
  async createEmailDraft(draft: EmailDraft): Promise<{ draftId: string; url: string }> {
    try {
      const gmail = await this.getGmailClient();
      logInfo('UnifiedWorkspace', `Creating email draft to: ${draft.to}`);

      const message = this.createEmailMessage(draft);
      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: Buffer.from(message).toString('base64url'),
          },
        },
      });

      const draftId = response.data.id!;
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
   * Send email immediately
   */
  async sendEmail(draft: EmailDraft): Promise<{ messageId: string; url: string }> {
    try {
      const gmail = await this.getGmailClient();
      logInfo('UnifiedWorkspace', `Sending email to: ${draft.to}`);

      const message = this.createEmailMessage(draft);
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(message).toString('base64url'),
        },
      });

      const messageId = response.data.id!;
      const url = `https://mail.google.com/mail/u/0/#sent/${messageId}`;
      logInfo('UnifiedWorkspace', `✅ Email sent: ${messageId}`);
      return { messageId, url };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to send email: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Search emails by query
   */
  async searchEmails(query: string, maxResults: number = 10): Promise<unknown[]> {
    try {
      const gmail = await this.getGmailClient();
      logInfo('UnifiedWorkspace', `Searching emails: "${query}"`);

      const response = await gmail.users.messages.list({
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

  async listEmailMessages(query: string, maxResults: number = 10): Promise<EmailMessageSummary[]> {
    try {
      const gmail = await this.getGmailClient();
      logInfo('UnifiedWorkspace', `Listing email messages: "${query}"`);

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const summaries = response.data.messages || [];
      const messages: EmailMessageSummary[] = [];

      for (const summary of summaries) {
        if (!summary.id) {
          continue;
        }

        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: summary.id,
        });

        const headers = detail.data.payload?.headers ?? [];
        const getHeader = (name: string): string => {
          const header = headers.find(item => item.name === name);
          return header?.value ?? '';
        };

        messages.push({
          id: summary.id,
          threadId: summary.threadId ?? '',
          from: getHeader('From'),
          subject: getHeader('Subject'),
          snippet: detail.data.snippet ?? '',
          date: getHeader('Date'),
        });
      }

      return messages;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Email listing failed: ${errorMsg}`);
      return [];
    }
  }

  /**
   * Modify email labels
   */
  async modifyEmail(messageId: string, options: { addLabelIds?: string[], removeLabelIds?: string[] }): Promise<void> {
    try {
      const gmail = await this.getGmailClient();
      await gmail.users.messages.modify({
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
    try {
      const gmail = await this.getGmailClient();
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });

      const attachments: { filename: string; data: Buffer }[] = [];

      if (message.data.payload?.parts) {
        for (const part of message.data.payload.parts) {
            if (part.filename && part.body?.attachmentId) {
              const attachment = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: messageId,
                id: part.body.attachmentId,
              });

              attachments.push({
                filename: part.filename,
                data: Buffer.from(attachment.data.data!, 'base64'),
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
  async performSheetOperation(operation: SheetOperation & { operation: 'read' }): Promise<SheetReadResult>;
  async performSheetOperation(operation: SheetOperation & { operation: 'append' | 'update' }): Promise<SheetMutationResult>;
  async performSheetOperation(operation: SheetOperation): Promise<SheetOperationResult>;
  async performSheetOperation(operation: SheetOperation): Promise<SheetOperationResult> {
    try {
      const sheets = await this.getSheetsClient();
      logInfo('UnifiedWorkspace', `Sheet ${operation.operation}: ${operation.spreadsheetId}`);

      switch (operation.operation) {
        case 'read': {
          const readResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: operation.spreadsheetId,
            range: operation.range,
          });
          return readResponse.data.values || [];
        }

        case 'append': {
          const appendResponse = await sheets.spreadsheets.values.append({
            spreadsheetId: operation.spreadsheetId,
            range: operation.range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: operation.values,
            },
          });
          return {
            ...appendResponse.data,
            updates: appendResponse.data.updates
              ? {
                  ...appendResponse.data.updates,
                  updatedRows: appendResponse.data.updates.updatedRows ?? null,
                }
              : undefined,
          };
        }

        case 'update': {
          const updateResponse = await sheets.spreadsheets.values.update({
            spreadsheetId: operation.spreadsheetId,
            range: operation.range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: operation.values,
            },
          });
          return {
            ...updateResponse.data,
            updatedRows: updateResponse.data.updatedRows ?? null,
          };
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
    try {
      const sheets = await this.getSheetsClient();
      const response = await sheets.spreadsheets.create({
        requestBody: {
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
    try {
      const drive = await this.getDriveClient();
      if (!fileInfo.localPath) {
        throw new Error('localPath is required for file upload');
      }

      logInfo('UnifiedWorkspace', `Uploading file: ${fileInfo.name}`);

      const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
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

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
      });

      logInfo('UnifiedWorkspace', `✅ File uploaded: ${response.data.id}`);
      return {
        fileId: response.data.id!,
        webViewLink: response.data.webViewLink!,
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
    try {
      const drive = await this.getDriveClient();
      const fileMetadata: DriveFileRequestBody = {
        name,
        mimeType,
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const stream = new (await import('stream')).PassThrough();
      stream.end(data);

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType,
          body: stream,
        },
        fields: 'id,webViewLink',
      });

      logInfo('UnifiedWorkspace', `✅ File uploaded from buffer: ${response.data.id}`);
      return {
        fileId: response.data.id!,
        webViewLink: response.data.webViewLink!,
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
    try {
      const drive = await this.getDriveClient();
      let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
      if (parentId) {
        q += ` and '${parentId}' in parents`;
      }

      const response = await drive.files.list({
        q,
        fields: 'files(id, name)',
        pageSize: 1,
      });

      if (!response.data.files || response.data.files.length === 0) {
        return null;
      }

      const file = response.data.files[0];
      return {
        id: file.id!,
        name: file.name!,
      };
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
    try {
      const drive = await this.getDriveClient();
      const fileMetadata: DriveFileRequestBody = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });

      logInfo('UnifiedWorkspace', `✅ Folder created: ${name} (${response.data.id})`);
      return {
        id: response.data.id!,
        name,
      };
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
    try {
      const drive = await this.getDriveClient();
      logInfo('UnifiedWorkspace', `Creating Google Doc: ${title || 'Untitled Document'}`);

      const response = await drive.files.create({
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
      return response.data.webViewLink!;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to create Google Doc: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * List files in a Drive folder
   */
  async listFiles(folderId?: string, query?: string): Promise<unknown[]> {
    try {
      const drive = await this.getDriveClient();
      let q = query || '';
      if (folderId) {
        q += (q ? ' and ' : '') + `'${folderId}' in parents`;
      }

      const response = await drive.files.list({
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
    try {
      const calendar = await this.getCalendarClient();
      logInfo('UnifiedWorkspace', `Creating calendar event: ${event.summary}`);

      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      logInfo('UnifiedWorkspace', `✅ Event created: ${response.data.id}`);
      return {
        eventId: response.data.id!,
        htmlLink: response.data.htmlLink!,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to create event: ${errorMsg}`);
      throw error;
    }
  }

  async listCalendarEvents(maxResults: number = 10, timeMin: string = new Date().toISOString(), calendarId: string = 'primary'): Promise<unknown[]> {
    try {
      const calendar = await this.getCalendarClient();
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to list calendar events: ${errorMsg}`);
      return [];
    }
  }

  async listChatSpaces(maxResults: number = 10): Promise<unknown[]> {
    try {
      const chat = await this.getChatClient();
      const response = await chat.spaces.list({
        pageSize: maxResults,
      });

      return response.data.spaces || [];
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to list chat spaces: ${errorMsg}`);
      return [];
    }
  }

  async listChatMessages(spaceName: string, maxResults: number = 10): Promise<unknown[]> {
    try {
      const chat = await this.getChatClient();
      const response = await chat.spaces.messages.list({
        parent: spaceName,
        pageSize: maxResults,
      });

      return response.data.messages || [];
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to list chat messages: ${errorMsg}`);
      return [];
    }
  }

  async sendChatMessage(spaceName: string, text: string): Promise<{ messageId: string; threadId?: string }> {
    try {
      const chat = await this.getChatClient();
      const response = await chat.spaces.messages.create({
        parent: spaceName,
        requestBody: {
          text,
        },
      });

      return {
        messageId: response.data.name ?? '',
        threadId: response.data.thread?.name ?? undefined,
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('UnifiedWorkspace', `Failed to send chat message: ${errorMsg}`);
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
    if (draft.cc && draft.cc.length > 0) {
      message += `Cc: ${draft.cc.join(', ')}\r\n`;
    }
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

