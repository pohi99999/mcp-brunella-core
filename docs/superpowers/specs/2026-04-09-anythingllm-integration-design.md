# Design: Brunella–AnythingLLM Desktop Integration

**Dátum:** 2026-04-09  
**Track:** `brunella-anythingllm-desktop-integration`  
**Státusz:** Jóváhagyva

---

## Cél

AnythingLLM Desktop kényelmi UI cockpitként szolgál a napi Brunella műveletekhez. A felhasználó custom action gombokkal indít feladatokat — Brunella dönt és hajt végre, az eredmény visszakerül az AnythingLLM chatbe.

## Probléma

Nincs egységes, kényelmes UI a napi Brunella agent-műveletek indításához. Az AnythingLLM Desktop már nyitva van, így természetes belépési pont.

---

## Architektúra

```
AnythingLLM Desktop
  └─► POST /api/v1/anythingllm/action
        ├── Auth: X-Brunella-Secret header (BRUNELLA_ACTION_SECRET .env-ből)
        ├── Action Router (src/server/routes/anythingllmActions.ts)
        │     ├── email_triage      → InvoiceAutomationAgent
        │     ├── calendar_check    → OrchestratorAgent (calendar context)
        │     ├── document_summary  → ResearcherAgent
        │     ├── browser_task      → RobotkezV2Agent
        │     └── agent_start       → AgentManager.delegate()
        ├── Audit logger (in-memory, utolsó 50 rekord)
        └─► JSON válasz → AnythingLLM chatbe

Dashboard
  └─► AnythingLLMActionBridgePanel (Integration kategória)
        ├── Státusz + endpoint info
        ├── Tesztelő form
        └─► Audit log táblázat (HIGH_RISK kiemelve)
```

---

## Kérés/válasz formátum

### Action kérés
```json
POST /api/v1/anythingllm/action
Headers: {
  "X-Brunella-Secret": "<BRUNELLA_ACTION_SECRET>",
  "Content-Type": "application/json"
}
Body: {
  "action": "email_triage",
  "payload": {
    "task": "Feldolgozd a mai bejövő emaileket",
    "context": {}
  }
}
```

### Sikeres válasz
```json
{
  "success": true,
  "action": "email_triage",
  "agent": "InvoiceAutomation",
  "result": "3 email feldolgozva, 1 számla rögzítve.",
  "riskLevel": "normal",
  "auditId": "act_1712620800_email"
}
```

### Auth hiba
```json
HTTP 401
{ "error": "Unauthorized", "hint": "X-Brunella-Secret header hiányzik vagy érvénytelen" }
```

### Ismeretlen action
```json
HTTP 400
{ "error": "Unknown action: 'foo'", "supported": ["email_triage","calendar_check","document_summary","browser_task","agent_start"] }
```

---

## Action → Agent mapping

| Action | Agent | Risk |
|--------|-------|------|
| `email_triage` | InvoiceAutomationAgent | normal |
| `calendar_check` | OrchestratorAgent | normal |
| `document_summary` | ResearcherAgent | normal |
| `browser_task` | RobotkezV2Agent | **high** |
| `agent_start` | AgentManager.delegate() | **high** |

---

## Audit

- **Tárolás:** In-memory ring buffer, utolsó 50 rekord (SQLite-ra bővíthető)
- **Rekord struktúra:**
  ```ts
  {
    id: string;           // "act_<timestamp>_<action>"
    timestamp: string;    // ISO 8601
    action: string;
    agent: string;
    payloadSummary: string; // task első 100 karaktere
    resultSummary: string;  // result első 200 karaktere
    riskLevel: "normal" | "high";
    durationMs: number;
    success: boolean;
  }
  ```
- **Lekérdezés:** `GET /api/v1/anythingllm/action/audit`

---

## Dashboard panel

**Komponens:** `src/dashboard/components/dashboard/AnythingLLMActionBridgePanel.tsx`  
**Navigáció:** Integration kategória, `anythingllm-bridge` id

Tartalom:
1. **Státusz sor** — endpoint aktív-e, secret konfigurálva-e
2. **Tesztelő form** — action választó + task mező + futtatás gomb
3. **Audit log táblázat** — timestamp, action, agent, result összefoglaló, riskLevel (HIGH = narancs), success jelző

---

## Új fájlok

| Fájl | Tartalom |
|------|----------|
| `src/server/routes/anythingllmActions.ts` | Action endpoint, router, auth, audit |
| `src/dashboard/components/dashboard/AnythingLLMActionBridgePanel.tsx` | Dashboard panel |

## Módosított fájlok

| Fájl | Változás |
|------|----------|
| `src/server/routes/index.ts` | `/anythingllm/action` route regisztráció |
| `src/dashboard/lib/navigation.tsx` | Panel regisztráció |
| `src/dashboard/lib/apiService.ts` | `executeAnythingLLMAction()`, `getAnythingLLMActionAudit()` |
| `.env.example` | `BRUNELLA_ACTION_SECRET` dokumentálás |
| `conductor/tracks/.../meta.json` | status: active |

---

## Tesztek (Vitest)

- Auth: érvénytelen / hiányzó secret → 401
- Ismeretlen action → 400
- `email_triage` → InvoiceAutomationAgent delegálás (mock)
- `browser_task` → `riskLevel: "high"` az audit rekordban
- `agent_start` → AgentManager.delegate() hívás
- Audit endpoint → visszaadja a logolt rekordokat

---

## AnythingLLM Desktop konfiguráció

```
Action URL:  http://localhost:3000/api/v1/anythingllm/action
Header név:  X-Brunella-Secret
Header érték: <.env BRUNELLA_ACTION_SECRET értéke>
```

---

## Elfogadási kritériumok

- [ ] `POST /api/v1/anythingllm/action` mind az 5 action-t végrehajtja
- [ ] Auth nélküli kérés → 401
- [ ] HIGH_RISK műveletek auditban megjelölve
- [ ] Dashboard panel mutatja az audit logot
- [ ] `npm run build` + `npm run test:fast` zöld
