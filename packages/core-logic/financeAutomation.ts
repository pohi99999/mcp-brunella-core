export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

export type Invoice = {
  id: string;
  amount: number;
  currency?: string;
  status: InvoiceStatus;
};

export function summarizeInvoices(invoices: Invoice[]) {
  const totals = {
    totalCount: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (Number.isFinite(inv.amount) ? inv.amount : 0), 0),
    byStatus: {
      pending: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
    } as Record<InvoiceStatus, { count: number; amount: number }> ,
  };

  for (const inv of invoices) {
    const st: InvoiceStatus = (inv.status ?? 'pending') as InvoiceStatus;
    const bucket = totals.byStatus[st];
    bucket.count += 1;
    bucket.amount += Number.isFinite(inv.amount) ? inv.amount : 0;
  }

  return totals;
}
