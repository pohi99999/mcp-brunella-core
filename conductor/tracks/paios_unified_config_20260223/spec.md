# Specifikáció: PAIOS Unified Config Réteg
**Track ID:** `paios_unified_config_20260223`
**Státusz:** proposed
**Prioritás:** LOW

---

## 1. Miért szükséges?

A jelenlegi konfiguráció szétszórt:
- `.env` — LLM API kulcsok, URL-ek
- `src/agents/registry.json` — agent registry
- `src/config/schema.ts` — Zod validáció (részleges)
- `conductor/tracks/` — projekt management

Nincs egyetlen hely, ahol az összes **PAIOS-specifikus** beállítás dokumentálva és validálva van.

---

## 2. paios.config.yaml séma

```yaml
# paios.config.yaml — PAIOS 1.0 Unified Config

orchestrator:
  default_model: local        # gpt4o | gemini | local | workers
  system_prompt_path: src/orchestrator/systemPrompt/paios_orchestrator_prompt.md
  max_tasks_per_request: 5    # LLM max ennyi task-ot bonthat ki egyszerre

providers:
  gpt4o:
    enabled: true
    model: gpt-4o
    api_key_env: GITHUB_MODELS_API_KEY
  gemini:
    enabled: true
    model: gemini-2.0-flash
    api_key_env: GEMINI_API_KEY
  local:
    enabled: true
    model: qwen2.5-coder:7b
    base_url_env: OLLAMA_BASE_URL
  workers:
    enabled: false
    gateway_url_env: CLOUDFLARE_WORKER_URL
    api_key_env: CEAN_API_KEY

phoenix:
  retry_max_attempts: 3
  retry_base_delay_ms: 1000
  checkpoint_interval_ms: 30000
  heartbeat_interval_ms: 5000

dashboard:
  base_url: http://localhost:5173
  chat_panel_enabled: true
  phoenix_events_enabled: true
  model_selector_enabled: true
```

---

## 3. TypeScript Séma (Zod)

```typescript
// src/config/paiosConfig.ts
import { z } from 'zod';
import yaml from 'js-yaml';
import fs from 'fs';

const ProviderSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string(),
  api_key_env: z.string().optional(),
  base_url_env: z.string().optional(),
  gateway_url_env: z.string().optional(),
});

const PAIOSConfigSchema = z.object({
  orchestrator: z.object({
    default_model: z.enum(['gpt4o', 'gemini', 'local', 'workers']).default('local'),
    system_prompt_path: z.string(),
    max_tasks_per_request: z.number().default(5),
  }),
  providers: z.object({
    gpt4o: ProviderSchema.optional(),
    gemini: ProviderSchema.optional(),
    local: ProviderSchema.optional(),
    workers: ProviderSchema.optional(),
  }),
  phoenix: z.object({
    retry_max_attempts: z.number().default(3),
    retry_base_delay_ms: z.number().default(1000),
    checkpoint_interval_ms: z.number().default(30000),
    heartbeat_interval_ms: z.number().default(5000),
  }).optional(),
  dashboard: z.object({
    base_url: z.string().default('http://localhost:5173'),
    chat_panel_enabled: z.boolean().default(true),
    phoenix_events_enabled: z.boolean().default(true),
    model_selector_enabled: z.boolean().default(true),
  }).optional(),
});

export type PAIOSConfig = z.infer<typeof PAIOSConfigSchema>;

export function loadPaiosConfig(configPath = 'paios.config.yaml'): PAIOSConfig {
  if (!fs.existsSync(configPath)) {
    // .env fallback: alap konfig .env-ből
    return PAIOSConfigSchema.parse({
      orchestrator: { default_model: process.env.PAIOS_DEFAULT_MODEL ?? 'local', system_prompt_path: 'src/orchestrator/systemPrompt/paios_orchestrator_prompt.md' },
      providers: { local: { model: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b', enabled: true } },
    });
  }
  const raw = yaml.load(fs.readFileSync(configPath, 'utf-8'));
  return PAIOSConfigSchema.parse(raw);
}
```

---

## 4. Függőségek

- `paios_orchestrator_chat_20260223` — az orchestratorCore.ts-t ez fogja konfigurálni
- `js-yaml` csomag telepítése szükséges (ha nincs)
- `src/config/schema.ts` — meglévő Zod séma, ezt bővíti/kiegészíti (nem helyettesíti)
