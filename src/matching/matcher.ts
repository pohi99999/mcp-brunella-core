import fs from 'fs-extra';
import { parseISO, differenceInCalendarDays } from 'date-fns';
import { logInfo, logError } from '../utils/logger.js';

type BankTx = { date: string; amount: number; currency?: string; description?: string; raw?: Record<string, unknown> };
type Invoice = { id?: string; invoice_number?: string; gross?: number; net?: number; issueDate?: string; partner?: string; source?: string };

export async function parseBankCsv(csvPath: string): Promise<BankTx[]> {
  try {
    const txt = await fs.readFile(csvPath, 'utf-8');
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: string[][] = [];
    for (const line of lines) {
      // naive CSV split (handles simple CSV without embedded commas)
      const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
      rows.push(parts);
    }
    // Try to detect header
    const header = rows[0].map((h) => h.toLowerCase());
    const idxDate = header.findIndex((h) => h.includes('date'));
    const idxAmount = header.findIndex((h) => h.includes('amount') || h.includes('price') || h.includes('sum'));
    const idxDesc = header.findIndex((h) => h.includes('description') || h.includes('desc') || h.includes('partner'));
    const txs: BankTx[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const date = idxDate >= 0 ? row[idxDate] : row[0];
      const amountStr = idxAmount >= 0 ? row[idxAmount] : row[1] ?? '0';
      const description = idxDesc >= 0 ? row[idxDesc] : row.slice(2).join(' ');
      const amount = Number(amountStr.replace(/[^0-9.-]/g, ''));
      txs.push({ date, amount, description, raw: { row } });
    }
    logInfo('matcher', `Parsed ${txs.length} bank transactions from ${csvPath}`);
    return txs;
  } catch (e) {
    logError('matcher', `parseBankCsv error: ${String(e)}`);
    return [];
  }
}

export function matchTransactionsToInvoices(txs: BankTx[], invoices: Invoice[], opts?: { dateToleranceDays?: number; amountTolerance?: number }) {
  const dateTol = opts?.dateToleranceDays ?? 3;
  const amtTol = opts?.amountTolerance ?? 0.5; // tolerance in currency
  const matches: Array<{ tx: BankTx; invoice?: Invoice; score: number }> = [];

  for (const tx of txs) {
    let best: { invoice?: Invoice; score: number } = { invoice: undefined, score: 0 };
    for (const inv of invoices) {
      let score = 0;
      // amount match (gross or net)
      if (typeof inv.gross === 'number' && Math.abs(inv.gross - tx.amount) <= amtTol) score += 60;
      if (typeof inv.net === 'number' && Math.abs(inv.net - tx.amount) <= amtTol) score += 50;
      // date proximity
      if (inv.issueDate) {
        try {
          const d1 = parseISO(String(inv.issueDate));
          const d2 = parseISO(String(tx.date));
          if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
            const dd = Math.abs(differenceInCalendarDays(d1, d2));
            if (dd <= dateTol) score += Math.max(0, 30 - dd * 8);
            // penalize if date is in future far beyond tolerance
            if (d1.getTime() - d2.getTime() > 1000 * 60 * 60 * 24 * 30) score -= 20;
          }
        } catch { }
      }
      // partner name in description
      if (inv.partner && tx.description && tx.description.toLowerCase().includes(String(inv.partner).toLowerCase())) score += 15;
      // invoice id in description
      if (inv.invoice_number && tx.description && tx.description.includes(String(inv.invoice_number))) score += 20;

      if (score > best.score) best = { invoice: inv, score };
    }
    matches.push({ tx, invoice: best.invoice, score: best.score });
  }
  // sort matches by score desc
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
