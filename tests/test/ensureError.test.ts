import { describe, expect, it } from 'vitest';
import { ensureError } from '@packages/utils/ensureError.js';

describe('ensureError', () => {
  it('returns the original Error instance unchanged', () => {
    const original = new Error('boom');

    expect(ensureError(original)).toBe(original);
  });

  it('converts strings to Error instances', () => {
    const result = ensureError('boom');

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('boom');
  });

  it('uses a message property when available', () => {
    const result = ensureError({ message: 'structured boom', code: 'E_FAIL' });

    expect(result.message).toBe('structured boom');
  });

  it('falls back to serializing plain objects', () => {
    const result = ensureError({ code: 'E_FAIL' });

    expect(result.message).toContain('E_FAIL');
  });
});
