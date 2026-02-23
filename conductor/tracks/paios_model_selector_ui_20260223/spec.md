# Specifikáció: PAIOS ModelSelector UI
**Track ID:** `paios_model_selector_ui_20260223`
**Státusz:** proposed
**Prioritás:** MEDIUM
**Blokkolva:** `paios_orchestrator_chat_20260223` kész kell legyen először

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz | Megjegyzés |
|---|---|---|
| `src/core/modelRouter.ts` | ✅ KÉSZ | 4 provider: GPT-4o, Gemini, Local, Cloudflare |
| `POST /api/paios/chat` | ❌ (más track) | `model` paraméter fogad |
| `GET /api/health` | ✅ KÉSZ | Provider health checkek |
| **ModelSelector.tsx** | ❌ HIÁNYZIK | Ez a track feladata |

---

## 2. Komponens Terv

```tsx
// src/dashboard/components/dashboard/ModelSelector.tsx
interface ModelSelectorProps {
  value: ModelProvider;
  onChange: (model: ModelProvider) => void;
  health?: Record<ModelProvider, 'up' | 'down' | 'unknown'>;
}

type ModelProvider = 'gpt4o' | 'gemini' | 'local' | 'workers';

const MODEL_LABELS: Record<ModelProvider, string> = {
  gpt4o: 'GPT-4o (GitHub Models)',
  gemini: 'Gemini 2.0',
  local: 'Local (Ollama)',
  workers: 'Workers AI (Cloudflare)',
};
```

### Vizuális Terv

```
┌─────────────────────────────────────┐
│ Model:  [ Gemini 2.0        ▼ ] 🟢  │
│         ├ GPT-4o (GitHub) 🟢        │
│         ├ Gemini 2.0       🟢        │
│         ├ Local (Ollama)   🔴 DOWN  │
│         └ Workers AI       🟢        │
└─────────────────────────────────────┘
```

---

## 3. Chat Panel Integráció

A meglévő vagy új chat panel a PAIOS Orchestrator Chat endpointot hívja:

```typescript
// Dashboard chat logika
const [model, setModel] = useState<ModelProvider>('local');

const sendMessage = async (message: string) => {
  const res = await fetch('/api/paios/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, model }),
  });
  const data = await res.json();
  setMessages(prev => [...prev, { role: 'assistant', content: data.summary }]);
};
```

---

## 4. Provider Health Badge

```typescript
// 30 másodpercenként polling
useEffect(() => {
  const poll = setInterval(async () => {
    const res = await fetch('/api/health');
    const health = await res.json();
    setProviderHealth({
      gpt4o: health.github_models?.status === 'healthy' ? 'up' : 'down',
      gemini: health.gemini?.status === 'healthy' ? 'up' : 'down',
      local: health.ollama?.status === 'healthy' ? 'up' : 'down',
      workers: health.cloudflare?.status === 'healthy' ? 'up' : 'down',
    });
  }, 30000);
  return () => clearInterval(poll);
}, []);
```

---

## 5. Függőségek

- `paios_orchestrator_chat_20260223` — `POST /api/paios/chat` endpoint szükséges
- `src/dashboard/lib/apiService.ts` — API client bővítés
- Radix UI Select (már telepítve a projectben)
- Tailwind v4 (már konfigurálva)
