import { ImapFlow } from 'imapflow';
import fs from 'fs-extra';
import path from 'path';
import { logInfo, logError } from '../utils/logger.js';
import { simpleParser } from 'mailparser';

export type ImapConfig = {
  host: string;
  port?: number;
  secure?: boolean;
  auth: { user: string; pass: string };
  mailbox?: string;
  destDir?: string;
  markSeen?: boolean;
  searchQuery?: any;
};

export async function fetchEmailsAsEml(cfg: ImapConfig): Promise<Array<{ filename: string; path: string; uid?: number; subject?: string }>> {
  const destDir = cfg.destDir || path.join(process.cwd(), 'data', 'invoices');
  await fs.mkdirp(destDir);
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port ?? 993,
    secure: cfg.secure ?? true,
    auth: cfg.auth
  });

  try {
    logInfo('imapConnector', `Connecting to IMAP ${cfg.host}`);
    await client.connect();
    const mailbox = cfg.mailbox || 'INBOX';
    await client.mailboxOpen(mailbox);

    const searchQuery = cfg.searchQuery ?? ['UNSEEN'];
    const uids = await client.search(searchQuery);
    logInfo('imapConnector', `Found ${uids.length} messages matching query`);

    const saved: Array<{ filename: string; path: string; uid?: number; subject?: string }> = [];
    if (uids.length === 0) return saved;

    for await (const message of client.fetch(uids, { uid: true, envelope: true, source: true })) {
      try {
        const subject = message.envelope?.subject ?? 'no-subject';
        const safeSubj = subject.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
        const filename = `${message.uid}_${safeSubj}.eml`;
        const destPath = path.join(destDir, filename);

        // message.source is a Buffer
        if (message.source) {
          await fs.writeFile(destPath, message.source);
          saved.push({ filename, path: destPath, uid: message.uid, subject });
          logInfo('imapConnector', `Saved message uid=${message.uid} -> ${destPath}`);
        }

        if (cfg.markSeen) {
          try { await client.messageFlagsAdd(message.uid, ['\\Seen']); } catch (err) { /* ignore */ }
        }
      } catch (inner) {
        logError('imapConnector', `Failed to save message: ${String(inner)}`);
      }
    }

    return saved;
  } catch (e) {
    logError('imapConnector', `Error in fetchEmailsAsEml: ${String(e)}`);
    return [];
  } finally {
    try { await client.logout(); } catch (e) { /* ignore */ }
  }
}

export async function fetchAndExtractAttachments(cfg: ImapConfig): Promise<Array<{ filename: string; path: string; uid?: number; subject?: string; contentType?: string; size?: number }>> {
  const destDir = cfg.destDir || path.join(process.cwd(), 'data', 'invoices');
  await fs.mkdirp(destDir);
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port ?? 993,
    secure: cfg.secure ?? true,
    auth: cfg.auth
  });

  try {
    logInfo('imapConnector', `Connecting to IMAP ${cfg.host} (attachment extraction)`);
    await client.connect();
    const mailbox = cfg.mailbox || 'INBOX';
    await client.mailboxOpen(mailbox);

    const searchQuery = cfg.searchQuery ?? ['UNSEEN'];
    const uids = await client.search(searchQuery);
    logInfo('imapConnector', `Found ${uids.length} messages matching query`);

    const saved: Array<{ filename: string; path: string; uid?: number; subject?: string; contentType?: string; size?: number }> = [];
    if (uids.length === 0) return saved;

    for await (const message of client.fetch(uids, { uid: true, envelope: true, source: true })) {
      try {
        const subject = message.envelope?.subject ?? 'no-subject';
        const parsed = message.source ? await simpleParser(message.source as Buffer) : null;
        if (parsed && parsed.attachments && parsed.attachments.length) {
          let idx = 0;
          for (const att of parsed.attachments) {
            const fname = att.filename || `attachment_${message.uid}_${idx}`;
            const safe = fname.replace(/[\\/:*?"<>|]/g, '_').slice(0, 160);
            const filename = `${message.uid}_${safe}`;
            const destPath = path.join(destDir, filename);
            await fs.writeFile(destPath, att.content);
            saved.push({ filename, path: destPath, uid: message.uid, subject, contentType: att.contentType, size: att.size });
            logInfo('imapConnector', `Saved attachment for uid=${message.uid} -> ${destPath}`);
            idx++;
          }
        } else {
          // fallback: if no attachments, save the raw message
          if (message.source) {
            const safeSubj = subject.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
            const emlName = `${message.uid}_${safeSubj}.eml`;
            const emlPath = path.join(destDir, emlName);
            await fs.writeFile(emlPath, message.source as Buffer);
            saved.push({ filename: emlName, path: emlPath, uid: message.uid, subject });
            logInfo('imapConnector', `Saved raw EML uid=${message.uid} -> ${emlPath}`);
          }
        }

        if (cfg.markSeen) {
          try { await client.messageFlagsAdd(message.uid, ['\\Seen']); } catch (err) { /* ignore */ }
        }
      } catch (inner) {
        logError('imapConnector', `Failed to extract/save attachments: ${String(inner)}`);
      }
    }

    return saved;
  } catch (e) {
    logError('imapConnector', `Error in fetchAndExtractAttachments: ${String(e)}`);
    return [];
  } finally {
    try { await client.logout(); } catch (e) { /* ignore */ }
  }
}
