export interface TrackDodChecklist {
  tests_pass: boolean;
  build_clean: boolean;
  code_committed: boolean;
  no_verify_used: boolean;
}

export const DEFAULT_TRACK_DOD: TrackDodChecklist = {
  tests_pass: false,
  build_clean: false,
  code_committed: false,
  no_verify_used: false,
};

export function normalizeTrackDod(value: unknown): TrackDodChecklist {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_TRACK_DOD };
  }

  const record = value as Record<string, unknown>;
  return {
    tests_pass: record.tests_pass === true,
    build_clean: record.build_clean === true,
    code_committed: record.code_committed === true,
    no_verify_used: record.no_verify_used === true,
  };
}
