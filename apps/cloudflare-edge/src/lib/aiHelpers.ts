// Helper utilities for resilient AI response handling in Cloudflare Worker package
export function parseAiResponse(aiRaw: unknown): { text: string; tokens: number } {
  try {
    if (!aiRaw) return { text: '', tokens: 0 };
    // Common shapes
    const raw = aiRaw as Record<string, unknown>;

    // OpenAI/GitHub-like choices.message.content
    if (Array.isArray(raw.choices) && raw.choices.length > 0) {
      const c0 = raw.choices[0];
      if (c0?.message?.content && typeof c0.message.content === 'string') return { text: String(c0.message.content), tokens: Number(raw.usage?.total_tokens || raw.usage?.totalTokens || 0) };
      if (typeof c0?.text === 'string') return { text: String(c0.text), tokens: Number(raw.usage?.total_tokens || raw.usage?.totalTokens || 0) };
    }

    // Cloudflare Workers AI / other simple providers
    if (typeof raw.response === 'string') return { text: String(raw.response), tokens: Number(raw.usage?.total_tokens || raw.usage?.totalTokens || 0) };
    if (typeof raw.result === 'string') return { text: String(raw.result), tokens: Number(raw.usage?.total_tokens || raw.usage?.totalTokens || 0) };

    // Some providers return a top-level string
    if (typeof aiRaw === 'string') return { text: aiRaw, tokens: 0 };

    // Fallback: try to stringify common fields
    if (typeof raw.text === 'string') return { text: raw.text, tokens: Number(raw.usage?.total_tokens || raw.usage?.totalTokens || 0) };

    // Last resort: JSON stringify
    return { text: JSON.stringify(raw), tokens: Number(raw.usage?.total_tokens || raw.usage?.totalTokens || 0) };
  } catch (e) {
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
    const raw = aiRaw as Record<string, unknown>;
    if (Array.isArray(raw.data) && raw.data.length > 0) {
      const first = raw.data[0];
      if (Array.isArray(first)) return first as number[];
      if (Array.isArray(first.embedding)) return first.embedding as number[];
    }
    if (Array.isArray(raw.embedding)) return raw.embedding as number[];
    return null;
  } catch {
    return null;
  }
}
