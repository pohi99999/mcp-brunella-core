export function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') {
      return new Error(record.message);
    }

    try {
      return new Error(JSON.stringify(record));
    } catch {
      try {
        return new Error(String(error));
      } catch {
        return new Error('[unserializable error]');
      }
    }
  }

  try {
    return new Error(String(error));
  } catch {
    return new Error('[unserializable error]');
  }
}
