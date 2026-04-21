import fs from 'fs/promises';
import path from 'path';

const samplesDir = path.join(process.cwd(), 'conductor', 'tracks', 'konyveles_automatizalas', 'resources', 'samples');

async function parseBankCsv(csvPath) {
  const txt = await fs.readFile(csvPath, 'utf-8');
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = lines.map(l => l.split(',').map(p => p.replace(/^"|"$/g, '').trim()));
  const header = rows[0].map(h => h.toLowerCase());
  const idxDate = header.findIndex(h => h.includes('date'));
  const idxAmount = header.findIndex(h => h.includes('amount') || h.includes('sum') || h.includes('price'));
  const idxDesc = header.findIndex(h => h.includes('description') || h.includes('desc') || h.includes('partner'));
  const txs = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const date = idxDate >= 0 ? row[idxDate] : row[0];
    const amountStr = idxAmount >= 0 ? row[idxAmount] : row[1] ?? '0';
    const description = idxDesc >= 0 ? row[idxDesc] : row.slice(2).join(' ');
    const amount = Number(amountStr.replace(/[^0-9.-]/g, '') || 0);
    txs.push({ date, amount, description });
  }
  return txs;
}

async function parseInvoicePlaceholders(dir) {
  const files = await fs.readdir(dir);
  const invoices = [];
  for (const f of files) {
    if (!f.toLowerCase().endsWith('.txt') && !f.toLowerCase().endsWith('.xml')) continue;
    const p = path.join(dir, f);
    const txt = await fs.readFile(p, 'utf-8');
    if (f.toLowerCase().endsWith('.txt')) {
      const lines = txt.split(/\r?\n/).map(l => l.trim());
      const get = (prefix) => {
        const line = lines.find(ln => ln.toLowerCase().startsWith(prefix.toLowerCase()));
        return line ? line.split(':').slice(1).join(':').trim() : undefined;
      };
      const invoice_number = get('Invoice ID') || get('Invoice');
      const net = Number(get('Net') || 0);
      const vat = Number(get('VAT') || 0);
      const gross = Number(get('Gross') || 0);
      const issueDate = get('IssueDate') || get('Issue Date');
      invoices.push({ invoice_number, net, vat, gross, issueDate, source: p });
    } else {
      // simple xml parse for sample NAV xml
      const m = txt.match(/<InvoiceNumber>([^<]+)<\/InvoiceNumber>/i) || txt.match(/<invoiceNumber>([^<]+)<\/invoiceNumber>/i);
      const invoice_number = m ? m[1].trim() : undefined;
      const grossM = txt.match(/<GrossAmount[^>]*>([^<]+)<\/GrossAmount>/i) || txt.match(/<gross>([^<]+)<\/gross>/i);
      const gross = grossM ? Number(grossM[1].replace(/[^0-9.-]/g, '')) : undefined;
      const dateM = txt.match(/<IssueDate[^>]*>([^<]+)<\/IssueDate>/i) || txt.match(/<issueDate>([^<]+)<\/issueDate>/i);
      const issueDate = dateM ? dateM[1].trim() : undefined;
      const partnerM = txt.match(/<PartnerTaxID[^>]*>([^<]+)<\/PartnerTaxID>/i) || txt.match(/<partnerTaxId>([^<]+)<\/partnerTaxId>/i);
      const partner = partnerM ? partnerM[1].trim() : undefined;
      invoices.push({ invoice_number, gross, issueDate, partner, source: p });
    }
  }
  return invoices;
}

function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return Infinity;
  const diff = Math.abs(d1 - d2);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function match(txs, invoices, opts = {}) {
  const dateTol = opts.dateToleranceDays ?? 3;
  const amtTol = opts.amountTolerance ?? 0.5;
  const results = [];
  for (const tx of txs) {
    let best = { invoice: null, score: 0 };
    for (const inv of invoices) {
      let score = 0;
      if (typeof inv.gross === 'number' && Math.abs(inv.gross - tx.amount) <= amtTol) score += 60;
      if (typeof inv.net === 'number' && Math.abs(inv.net - tx.amount) <= amtTol) score += 50;
      if (inv.issueDate) {
        const dd = daysBetween(inv.issueDate, tx.date);
        if (dd <= dateTol) score += Math.max(0, 30 - dd * 8);
      }
      if (inv.partner && tx.description && tx.description.toLowerCase().includes(String(inv.partner).toLowerCase())) score += 15;
      if (inv.invoice_number && tx.description && tx.description.includes(String(inv.invoice_number))) score += 20;
      if (score > best.score) best = { invoice: inv, score };
    }
    results.push({ tx, invoice: best.invoice, score: best.score });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

async function run() {
  try {
    console.log('Discovery run: loading samples from', samplesDir);
    const bankPath = path.join(samplesDir, 'bank_transactions.csv');
    const txs = await parseBankCsv(bankPath);
    const invoices = await parseInvoicePlaceholders(samplesDir);
    console.log(`Parsed ${txs.length} bank transactions and ${invoices.length} invoices`);
    const matches = match(txs, invoices);
    const outDir = path.join(process.cwd(), 'data', 'konyveles');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, 'match_results.json');
    await fs.writeFile(outPath, JSON.stringify({ txCount: txs.length, invoiceCount: invoices.length, matches }, null, 2));
    console.log('Match results saved to', outPath);
    for (const m of matches.slice(0, 20)) {
      console.log(`Score ${m.score} -> tx ${m.tx.date} ${m.tx.amount} => invoice ${m.invoice?.invoice_number || 'N/A'} (source: ${m.invoice?.source || 'N/A'})`);
    }
  } catch (e) {
    console.error('Discovery run failed:', e);
  }
}

run();
