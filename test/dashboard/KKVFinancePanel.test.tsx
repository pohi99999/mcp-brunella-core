import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import KKVFinancePanel from '@/components/widgets/KKVFinancePanel';

describe('KKVFinancePanel', () => {
  it('renders summary info', () => {
    render(<KKVFinancePanel totalCount={3} totalAmount={123.45} byStatus={{ paid: 2, unpaid: 1 }} />);
    expect(screen.getByText(/KKV Finance Summary/)).toBeTruthy();
    expect(screen.getByText(/Total invoices/)).toBeTruthy();
    expect(screen.getByText(/Total amount/)).toBeTruthy();
    expect(screen.getByText(/\bpaid\b/)).toBeTruthy();
  });
});
