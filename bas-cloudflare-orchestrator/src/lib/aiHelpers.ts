export function extractAiText(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const response = record.response ?? record.output ?? record.text;
    if (typeof response === "string") {
      return response;
    }
  }
  return JSON.stringify(result);
}
