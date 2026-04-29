import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACK_DOD, normalizeTrackDod } from '@packages/utils/trackDod.js';

describe('trackDod utilities', () => {
  it('returns default checklist for non-object inputs', () => {
    expect(normalizeTrackDod(null)).toEqual(DEFAULT_TRACK_DOD);
    expect(normalizeTrackDod(undefined)).toEqual(DEFAULT_TRACK_DOD);
    expect(normalizeTrackDod('invalid')).toEqual(DEFAULT_TRACK_DOD);
    expect(normalizeTrackDod(123)).toEqual(DEFAULT_TRACK_DOD);
  });

  it('normalizes partial input and keeps missing keys false', () => {
    expect(normalizeTrackDod({ tests_pass: true })).toEqual({
      tests_pass: true,
      build_clean: false,
      code_committed: false,
      no_verify_used: false,
    });
  });

  it('accepts only explicit true values', () => {
    const result = normalizeTrackDod({
      tests_pass: 1,
      build_clean: 'true',
      code_committed: true,
      no_verify_used: {},
    });

    expect(result).toEqual({
      tests_pass: false,
      build_clean: false,
      code_committed: true,
      no_verify_used: false,
    });
  });

  it('ignores unrelated fields', () => {
    const result = normalizeTrackDod({
      tests_pass: true,
      random: true,
      nested: { build_clean: true },
    });

    expect(result).toEqual({
      tests_pass: true,
      build_clean: false,
      code_committed: false,
      no_verify_used: false,
    });
  });

  it('returns a fresh object for defaults to avoid mutating shared constants', () => {
    const result = normalizeTrackDod(undefined);
    result.tests_pass = true;

    expect(DEFAULT_TRACK_DOD.tests_pass).toBe(false);
  });
});
