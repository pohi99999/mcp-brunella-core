# Better-SQLite3 Mocking Strategy

## Problem
The project uses `better-sqlite3` which relies on native C++ bindings. In CI/CD or containerized environments (like the one used during development), these bindings might be missing, compiled for a different architecture, or fail to load. This causes tests to fail with errors like:
`Error: Could not locate the bindings file.`

Using `new Database(':memory:')` inside tests does NOT solve this, as it still requires the native module to be loaded.

## Solution
For unit tests that do not require actual persistence (or where in-memory DB is sufficient but fails to load), the recommended strategy is to **mock the `better-sqlite3` module entirely**.

This avoids the dependency on native bindings during the test execution.

## Implementation Example

In your test file (e.g., using Vitest):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 1. Define the mock structure for Database instance
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
  all: mockAll,
}));
const mockExec = vi.fn();
// Transaction mock: simply executes the callback
const mockTransaction = vi.fn((fn) => (...args: any[]) => fn(...args));

const mockDbInstance = {
  prepare: mockPrepare,
  exec: mockExec,
  transaction: mockTransaction,
  pragma: vi.fn(),
  close: vi.fn(),
};

// 2. Mock 'better-sqlite3' module
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockReturnValue(mockDbInstance),
  };
});

// 3. Mock the utility that provides the DB instance (if applicable)
// This ensures your code under test gets the mocked instance
vi.mock('../../src/utils/globalDb.js', () => ({
  getGlobalDb: () => mockDbInstance,
  closeGlobalDb: vi.fn(),
}));

describe('MyTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset implementations if needed
  });

  it('should execute SQL', () => {
    // ... your test code ...
    // Verify SQL execution via mocks
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'));
  });
});
```

## Benefits
- **Portability**: Tests run on any environment without needing native build tools or correct bindings.
- **Speed**: No actual DB operations.
- **Isolation**: Tests focus on the logic (SQL generation, flow control) rather than DB behavior.
