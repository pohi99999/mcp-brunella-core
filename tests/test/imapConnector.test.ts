import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mkdirp: vi.fn(),
  writeFile: vi.fn(),
  simpleParser: vi.fn(),
  imapConstructor: vi.fn(),
  connect: vi.fn(),
  mailboxOpen: vi.fn(),
  search: vi.fn(),
  messageFlagsAdd: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: {
    mkdirp: mocks.mkdirp,
    writeFile: mocks.writeFile,
  },
  mkdirp: mocks.mkdirp,
  writeFile: mocks.writeFile,
}));

vi.mock('mailparser', () => ({
  simpleParser: mocks.simpleParser,
}));

vi.mock('imapflow', () => ({
  ImapFlow: mocks.imapConstructor,
}));

function makeAsyncIterable(messages: Array<Record<string, unknown>>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const message of messages) {
        yield message;
      }
    },
  };
}

describe('imapConnector / attachment intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.imapConstructor.mockImplementation(() => ({
      connect: mocks.connect,
      mailboxOpen: mocks.mailboxOpen,
      search: mocks.search,
      fetch: vi.fn(),
      messageFlagsAdd: mocks.messageFlagsAdd,
      logout: mocks.logout,
    }));

    mocks.connect.mockResolvedValue(undefined);
    mocks.mailboxOpen.mockResolvedValue(undefined);
    mocks.messageFlagsAdd.mockResolvedValue(undefined);
    mocks.logout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should store raw messages under the inbox default directory', async () => {
    const { fetchEmailsAsEml } = await import('../src/connectors/imapConnector.js');

    mocks.search.mockResolvedValue([101]);
    const fetch = vi.fn().mockReturnValue(
      makeAsyncIterable([
        {
          uid: 101,
          envelope: { subject: 'Invoice from Alpha' },
          source: Buffer.from('raw email payload'),
        },
      ]),
    );
    mocks.imapConstructor.mockImplementation(() => ({
      connect: mocks.connect,
      mailboxOpen: mocks.mailboxOpen,
      search: mocks.search,
      fetch,
      messageFlagsAdd: mocks.messageFlagsAdd,
      logout: mocks.logout,
    }));

    const result = await fetchEmailsAsEml({
      host: 'imap.example.com',
      auth: { user: 'user@example.com', pass: 'secret' },
    });

    const expectedDir = path.join(process.cwd(), 'data', 'inbox');

    expect(result).toHaveLength(1);
    expect(mocks.mkdirp).toHaveBeenCalledWith(expectedDir);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      path.join(expectedDir, '101_Invoice from Alpha.eml'),
      Buffer.from('raw email payload'),
    );
    expect(mocks.messageFlagsAdd).not.toHaveBeenCalled();
  });

  it('should honor a custom destination directory and mark messages as seen', async () => {
    const { fetchEmailsAsEml } = await import('../src/connectors/imapConnector.js');
    const customDir = path.join(process.cwd(), 'temp', 'imap-custom');

    mocks.search.mockResolvedValue([202]);
    const fetch = vi.fn().mockReturnValue(
      makeAsyncIterable([
        {
          uid: 202,
          envelope: { subject: 'számla - Beta' },
          source: Buffer.from('custom raw email'),
        },
      ]),
    );
    mocks.imapConstructor.mockImplementation(() => ({
      connect: mocks.connect,
      mailboxOpen: mocks.mailboxOpen,
      search: mocks.search,
      fetch,
      messageFlagsAdd: mocks.messageFlagsAdd,
      logout: mocks.logout,
    }));

    const result = await fetchEmailsAsEml({
      host: 'imap.example.com',
      auth: { user: 'user@example.com', pass: 'secret' },
      destDir: customDir,
      markSeen: true,
    });

    expect(result).toHaveLength(1);
    expect(mocks.mkdirp).toHaveBeenCalledWith(customDir);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      path.join(customDir, '202_számla - Beta.eml'),
      Buffer.from('custom raw email'),
    );
    expect(mocks.messageFlagsAdd).toHaveBeenCalledWith(202, ['\\Seen']);
  });

  it('should extract attachments into the inbox default directory', async () => {
    const { fetchAndExtractAttachments } = await import('../src/connectors/imapConnector.js');

    mocks.search.mockResolvedValue([303]);
    mocks.simpleParser.mockResolvedValue({
      attachments: [
        {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
          size: 1234,
          content: Buffer.from('pdf-bytes'),
        },
      ],
    });
    const fetch = vi.fn().mockReturnValue(
      makeAsyncIterable([
        {
          uid: 303,
          envelope: { subject: 'invoice - Gamma' },
          source: Buffer.from('mime email with attachment'),
        },
      ]),
    );
    mocks.imapConstructor.mockImplementation(() => ({
      connect: mocks.connect,
      mailboxOpen: mocks.mailboxOpen,
      search: mocks.search,
      fetch,
      messageFlagsAdd: mocks.messageFlagsAdd,
      logout: mocks.logout,
    }));

    const result = await fetchAndExtractAttachments({
      host: 'imap.example.com',
      auth: { user: 'user@example.com', pass: 'secret' },
    });

    const expectedDir = path.join(process.cwd(), 'data', 'inbox');

    expect(result).toHaveLength(1);
    expect(mocks.simpleParser).toHaveBeenCalledWith(Buffer.from('mime email with attachment'));
    expect(mocks.writeFile).toHaveBeenCalledWith(
      path.join(expectedDir, '303_invoice.pdf'),
      Buffer.from('pdf-bytes'),
    );
  });

  it('should fall back to raw EML when no attachments are present', async () => {
    const { fetchAndExtractAttachments } = await import('../src/connectors/imapConnector.js');

    mocks.search.mockResolvedValue([404]);
    mocks.simpleParser.mockResolvedValue({ attachments: [] });
    const fetch = vi.fn().mockReturnValue(
      makeAsyncIterable([
        {
          uid: 404,
          envelope: { subject: 'invoice - Delta' },
          source: Buffer.from('raw mime body'),
        },
      ]),
    );
    mocks.imapConstructor.mockImplementation(() => ({
      connect: mocks.connect,
      mailboxOpen: mocks.mailboxOpen,
      search: mocks.search,
      fetch,
      messageFlagsAdd: mocks.messageFlagsAdd,
      logout: mocks.logout,
    }));

    const result = await fetchAndExtractAttachments({
      host: 'imap.example.com',
      auth: { user: 'user@example.com', pass: 'secret' },
    });

    const expectedDir = path.join(process.cwd(), 'data', 'inbox');

    expect(result).toHaveLength(1);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      path.join(expectedDir, '404_invoice - Delta.eml'),
      Buffer.from('raw mime body'),
    );
  });
});