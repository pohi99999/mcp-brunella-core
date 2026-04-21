-- KKV Data Storage: Invoices and Clients
-- Migration: 0005_kkv_data
-- Description: Tables for KKV (Small/Medium Business) data persistence

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tax_number TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    invoice_number TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'HUF',
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'issued', 'paid', 'cancelled')),
    nav_status TEXT DEFAULT 'pending' CHECK(nav_status IN ('pending', 'sent', 'error', 'accepted')),
    due_date TEXT,
    issued_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_nav_status ON invoices(nav_status);
