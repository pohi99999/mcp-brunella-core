// Common AI response helpers for server-side agents

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function getRecordProperty(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function getNumericTokenCount(value: unknown): number {
  const usage = getRecordProperty(value, 'usage');
  if (!isRecord(usage)) return 0;
  const totalTokens = usage.total_tokens;
  if (typeof totalTokens === 'number') return totalTokens;
  const totalTokensCamel = usage.totalTokens;
  return typeof totalTokensCamel === 'number' ? totalTokensCamel : 0;
}

export function parseAiResponse(aiRaw: unknown): { text: string; tokens: number } {
  try {
    if (!aiRaw) return { text: '', tokens: 0 };

    if (typeof aiRaw === 'string') return { text: aiRaw, tokens: 0 };

    if (isRecord(aiRaw)) {
      const choices = aiRaw.choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const firstChoice = choices[0];
        if (isRecord(firstChoice)) {
          const message = firstChoice.message;
          if (isRecord(message) && typeof message.content === 'string') {
            return { text: String(message.content), tokens: getNumericTokenCount(aiRaw) };
          }

          if (typeof firstChoice.text === 'string') {
            return { text: String(firstChoice.text), tokens: getNumericTokenCount(aiRaw) };
          }
        }
      }

      const response = aiRaw.response;
      if (typeof response === 'string') return { text: String(response), tokens: getNumericTokenCount(aiRaw) };

      const result = aiRaw.result;
      if (typeof result === 'string') return { text: String(result), tokens: getNumericTokenCount(aiRaw) };

      const text = aiRaw.text;
      if (typeof text === 'string') return { text, tokens: getNumericTokenCount(aiRaw) };

      return { text: JSON.stringify(aiRaw), tokens: getNumericTokenCount(aiRaw) };
    }

    return { text: '', tokens: 0 };
  } catch {
    return { text: '', tokens: 0 };
  }
}

export function safeJsonParse<T = unknown>(s: string, fallback: T): T {
  try {
    if (!s || typeof s !== 'string') return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function extractEmbedding(aiRaw: unknown): number[] | null {
  try {
    if (!isRecord(aiRaw)) {
      return null;
    }

    const data = aiRaw.data;
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      if (Array.isArray(first) && first.every((item) => typeof item === 'number')) {
        return first;
      }

      if (isRecord(first)) {
        const embedding = first.embedding;
        if (Array.isArray(embedding) && embedding.every((item) => typeof item === 'number')) {
          return embedding;
        }
      }
    }

    const embedding = aiRaw.embedding;
    if (Array.isArray(embedding) && embedding.every((item) => typeof item === 'number')) {
      return embedding;
    }

    return null;
  } catch {
    return null;
  }
}
