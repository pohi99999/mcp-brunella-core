import fs from 'fs/promises';
import path from 'path';

export interface BrunellaFoszalEntry {
  date?: string;
  time: string;
  agent: string;
  title: string;
  status?: string;
  files: string[];
}

const FOSZAL_PATH = path.join(process.cwd(), '.ai', 'FOSZAL.md');

export function parseRecentFoszalEntries(content: string, limit = 5): BrunellaFoszalEntry[] {
  const entries: BrunellaFoszalEntry[] = [];
  const lines = content.split(/\r?\n/);
  let currentDate: string | undefined;

  for (let i = 0; i < lines.length; i += 1) {
    const dateMatch = lines[i].match(/^###\s+(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    const entryMatch = lines[i].match(/^####\s+([0-9]{2}:[0-9]{2})\s+-\s+\[(.+?)\]\s+(.+)$/);
    if (!entryMatch) {
      continue;
    }

    const [, time, agent, title] = entryMatch;
    const files: string[] = [];
    let status: string | undefined;

    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.startsWith('#### ') || line.startsWith('### ')) {
        break;
      }

      const statusMatch = line.match(/^\s*-\s+\*\*Státusz:\*\*\s*(.+)$/);
      if (statusMatch) {
        status = statusMatch[1].trim();
      }

      const filesMatch = line.match(/^\s*-\s+\*\*Érintett fájlok:\*\*\s*(.+)$/);
      if (filesMatch) {
        const values = filesMatch[1]
          .split(',')
          .map((file) => file.trim().replace(/^`|`$/g, ''))
          .filter(Boolean);
        files.push(...values);
      }
    }

    entries.push({ date: currentDate, time, agent, title, status, files });
    if (entries.length >= limit) {
      break;
    }
  }

  return entries;
}

export async function readRecentFoszalEntries(limit = 5): Promise<BrunellaFoszalEntry[]> {
  const content = await fs.readFile(FOSZAL_PATH, 'utf-8');
  return parseRecentFoszalEntries(content, limit);
}
