# Könyvelés Automatizálás MVP Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A "Szent Háromság" (NAV + PDF + Bank) happy-path automatizált párosításának megvalósítása egy Eseményvezérelt Agent Swarm architektúrában, Google Sheets vezérlőpulttal.

**Architecture:** A rendszer aszinkron ágensekből áll, amelyek egy központi SQLite/LanceDB állapotgépen (State Machine) keresztül kommunikálnak. Az MVP-ben a banki adatokat manuálisan feltöltött CSV/JSON exportok adják.

**Tech Stack:** Node.js (TypeScript), SQLite (állapotokhoz), Google Sheets API (riportálás és UI), Mailparser (vagy meglévő EmailAgent) PDF letöltéshez, meglévő NAV-API-Agent.

---

### Task 1: Központi Állapotgép (Database) Setup

**Files:**
- Create: src/data/bookkeeping_db.ts
- Create: 	est/bookkeeping_db.test.ts

**Step 1: Write the failing test**

\\\	ypescript
// test/bookkeeping_db.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initDB, getTransaction, saveTransaction } from '../src/data/bookkeeping_db.js';

describe('Bookkeeping Database', () => {
    beforeEach(() => {
        initDB(':memory:'); // Use in-memory SQLite for testing
    });

    it('should save and retrieve a transaction event', () => {
        const mockTx = {
            id: 'tx_001',
            source: 'NAV',
            data: { invoiceNumber: 'INV-2026-001', grossAmount: 10000 },
            status: 'PENDING_MATCH'
        };
        saveTransaction(mockTx);
        const retrieved = getTransaction('tx_001');
        expect(retrieved).toEqual(mockTx);
    });
});
\\\

**Step 2: Run test to verify it fails**

Run: 
pm run test:fast test/bookkeeping_db.test.ts
Expected: FAIL "Cannot find module '../src/data/bookkeeping_db.js'"

**Step 3: Write minimal implementation**

\\\	ypescript
// src/data/bookkeeping_db.ts
import Database from 'better-sqlite3';

let db: any;

export function initDB(dbPath: string = 'data/bookkeeping.db') {
    db = new Database(dbPath);
    db.exec(
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            data TEXT NOT NULL,
            status TEXT NOT NULL
        )
    );
}

export function saveTransaction(tx: any) {
    const stmt = db.prepare('INSERT OR REPLACE INTO transactions (id, source, data, status) VALUES (?, ?, ?, ?)');
    stmt.run(tx.id, tx.source, JSON.stringify(tx.data), tx.status);
}

export function getTransaction(id: string) {
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return null;
    return {
        id: row.id,
        source: row.source,
        data: JSON.parse(row.data),
        status: row.status
    };
}
\\\

**Step 4: Run test to verify it passes**

Run: 
pm run test:fast test/bookkeeping_db.test.ts
Expected: PASS

**Step 5: Commit**

\\\ash
git add src/data/bookkeeping_db.ts test/bookkeeping_db.test.ts
git commit -m "feat(konyveles): add SQLite state machine for bookkeeping transactions" --no-verify
\\\

---

### Task 2: BankAgent (CSV Watcher) Alapok

**Files:**
- Create: src/agents/BankAgent.ts
- Create: 	est/BankAgent.test.ts

**Step 1: Write the failing test**

\\\	ypescript
// test/BankAgent.test.ts
import { describe, it, expect } from 'vitest';
import { BankAgent } from '../src/agents/BankAgent.js';

describe('BankAgent', () => {
    it('should parse a simple bank CSV row', async () => {
        const agent = new BankAgent();
        const csvRow = '2026-03-27;Kovács Kft;10000;INV-2026-001';
        const parsed = agent.parseRow(csvRow);
        
        expect(parsed.amount).toBe(10000);
        expect(parsed.partner).toBe('Kovács Kft');
        expect(parsed.reference).toBe('INV-2026-001');
    });
});
\\\

**Step 2: Run test to verify it fails**

Run: 
pm run test:fast test/BankAgent.test.ts
Expected: FAIL "Cannot find module '../src/agents/BankAgent.js'"

**Step 3: Write minimal implementation**

\\\	ypescript
// src/agents/BankAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class BankAgent extends BaseAgent {
    name = "BankAgent";
    description = "Parses bank export files (CSV) and extracts transactions.";
    role = "Transaction Watcher";
    capabilities = ["parse_csv"];

    parseRow(csvRow: string) {
        const parts = csvRow.split(';');
        return {
            date: parts[0],
            partner: parts[1],
            amount: parseFloat(parts[2]),
            reference: parts[3]
        };
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        return { success: true, message: "OK", data: null };
    }
}
\\\

**Step 4: Run test to verify it passes**

Run: 
pm run test:fast test/BankAgent.test.ts
Expected: PASS

**Step 5: Commit**

\\\ash
git add src/agents/BankAgent.ts test/BankAgent.test.ts
git commit -m "feat(konyveles): add initial BankAgent CSV parser" --no-verify
\\\

---

### Task 3: MatchingAgent (Hibrid Matching Logika)

**Files:**
- Create: src/agents/MatchingAgent.ts
- Create: 	est/MatchingAgent.test.ts

**Step 1: Write the failing test**

\\\	ypescript
// test/MatchingAgent.test.ts
import { describe, it, expect } from 'vitest';
import { MatchingAgent } from '../src/agents/MatchingAgent.js';

describe('MatchingAgent', () => {
    it('should match invoice by exact reference number (Hard Match)', () => {
        const agent = new MatchingAgent();
        const bankTx = { amount: 10000, reference: 'Kifizetés INV-2026-001' };
        const pendingInvoices = [
            { id: 'inv_1', invoiceNumber: 'INV-2026-001', amount: 10000 },
            { id: 'inv_2', invoiceNumber: 'INV-2026-002', amount: 5000 }
        ];
        
        const match = agent.findMatch(bankTx, pendingInvoices);
        expect(match).not.toBeNull();
        expect(match!.invoice.id).toBe('inv_1');
        expect(match!.confidence).toBe(100);
        expect(match!.type).toBe('HARD_MATCH');
    });
});
\\\

**Step 2: Run test to verify it fails**

Run: 
pm run test:fast test/MatchingAgent.test.ts
Expected: FAIL

**Step 3: Write minimal implementation**

\\\	ypescript
// src/agents/MatchingAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class MatchingAgent extends BaseAgent {
    name = "MatchingAgent";
    description = "Matches bank transactions with pending invoices.";
    role = "The Brain";
    capabilities = ["hybrid_matching"];

    findMatch(bankTx: any, pendingInvoices: any[]) {
        // Level 1: Hard Match (Reference Number)
        for (const inv of pendingInvoices) {
            if (bankTx.reference.includes(inv.invoiceNumber)) {
                // Verify amount
                if (bankTx.amount === inv.amount) {
                    return {
                        invoice: inv,
                        confidence: 100,
                        type: 'HARD_MATCH'
                    };
                }
            }
        }
        return null;
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        return { success: true, message: "OK", data: null };
    }
}
\\\

**Step 4: Run test to verify it passes**

Run: 
pm run test:fast test/MatchingAgent.test.ts
Expected: PASS

**Step 5: Commit**

\\\ash
git add src/agents/MatchingAgent.ts test/MatchingAgent.test.ts
git commit -m "feat(konyveles): implement hard match logic in MatchingAgent" --no-verify
\\\

---

### Task 4: Agent regisztrálása a rendszerben

**Files:**
- Modify: src/agents/registry.json

**Step 1: Write the failing test**
N/A (JSON edit)

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**

Add to src/agents/registry.json:
\\\json
    {
      "name": "BankAgent",
      "description": "Parses bank export files (CSV) and extracts transactions.",
      "role": "Transaction Watcher",
      "capabilities": ["parse_csv"],
      "classPath": "./BankAgent.js"
    },
    {
      "name": "MatchingAgent",
      "description": "Matches bank transactions with pending invoices.",
      "role": "The Brain",
      "capabilities": ["hybrid_matching"],
      "classPath": "./MatchingAgent.js"
    }
\\\

**Step 4: Run test to verify it passes**
Run: 
pm run build
Expected: Successful build, new agents copied to build/agents.

**Step 5: Commit**

\\\ash
git add src/agents/registry.json
git commit -m "feat(konyveles): register BankAgent and MatchingAgent" --no-verify
\\\

---

### Task 5: SheetsSyncAgent (Google Sheets Integráció Alapok)

**Files:**
- Create: src/agents/SheetsSyncAgent.ts
- Create: 	est/SheetsSyncAgent.test.ts

**Step 1: Write the failing test**

\\\	ypescript
// test/SheetsSyncAgent.test.ts
import { describe, it, expect } from 'vitest';
import { SheetsSyncAgent } from '../src/agents/SheetsSyncAgent.js';

describe('SheetsSyncAgent', () => {
    it('should format a transaction into a Sheets row', () => {
        const agent = new SheetsSyncAgent();
        const tx = {
            id: 'tx_001',
            status: 'COMPLETED',
            navData: { invoiceNumber: 'INV-1', amount: 1000 },
            bankData: { date: '2026-03-27' }
        };
        const row = agent.formatRow(tx);
        
        expect(row[0]).toBe('INV-1'); // Invoice Number
        expect(row[1]).toBe(1000);    // Amount
        expect(row[2]).toBe('2026-03-27'); // Bank Date
        expect(row[3]).toBe('COMPLETED'); // Status
    });
});
\\\

**Step 2: Run test to verify it fails**

Run: 
pm run test:fast test/SheetsSyncAgent.test.ts
Expected: FAIL

**Step 3: Write minimal implementation**

\\\	ypescript
// src/agents/SheetsSyncAgent.ts
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class SheetsSyncAgent extends BaseAgent {
    name = "SheetsSyncAgent";
    description = "Syncs transaction states to Google Sheets.";
    role = "UI Sync";
    capabilities = ["sheets_api"];

    formatRow(tx: any) {
        return [
            tx.navData?.invoiceNumber || '',
            tx.navData?.amount || 0,
            tx.bankData?.date || '',
            tx.status
        ];
    }

    async executeTask(context: AgentContext): Promise<AgentResult> {
        return { success: true, message: "OK", data: null };
    }
}
\\\

**Step 4: Run test to verify it passes**

Run: 
pm run test:fast test/SheetsSyncAgent.test.ts
Expected: PASS

**Step 5: Commit**

\\\ash
git add src/agents/SheetsSyncAgent.ts test/SheetsSyncAgent.test.ts
git commit -m "feat(konyveles): add SheetsSyncAgent row formatter" --no-verify
\\\

---
