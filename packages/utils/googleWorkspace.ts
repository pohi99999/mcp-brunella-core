import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { google } from 'googleapis';
import { getGoogleAuth } from '@packages/utils/googleAuth.js';
import { getWorkspaceClient } from './unifiedWorkspace.js';

export function registerGoogleWorkspaceTools(server: McpServer) {
  // GMAIL: List Messages
  server.tool(
    'gmail_list_messages',
    'Lists recent emails from Gmail.',
    {
      maxResults: z.number().default(10),
    },
    async ({ maxResults }) => {
      try {
        const auth = await getGoogleAuth();
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.messages.list({ userId: 'me', maxResults });

        const messages = res.data.messages || [];
        const details = await Promise.all(messages.map(async (msg) => {
          const m = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
          return {
            id: msg.id,
            snippet: m.data.snippet,
            from: m.data.payload?.headers?.find(h => h.name === 'From')?.value,
          };
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(details, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Gmail Error: ${err.message}` }] };
      }
    }
  );

  // GMAIL: Send Message
  server.tool(
    'gmail_send_message',
    'Sends an email through Gmail.',
    {
      to: z.array(z.string()).min(1),
      subject: z.string(),
      body: z.string(),
      cc: z.array(z.string()).optional(),
    },
    async ({ to, subject, body, cc }) => {
      try {
        const workspace = await getWorkspaceClient();
        const result = await workspace.sendEmail({
          to: to.join(', '),
          subject,
          body,
          cc,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Gmail Error: ${err.message}` }] };
      }
    }
  );

  // GMAIL: Create Draft
  server.tool(
    'gmail_create_draft',
    'Creates an email draft in Gmail.',
    {
      to: z.array(z.string()).min(1),
      subject: z.string(),
      body: z.string(),
      cc: z.array(z.string()).optional(),
    },
    async ({ to, subject, body, cc }) => {
      try {
        const workspace = await getWorkspaceClient();
        const result = await workspace.createEmailDraft({
          to: to.join(', '),
          subject,
          body,
          cc,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Gmail Error: ${err.message}` }] };
      }
    }
  );

  // CALENDAR: List Events
  server.tool(
    'calendar_list_events',
    'Lists upcoming events from Google Calendar.',
    {
      maxResults: z.number().default(10),
    },
    async ({ maxResults }) => {
      try {
        const auth = await getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth });
        const res = await calendar.events.list({
          calendarId: 'primary',
          timeMin: new Date().toISOString(),
          maxResults,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = res.data.items || [];
        const formatted = events.map(e => ({
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          location: e.location,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Calendar Error: ${err.message}` }] };
      }
    }
  );

  // CALENDAR: Create Event
  server.tool(
    'calendar_create_event',
    'Creates a Google Calendar event.',
    {
      summary: z.string(),
      start: z.string(),
      end: z.string(),
      timeZone: z.string().default('UTC'),
      description: z.string().optional(),
      attendees: z.array(z.string()).optional(),
    },
    async ({ summary, start, end, timeZone, description, attendees }) => {
      try {
        const workspace = await getWorkspaceClient();
        const result = await workspace.createCalendarEvent(
          {
            summary,
            description,
            start: { dateTime: start, timeZone },
            end: { dateTime: end, timeZone },
            attendees: attendees?.map(email => ({ email })),
          },
          'primary',
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Calendar Error: ${err.message}` }] };
      }
    }
  );

  // SHEETS: Append Data
  server.tool(
    'sheets_append_data',
    'Appends rows of data to a Google Sheet.',
    {
      spreadsheetId: z.string(),
      range: z.string().default('Sheet1!A1'),
      values: z.array(z.array(z.unknown())),
    },
    async ({ spreadsheetId, range, values }) => {
      try {
        const auth = await getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: { values },
        });

        return {
          content: [{ type: 'text', text: `Success: Updated ${res.data.updates?.updatedCells} cells.` }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Sheets Error: ${err.message}` }] };
      }
    }
  );

  // SHEETS: Create Spreadsheet
  server.tool(
    'sheets_create_spreadsheet',
    'Creates a new Google Sheet.',
    {
      title: z.string(),
    },
    async ({ title }) => {
      try {
        const auth = await getGoogleAuth();
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await sheets.spreadsheets.create({
          requestBody: {
            properties: { title },
          },
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            spreadsheetId: res.data.spreadsheetId,
            spreadsheetUrl: res.data.spreadsheetUrl,
          }, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Sheets Error: ${err.message}` }] };
      }
    }
  );

  // DRIVE: List Files
  server.tool(
    'drive_list_files',
    'Lists files in Google Drive.',
    {
      folderId: z.string().optional(),
      query: z.string().optional(),
      maxResults: z.number().default(20),
    },
    async ({ folderId, query, maxResults }) => {
      try {
        const workspace = await getWorkspaceClient();
        const files = await workspace.listFiles(folderId, query);
        return {
          content: [{ type: 'text', text: JSON.stringify(files.slice(0, maxResults), null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Drive Error: ${err.message}` }] };
      }
    }
  );

  // DRIVE: Upload Text File
  server.tool(
    'drive_upload_text_file',
    'Creates a text file in Google Drive from content.',
    {
      name: z.string(),
      content: z.string(),
      mimeType: z.string().default('text/plain'),
      parentId: z.string().optional(),
    },
    async ({ name, content, mimeType, parentId }) => {
      try {
        const workspace = await getWorkspaceClient();
        const result = await workspace.uploadFileFromBuffer(
          Buffer.from(content, 'utf8'),
          name,
          mimeType,
          parentId,
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Drive Error: ${err.message}` }] };
      }
    }
  );

  // CHAT: List Spaces
  server.tool(
    'chat_list_spaces',
    'Lists Google Chat spaces.',
    {
      maxResults: z.number().default(10),
    },
    async ({ maxResults }) => {
      try {
        const workspace = await getWorkspaceClient();
        const spaces = await workspace.listChatSpaces(maxResults);
        return {
          content: [{ type: 'text', text: JSON.stringify(spaces, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Chat Error: ${err.message}` }] };
      }
    }
  );

  // CHAT: List Messages
  server.tool(
    'chat_list_messages',
    'Lists messages in a Google Chat space.',
    {
      spaceName: z.string(),
      maxResults: z.number().default(10),
    },
    async ({ spaceName, maxResults }) => {
      try {
        const workspace = await getWorkspaceClient();
        const messages = await workspace.listChatMessages(spaceName, maxResults);
        return {
          content: [{ type: 'text', text: JSON.stringify(messages, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Chat Error: ${err.message}` }] };
      }
    }
  );

  // CHAT: Send Message
  server.tool(
    'chat_send_message',
    'Sends a message to a Google Chat space.',
    {
      spaceName: z.string(),
      text: z.string(),
    },
    async ({ spaceName, text }) => {
      try {
        const workspace = await getWorkspaceClient();
        const result = await workspace.sendChatMessage(spaceName, text);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: 'text', text: `Chat Error: ${err.message}` }] };
      }
    }
  );
}

