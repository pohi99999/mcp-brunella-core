const fs = require('fs');
const path = 'src/agents/FinancialGuardAgent.ts';
let code = fs.readFileSync(path, 'utf8');

const htmlMethod = `
  // Added to satisfy the requested HTML template modification
  private generateTransactionHTML(tx: any): string {
    let statusColor = 'inherit';
    if (tx.status === 'OK' || tx.status === 'processed' || tx.status === 'success') statusColor = 'green';
    else if (tx.status === 'ERROR' || tx.status === 'error' || tx.status === 'anomaly') statusColor = 'red';
    else if (tx.status === 'duplicate') statusColor = 'orange';

    return \`
      <div>
        <div class="transaction-header">
          <h3>Transaction Details</h3>
        </div>
        <div class="transaction-details">
          <p><strong>ID:</strong> \${tx.id}</p>
          <p><strong>Amount:</strong> \${tx.amount.toFixed(2)}</p>
          <p><strong>Status:</strong> <span style="color: \${statusColor};">\${tx.status}</span></p>
        </div>
      </div>
    \`;
  }
`;

// Insert the method before updateVendorHistory
code = code.replace(
  "  /**\n   * Update vendor history statistics\n   */",
  htmlMethod + "\n  /**\n   * Update vendor history statistics\n   */"
);

fs.writeFileSync(path, code);
console.log("Successfully added generateTransactionHTML to FinancialGuardAgent.ts");
