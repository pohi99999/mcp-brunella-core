// src/services/anthropicClient.ts
// Minimal Anthropic/Claude helper. Uses global fetch (Node 18+).

export type AnthropicRole = 'user' | 'assistant' | 'system';

export async function sendAnthropicMessage(
  messages: Array<{ role: AnthropicRole; content: string }>,
  model = 'claude-opus-4-6'
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Environment variable ANTHROPIC_API_KEY is not set');
  }

  const url = 'https://api.anthropic.com/v1/messages';
  const payload = { model, messages, thinking: { type: 'adaptive' } };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${txt}`);
  }

  const data = await res.json();

  // Try several known shapes to extract the assistant text
  const content =
    data?.completion?.message?.content ??
    data?.message?.content ??
    (Array.isArray(data?.output) && data.output[0]?.content?.[0]?.text) ??
    data?.text ??
    JSON.stringify(data);

  return String(content);
}
