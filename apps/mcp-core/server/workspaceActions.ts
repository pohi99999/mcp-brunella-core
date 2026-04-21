import { getWorkspaceClient } from '@packages/utils/unifiedWorkspace.js';

export const WORKSPACE_ACTIONS = [
  'email_triage',
  'email_draft',
  'email_send',
  'calendar_check',
  'calendar_create',
  'drive_list',
  'drive_upload',
  'chat_list_spaces',
  'chat_list_messages',
  'chat_send',
] as const;

export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

export interface WorkspaceActionPayload {
  task?: string;
  context?: Record<string, unknown>;
  query?: string;
  maxResults?: number;
  to?: string[] | string;
  cc?: string[] | string;
  subject?: string;
  body?: string;
  message?: string;
  text?: string;
  spaceName?: string;
  calendarId?: string;
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  attendees?: Array<{ email?: string } | string>;
  folderId?: string;
  parentId?: string;
  name?: string;
  mimeType?: string;
  content?: string;
  localPath?: string;
  timeMin?: string;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function normalizeRecipients(value: unknown): string[] {
  return toStringArray(value).filter(item => item.includes('@'));
}

function normalizeAttendees(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const attendees: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.includes('@')) {
      attendees.push(entry.trim());
      continue;
    }

    if (entry && typeof entry === 'object') {
      const email = (entry as { email?: unknown }).email;
      if (typeof email === 'string' && email.includes('@')) {
        attendees.push(email.trim());
      }
    }
  }

  return attendees;
}

function firstContextValue(payload: WorkspaceActionPayload, key: keyof WorkspaceActionPayload): unknown {
  return payload.context?.[key as string] ?? payload[key];
}

function getQuery(payload: WorkspaceActionPayload): string {
  return (
    firstString(
      payload.query,
      payload.context?.query,
      payload.task,
    ) ?? 'in:inbox'
  );
}

export function isWorkspaceAction(action: string): action is WorkspaceAction {
  return (WORKSPACE_ACTIONS as readonly string[]).includes(action);
}

export async function executeWorkspaceAction(
  action: WorkspaceAction,
  payload: WorkspaceActionPayload,
): Promise<Record<string, unknown>> {
  const workspace = await getWorkspaceClient();

  switch (action) {
    case 'email_triage': {
      const query = getQuery(payload);
      const maxResults = toNumber(firstContextValue(payload, 'maxResults'), 10);
      const messages = await workspace.listEmailMessages(query, maxResults);
      return {
        operation: action,
        query,
        maxResults,
        count: messages.length,
        messages,
      };
    }

    case 'email_draft': {
      const to = normalizeRecipients(firstContextValue(payload, 'to'));
      const cc = normalizeRecipients(firstContextValue(payload, 'cc'));
      const subject = firstString(firstContextValue(payload, 'subject'), payload.task) ?? 'Untitled draft';
      const body = firstString(firstContextValue(payload, 'body'), firstContextValue(payload, 'message'), payload.task) ?? '';

      if (!to.length) {
        throw new Error('email_draft requires at least one recipient');
      }
      if (!body) {
        throw new Error('email_draft requires body text');
      }

      const draft = await workspace.createEmailDraft({
        to: to.join(', '),
        cc,
        subject,
        body,
      });

      return {
        operation: action,
        to,
        cc,
        subject,
        draft,
      };
    }

    case 'email_send': {
      const to = normalizeRecipients(firstContextValue(payload, 'to'));
      const cc = normalizeRecipients(firstContextValue(payload, 'cc'));
      const subject = firstString(firstContextValue(payload, 'subject'), payload.task) ?? 'Untitled message';
      const body = firstString(firstContextValue(payload, 'body'), firstContextValue(payload, 'message'), payload.task) ?? '';

      if (!to.length) {
        throw new Error('email_send requires at least one recipient');
      }
      if (!body) {
        throw new Error('email_send requires body text');
      }

      const sent = await workspace.sendEmail({
        to: to.join(', '),
        cc,
        subject,
        body,
      });

      return {
        operation: action,
        to,
        cc,
        subject,
        sent,
      };
    }

    case 'calendar_check': {
      const maxResults = toNumber(firstContextValue(payload, 'maxResults'), 10);
      const timeMin = firstString(firstContextValue(payload, 'timeMin')) ?? new Date().toISOString();
      const calendarId = firstString(firstContextValue(payload, 'calendarId')) ?? 'primary';
      const events = await workspace.listCalendarEvents(maxResults, timeMin, calendarId);
      return {
        operation: action,
        calendarId,
        timeMin,
        maxResults,
        count: events.length,
        events,
      };
    }

    case 'calendar_create': {
      const summary = firstString(firstContextValue(payload, 'summary'), payload.task);
      const start = firstString(firstContextValue(payload, 'start'));
      const end = firstString(firstContextValue(payload, 'end'));
      const timeZone = firstString(firstContextValue(payload, 'timeZone')) ?? 'UTC';
      const description = firstString(firstContextValue(payload, 'description'));
      const calendarId = firstString(firstContextValue(payload, 'calendarId')) ?? 'primary';
      const attendees = normalizeAttendees(firstContextValue(payload, 'attendees'));

      if (!summary || !start || !end) {
        throw new Error('calendar_create requires summary, start, and end');
      }

      const event = await workspace.createCalendarEvent(
        {
          summary,
          description,
          start: { dateTime: start, timeZone },
          end: { dateTime: end, timeZone },
          attendees: attendees.length > 0 ? attendees.map(email => ({ email })) : undefined,
        },
        calendarId,
      );

      return {
        operation: action,
        calendarId,
        summary,
        event,
      };
    }

    case 'drive_list': {
      const folderId = firstString(firstContextValue(payload, 'folderId'), firstContextValue(payload, 'parentId'));
      const query = firstString(firstContextValue(payload, 'query'));
      const files = await workspace.listFiles(folderId, query);
      return {
        operation: action,
        folderId,
        query,
        count: files.length,
        files,
      };
    }

    case 'drive_upload': {
      const name = firstString(firstContextValue(payload, 'name'), payload.task) ?? 'Brunella upload';
      const mimeType = firstString(firstContextValue(payload, 'mimeType')) ?? 'text/plain';
      const parentId = firstString(firstContextValue(payload, 'parentId'), firstContextValue(payload, 'folderId'));
      const localPath = firstString(firstContextValue(payload, 'localPath'));
      const content = firstString(firstContextValue(payload, 'content'), firstContextValue(payload, 'body'), payload.task);

      if (localPath) {
        const file = await workspace.uploadFile({
          name,
          mimeType,
          parents: parentId ? [parentId] : undefined,
          localPath,
        });

        return {
          operation: action,
          name,
          mimeType,
          parentId,
          file,
        };
      }

      if (!content) {
        throw new Error('drive_upload requires content or localPath');
      }

      const file = await workspace.uploadFileFromBuffer(
        Buffer.from(content, 'utf8'),
        name,
        mimeType,
        parentId,
      );

      return {
        operation: action,
        name,
        mimeType,
        parentId,
        file,
      };
    }

    case 'chat_list_spaces': {
      const maxResults = toNumber(firstContextValue(payload, 'maxResults'), 10);
      const spaces = await workspace.listChatSpaces(maxResults);
      return {
        operation: action,
        maxResults,
        count: spaces.length,
        spaces,
      };
    }

    case 'chat_list_messages': {
      const spaceName = firstString(firstContextValue(payload, 'spaceName'));
      const maxResults = toNumber(firstContextValue(payload, 'maxResults'), 10);
      if (!spaceName) {
        throw new Error('chat_list_messages requires spaceName');
      }
      const messages = await workspace.listChatMessages(spaceName, maxResults);
      return {
        operation: action,
        spaceName,
        maxResults,
        count: messages.length,
        messages,
      };
    }

    case 'chat_send': {
      const spaceName = firstString(firstContextValue(payload, 'spaceName'));
      const text = firstString(firstContextValue(payload, 'text'), firstContextValue(payload, 'message'), payload.task);
      if (!spaceName) {
        throw new Error('chat_send requires spaceName');
      }
      if (!text) {
        throw new Error('chat_send requires text');
      }
      const message = await workspace.sendChatMessage(spaceName, text);
      return {
        operation: action,
        spaceName,
        text,
        message,
      };
    }
  }
}

