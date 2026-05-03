export function ensureError(error) {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (typeof error === 'object' && error !== null) {
    const record = error;
    if (typeof record.message === 'string') {
      return new Error(record.message);
    }
    try {
      return new Error(JSON.stringify(record));
    } catch {
      return new Error(String(error));
    }
  }
  return new Error(String(error));
}
