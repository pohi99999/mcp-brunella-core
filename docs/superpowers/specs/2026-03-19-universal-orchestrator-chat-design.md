# Universal Orchestrator Chat — Design Spec
**Dátum:** 2026-03-19
**Státusz:** Jóváhagyott
**Megbeszélés alapján:** Pohánka Péter + Claude Code

---

## 1. Célkitűzés

A PAIOS Orchestrator Chat legyen a Brunella rendszer **egyetlen, teljes értékű vezérlési központja**. Bármely kiválasztott LLM (Gemini, GitHub Models, Claude, Cloudflare Edge, Qwen) képes legyen:
- Természetes magyar nyelvű utasításokat értelmezni
- Eldönteni: egyszerű válasz szükséges-e, vagy rendszerfolyamatot kell indítani
- Ha nem egyértelmű az utasítás: visszakérdezni
- Ha egyértelmű: delegálni a megfelelő ügynöknek vagy Cloudflare Workernek
- Az eredményt magyar nyelvű összefoglalóban visszaadni

---

## 2. Megközelítés: A+C Hibrid

**A) Native Tool Calling** (Gemini, GitHub Models, Claude, Cloudflare Edge):
A 3 fős AI natív tool calling képességét (functionDeclarations / tools / tool_use) használjuk. Az LLM közvetlenül "látja" az összes elérhető ügynököt tool-ként, és maga dönt a hívásról.

**C) OrchestratorAgent ReAct Loop** (végrehajtási réteg):
A tool hívást nem közvetlenül hajtjuk végre — az OrchestratorAgent meglévő ReAct loop-ján keresztül megy, aki már tudja hogyan kell elérni az AgentManagert és az összes ügynököt. A meglévő kód újrahasznosítva.

**Qwen/Ollama** (könnyített mód):
Structured system prompt + `[DELEGÁLÁS: AgentNév | feladat]` szintaxis — a backend értelmezi és végrehajtja.

---

## 3. Architektúra

```
Felhasználó (magyar szöveg)
        ↓
PAIOSOrchestratorChat UI
[5 mód: Gemini★ | GitHub★ | Claude★ | Cloudflare Edge★ | Qwen]
        ↓
POST /api/orchestrator/universal  (ÚJ endpoint)
        ↓
UniversalOrchestratorService
  ├── Tool Registry (auto-generált registry.json + CF workers alapján)
  ├── Bifrost Gateway (tool calling normalizálás providerenként)
  └── OrchestratorAgent ReAct Loop (végrehajtás)
        ↓
LLM dönt:
  ├── Közvetlen válasz → Magyar szöveg vissza a chatbe
  └── Tool hívás → OrchestratorAgent → AgentManager.delegate()
                        ↓
               47 agent VAGY 12 Cloudflare Worker
                        ↓
               Eredmény → LLM → Magyar összefoglaló
```

---

## 4. Tool Registry

### Forrás és frissítés
- Forrás: `src/agents/registry.json` (47 agent) + Cloudflare Workers lista (12, lásd alább)
- Induláskor egyszer felépül, `fs.watch`-csal figyeli a registry.json változását
- Ha GenesisOrchestrator új ügynököt regisztrál → Tool Registry **automatikusan frissül, újraindítás nélkül**
- **Windows kompatibilitás:** `fs.watch` Windows 11-en ritkán megbízhatatlan (atomic save/rename). Fallback: `fs.watchFile()` polling (500ms intervallum) ha `fs.watch` esemény nem érkezik 30 másodpercen belül.

### Tool definíció formátuma (példa)
```typescript
{
  name: "delegate_RobotkezV2Agent",
  description: "Böngésző automatizálás: weboldalak megnyitása, kattintás, " +
               "n8n workflow beállítás, form kitöltés. Használd ha webes " +
               "böngésző vezérlés szükséges.",
  parameters: {
    task: "string — mit kell elvégezni, részletesen",
    url: "string (opcionális) — kiindulási URL"
  }
}
```

### Rendszer tool-ok (nem agentből)
| Tool neve | Leírás |
|-----------|--------|
| `get_system_status` | Health check, futó agentok, build állapot |
| `list_active_tasks` | Mi fut most, mi áll sorban |
| `run_full_test_suite` | npm test + build, összefoglalóval |
| `get_agent_logs` | Adott agent utolsó N log sora |

### Cloudflare Worker tool-ok (12 db)
A Tool Registry a `docs/cloudflare/INFRASTRUCTURE.md` fájlból és az `src/utils/d1Adapter.ts` konfigurációból olvassa be a worker listát induláskor.

Ismert workerek (6 deployed + 6 planned/CEAN):
```
delegate_CloudflareWorker_CEAN            → Analytics Engine (CEAN)
delegate_CloudflareWorker_D1Bridge        → D1 adatbázis HTTP bridge
delegate_CloudflareWorker_AI              → Workers AI inferencia
delegate_CloudflareWorker_Browser         → Browser Rendering API
delegate_CloudflareWorker_Tunnel          → Cloudflare Tunnel
delegate_CloudflareWorker_AIGateway      → AI Gateway proxy
delegate_CloudflareWorker_R2             → R2 object storage
delegate_CloudflareWorker_KV             → KV namespace
delegate_CloudflareWorker_Vectorize      → Vector search
delegate_CloudflareWorker_DurableObjects → Durable Objects
delegate_CloudflareWorker_Queue          → Cloudflare Queues
delegate_CloudflareWorker_Pages          → Pages Functions
```

---

## 5. Bifrost Gateway kiterjesztés

A meglévő `src/core/bifrost_gateway.ts` bővítése tool calling támogatással.
**Fontos:** nemcsak a tool definíciók *küldése*, hanem a válasz *tool_call blokk kinyerése* is új logika minden providernél.

| Provider | Tool küldés | Tool válasz kinyerés | Jelenlegi állapot |
|----------|-------------|---------------------|-------------------|
| GitHub Models | `payload.tools` + `tool_choice` | `tool_calls[]` (részben kész) | Részlegesen kész |
| Gemini | `functionDeclarations` | `functionCall` blokk kinyerés | **Hiányzik** |
| Claude/Anthropic | `tools` tömb | `tool_use` content block kinyerés | **Hiányzik** |
| Cloudflare Edge | `callCFWorkerModel()` bővítve | Cloudflare tool response parse | Ellenőrizendő |
| Qwen/Ollama | — | — | Structured prompt, nincs tool calling |

**Szükséges módosítások a bifrost_gateway.ts-ben:**
- `generateGemini()`: `functionCall` response block kinyerése a `generateContent()` válaszából
- `generateAnthropic()`: `tool_use` content block kezelése a `messages.create()` válaszában
- `callCFWorkerModel()` ellenőrzése: fogad-e `tools` paramétert, vagy új code path kell

Minden provider ugyanazt a `UniversalToolDefinition[]` tömböt kapja — a Bifrost transzformálja provider-specifikus formátumba.

---

## 6. Backend: Új Endpoint

```typescript
POST /api/orchestrator/universal

Request:
{
  message: string,
  // UI-oldali provider name → Bifrost ProviderType mapping:
  // "gemini"     → "gemini"
  // "github"     → "github"
  // "claude"     → "anthropic"   ← explicit mapping UniversalOrchestratorService-ben
  // "cloudflare" → "cloudflare"
  // "ollama"     → "ollama"
  provider: "gemini" | "github" | "claude" | "cloudflare" | "ollama",
  model?: string,
  conversationHistory: ChatMessage[]
}

Response:
{
  reply: string,
  actionsTriggered: {
    agent: string,
    task: string,
    taskId: number,   // AgentManager.queueTask() number visszatérési értéke (SQLite lastID)
    status: "started" | "completed" | "error"
  }[],
  provider: string,
  thinkingMs: number
}
```

### ChatSendOutput interfész kiterjesztés
A meglévő `ChatSendOutput` (types.ts) kiegészítése opcionális mezőkkel,
visszafelé kompatibilis módon:
```typescript
interface ChatSendOutput {
  message: string;
  thoughts?: string;
  contextUsed?: string;
  executedBy?: string;
  screenshot?: string;
  // ÚJ — csak universal provider tölti ki:
  actionsTriggered?: ActionTriggered[];
  thinkingMs?: number;
}
```

### ChatMode kiterjesztés
`src/dashboard/lib/chat/types.ts`-ben:
```typescript
// ELŐTTE:
type ChatMode = "master_orchestrator" | "orchestrator" | "ollama" |
                "github" | "gemini" | "cloudflare" | "cloudflare_chat";
// UTÁNA (+ new mode, a régiek megmaradnak átmeneti időre):
type ChatMode = ... | "universal";
```
A `providerRegistry.ts` records-ba új bejegyzés: `"universal": universalProvider`.

---

## 7. UI változások (PAIOSOrchestratorChat.tsx)

### Modell-választó (egyszerűsítés)
```
ELŐTTE (7 mód): master_orchestrator | orchestrator | ollama |
                github | gemini | cloudflare | cloudflare_chat

UTÁNA (5 mód):  Gemini ★ | GitHub Models ★ | Claude ★ |
                Cloudflare Edge ★ | Qwen (helyi)
```

### Új: Akció buborék üzenettípus
Delegáláskor a szöveges párbeszédbe egy vizuálisan elkülönülő elem kerül:
```
┌─────────────────────────────────────────────────┐
│ 🔧 Delegálva → RobotkezV2Agent                  │
│    "n8n workflow beállítás az xyxyxy.com-on"    │
│    [Raj sávon követhető ↗]                      │
└─────────────────────────────────────────────────┘
```

### Státusz indikátor
- `⟳ [Provider] gondolkodik...` — LLM hívás folyamatban
- `🔧 Delegálva → [AgentNév]...` — végrehajtás folyamatban
- Hibaállapot: Brunella magyarul közli a hibát + javaslatot ad

### Ami nem változik
- Raj sáv (aktív feladatok valós idejű listája)
- System Health panel (30s frissítés)
- Socket.IO broadcast
- Kontextusablak (MAX_CONTEXT_MESSAGES=10)
- RobotkezV2 saját monitora és chat csatornája (érintetlen)

---

## 8. CLI kiterjesztés

A `brunella chat` parancs ugyanazt az `/api/orchestrator/universal` endpointot hívja:

```bash
brunella chat
> Szia Brunella, futtassunk rendszer ellenőrzést teljes tesztekkel

⟳ Gemini gondolkodik...
🔧 Delegálva → EvaluatorAgent
⏳ Fut... (kövesd: brunella agents status)

Brunella: Kész. 149 teszt átment, build hibátlan. Minden rendszer zöld. ✅
```

Ugyanaz a provider-választó logika, mint a dashboardon (`--provider gemini|github|claude|cloudflare|ollama`).

---

## 9. Érintett fájlok

### Új fájlok
| Fájl | Leírás |
|------|--------|
| `src/core/universalOrchestratorService.ts` | Fő orchestrálási logika |
| `src/core/toolRegistry.ts` | Tool definíciók auto-generálása + fs.watch |
| `src/server/routes/universalOrchestrator.ts` | Új API endpoint |

### Módosított fájlok
| Fájl | Változás |
|------|----------|
| `src/core/bifrost_gateway.ts` | Tool calling normalizálás hozzáadása (5 provider) |
| `src/dashboard/components/dashboard/PAIOSOrchestratorChat.tsx` | 5 mód, akció buborék |
| `src/dashboard/lib/chat/providerRegistry.ts` | Universal provider regisztrálása |
| `src/dashboard/lib/chat/providers/universalProvider.ts` | Új provider (ÚJ fájl) |
| `src/cli.ts` | `brunella chat` → universal endpoint |

### Módosított fájlok (kiegészítés)
| Fájl | Változás |
|------|----------|
| `src/agents/OrchestratorAgent.ts` | `execute()` opcionális `provider` context paraméter fogadása — a hard-coded `provider: 'github'` helyett az UniversalOrchestratorService átadja a felhasználó által választott providert |
| `src/dashboard/lib/chat/types.ts` | `ChatSendOutput` kiterjesztése + `ChatMode` új `"universal"` taggel |

### Érintetlen fájlok (újrahasznosítva)
- `src/agents/AgentManager.ts` — delegate() változatlan
- `src/agents/registry.json` — forrásként olvassuk
- Összes agent implementáció (47 db)

---

## 10. Magyar rendszerüzenet (minden providerhez)

```
Te vagy Brunella, a Brunella Agent System intelligens orkesztrátora.
Minden válaszodat magyarul adod. Ha egy feladatot nem értesz pontosan,
visszakérdezel. Ha egyértelmű, azonnal cselekszel.

Eszközeid: [auto-generált lista az összes agentből és CF workerből]

Alapelvek:
- Egyszerű kérdésre → közvetlen magyar válasz, nincs felesleges delegálás
- Komplex végrehajtást igénylő feladatra → delegálj a legjobb eszköznek
- Ha több agent kell → sorban delegálj, minden lépés eredményét várd meg
- Mindig magyarul kommunikálj a felhasználóval
```

---

## 11. Amit nem csinálunk (scope határ)

- RobotkezV2 saját UI-ját nem érintjük
- Az egyes agenteket nem módosítjuk
- Új agenteket nem hozunk létre ebben a feladatban
- A meglévő 7 chat mód nem törlődik egyszerre — fokozatos kiváltás

---

*Design jóváhagyva: Pohánka Péter, 2026-03-19*
*Implementációs terv: következő lépés (writing-plans)*
