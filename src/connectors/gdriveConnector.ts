import fs from 'fs-extra';
import path from 'path';
import { google } from 'googleapis';
import { logInfo, logError } from '../utils/logger.js';

export type GDriveConfig = {
  keyFile?: string; // service account JSON path
  folderId: string;
  destDir?: string;
};

export async function downloadFilesFromFolder(cfg: GDriveConfig): Promise<Array<{ filename: string; path: string }>> {
  const destDir = cfg.destDir || path.join(process.cwd(), 'data', 'invoices');
  await fs.mkdirp(destDir);

  try {
    const auth = new google.auth.GoogleAuth({ keyFile: cfg.keyFile, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    const client = await auth.getClient();
    // Type workaround: Google Drive expects OAuth2Client, but GoogleAuth.getClient() returns AnyAuthClient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drive = google.drive({ version: 'v3', auth: client as any });

    const res = await drive.files.list({ q: `'${cfg.folderId}' in parents and trashed=false`, fields: 'files(id,name,mimeType)', pageSize: 500 });
    const files = res.data.files || [];
    logInfo('gdriveConnector', `Found ${files.length} files in folder ${cfg.folderId}`);

    const saved: Array<{ filename: string; path: string }> = [];
    for (const f of files) {
      if (!f.id || !f.name) continue;
      const destPath = path.join(destDir, f.name);
      const streamRes = await drive.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'stream' as any });
      await new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(destPath);
        (streamRes.data as any).on('end', () => { resolve(null); })
          .on('error', (err: unknown) => { reject(err); })
          .pipe(dest);
      });
      saved.push({ filename: f.name, path: destPath });
      logInfo('gdriveConnector', `Saved ${f.name} -> ${destPath}`);
    }

    return saved;
  } catch (e) {
    logError('gdriveConnector', `downloadFilesFromFolder error: ${String(e)}`);
    return [];
  }
}
