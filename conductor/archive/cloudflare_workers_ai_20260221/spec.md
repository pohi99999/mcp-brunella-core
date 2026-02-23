# Spec: Cloudflare Workers AI Integráció

**Track ID:** `cloudflare_workers_ai_20260221`

---

## Technikai Specifikáció

### API Endpoint

```
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}
Authorization: Bearer {CF_AI_API_TOKEN}
Content-Type: application/json

Body (chat): { "messages": [{ "role": "user", "content": "..." }] }
Body (text): { "prompt": "..." }

Response: { "result": { "response": "..." }, "success": true }
```

### Elérhető Modellek (Paid tier)

| Model | Paraméter | Használat |
|-------|-----------|-----------|
| `@cf/meta/llama-3.3-70b-instruct` | 70B | Orchestrátor, komplex tervezés |
| `@cf/meta/llama-3.1-8b-instruct` | 8B | Gyors feladatok, EV Hunter |
| `@cf/mistral/mistral-7b-instruct-v0.1` | 7B | Fallback |
| `@cf/baai/bge-small-en-v1.5` | 33M | Embedding (Vectorize-hoz) |
| `@cf/google/gemma-7b-it` | 7B | Alternatív |

### Env Változók

```env
CF_ACCOUNT_ID=dd107933ac970dac857f27cee7a7ff46
CF_AI_API_TOKEN=...          # Workers AI + AI Gateway scope
CF_AI_ENABLED=true           # false → Gemini/Ollama fallback
CF_AI_DEFAULT_MODEL=@cf/meta/llama-3.3-70b-instruct
CF_AI_FAST_MODEL=@cf/meta/llama-3.1-8b-instruct
```

### TypeScript Interface

```typescript
// src/core/llm_client.ts bővítés
export type LLMProvider = 'ollama' | 'gemini' | 'github' | 'cloudflare';

export interface CFAIConfig {
  accountId: string;
  apiToken: string;
  defaultModel: string;
  fastModel: string;
}

async function generateCF(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string>
```

### Fallback Sorrend

```
CF AI (ha CF_AI_ENABLED=true és token megvan)
  ↓ (hiba / 429 / timeout)
Gemini (ha GEMINI_API_KEY megvan)
  ↓ (hiba / quota)
Ollama (mindig elérhető, ha ollama serve fut)
  ↓ (hiba)
Error visszaadás
```

### Python EV Hunter integráció

```python
# EV_HUNTER_LLM=cloudflare
class CloudflareAILLM:
    """Egyszerű REST wrapper Cloudflare Workers AI-hoz"""
    def __init__(self, account_id: str, api_token: str, model: str):
        self.url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
        self.headers = {"Authorization": f"Bearer {api_token}"}

    def invoke(self, messages) -> str:
        payload = {"messages": [{"role": m.type, "content": m.content} for m in messages]}
        r = requests.post(self.url, json=payload, headers=self.headers, timeout=30)
        return r.json()["result"]["response"]
```

### Tesztelési Stratégia

```typescript
// test/llm_client.test.ts
it('generateCF returns text from Cloudflare AI', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ result: { response: 'Test response' }, success: true })
  });
  const result = await generateCF('@cf/meta/llama-3.1-8b-instruct', 'Hello');
  expect(result).toBe('Test response');
});
```
