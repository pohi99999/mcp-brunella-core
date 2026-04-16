---
name: revenue-finance-ops
description: "Use when the user works on leads, campaigns, invoices, bookkeeping, reconciliation, or the Értékesítési Központ surfaces."
---

# Revenue and Finance Operations

Use this skill for the business / finance surfaces of Brunella.

## Trigger conditions

- lead monitor
- demo factory
- showcase
- campaign studio
- invoice sync
- invoice automation
- bookkeeping
- finance reconciliation
- inventory

## Relevant surfaces

- `src/dashboard/lib/navigation.tsx` (`lead-monitor`, `demo-factory`, `showcase`, `campaign-studio`, `leads-master`, `innovation-bridge`, `invoice-sync`, `invoice-automation`, `bookkeeping`, `finance-reconciliation`, `kp-penztar`, `lead-mining`, `marketwatcher`, `inventory`)

## Do

- Keep numbers auditable and explainable.
- Ask before any destructive or settlement-style action.
- Keep invoice, bookkeeping, and reconciliation flows aligned.
- Prefer explicit approvals or confirmations for business-impacting changes.

## Don't

- Auto-post financial changes without confirmation.
- Hide discrepancies or duplicate entries.
- Merge sales operations with accounting logic without a clear boundary.

## Validation

- The selected panel matches the business domain.
- Any summary or report can be reconciled back to source data.
- Approval gates are visible when money or invoices are affected.
