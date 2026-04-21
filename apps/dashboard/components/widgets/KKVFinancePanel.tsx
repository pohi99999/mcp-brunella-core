import React from 'react';

type Props = {
  totalCount?: number;
  totalAmount?: number;
  byStatus?: Record<string, number>;
};

export default function KKVFinancePanel({ totalCount = 0, totalAmount = 0, byStatus = {} }: Props) {
  return (
    <div data-testid="kkv-finance-panel">
      <h3>KKV Finance Summary</h3>
      <div>Total invoices: {totalCount}</div>
      <div>Total amount: {totalAmount}</div>
      <div>
        By status:
        <ul>
          {Object.entries(byStatus).map(([k, v]) => (
            <li key={k}>
              {k}: {v}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
