# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

- **Reconciliation Events audit trail** (`src/data/bookkeeping_db.ts`): New `reconciliation_events`
  SQLite table with indexes on `run_id` and `tx_id`. Exported functions: `saveReconciliationEvent()`,
  `getReconciliationEvents(runId?, limit?)`, `getExceptionCount()`. Persistent, fault-tolerant record
  of every matching decision made by `MatchingAgent`.

- **Fuzzy matching in MatchingAgent** (`src/agents/MatchingAgent.ts`): New `fuzzyScore()` private
  method scores bank transaction / invoice pairs on amount similarity (exact +60 pts, near ±1% +20 pts),
  partner name (exact +25 pts, partial +15 pts, in-reference +10 pts), and date proximity (same-day
  +25 pts, ≤3 days +15 pts). `findMatch()` first tries the existing exact algorithm and then falls
  back to fuzzy (threshold ≥50 pts, confidence capped at 99). Fuzzy matches set task status to
  `PARTIALLY_MATCHED`.

- **Reconciliation event logging in MatchingAgent** (`src/agents/MatchingAgent.ts`): Every call to
  `executeTask()` generates a `runId` (UUID-style timestamp). A fault-tolerant `persistEvent()`
  helper writes a `ReconciliationEvent` row after each transaction decision; DB errors are caught and
  logged so they never abort a reconciliation run.

- **`GET /api/v1/bookkeeping/reconciliation-events` route** (`src/server/routes/bookkeeping.ts`):
  Returns all reconciliation events with optional `run_id` and `limit` query parameters. Response
  shape: `{ success, events, total, exceptionCount }`.

- **New types** (`src/types/bookkeeping.d.ts`): `ReconciliationOutcome` union type,
  `ReconciliationEvent` interface, and `ReconciliationEventInput` interface.

### Changed

- **BookkeepingWidget live status** (`src/dashboard/components/dashboard/BookkeepingWidget.tsx`):
  Widget now calls `getBookkeepingStatus` on mount and sets up a 30-second polling interval
  (`setInterval`) with proper `clearInterval` cleanup on unmount. Displays live total transaction
  count, pending count (`"Várakozó tételek: N"`), and exception count (`"Kivételek: N"`). Status is
  also refreshed after a successful reconciliation run.

### Tests

- Added 2 new fuzzy-matching tests to `test/MatchingAgent.test.ts`:
  `should return a FUZZY_MATCH when partner partially matches and amounts are identical` and
  `should NOT return a FUZZY_MATCH when score is below threshold`.

- Added 3 new reconciliation-events DB tests to `test/bookkeeping_db.test.ts` covering: save +
  retrieve, filter by `runId`, and exception counting.

- All 18 tests pass (16 backend + 2 dashboard widget). `tsc --noEmit` → 0 errors.
