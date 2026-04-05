import '@testing-library/jest-dom';
import 'dotenv/config';

// Polyfill ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Suppress known benign warnings during UI tests to reduce noise in CI output.
// Specifically: Radix Slot "Function components cannot be given refs" and
// React "not wrapped in act(...)" warnings that are noisy in snapshot runs.
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);
const SUPPRESSED = [
  'Function components cannot be given refs',
  'An update to', // part of the 'not wrapped in act(...)' warning
];

console.warn = (...args: any[]) => {
  try {
    const m = String(args[0] ?? '');
    if (SUPPRESSED.some((s) => m.includes(s))) return;
  } catch { /* suppress */ }
  return _origWarn(...args);
};

console.error = (...args: any[]) => {
  try {
    const m = String(args[0] ?? '');
    if (SUPPRESSED.some((s) => m.includes(s))) return;
  } catch { /* suppress */ }
  return _origError(...args);
};
