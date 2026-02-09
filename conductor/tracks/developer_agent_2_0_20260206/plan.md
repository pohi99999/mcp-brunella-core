# Track: DeveloperAgent 2.0 - Self-Healing AI Developer

**Track ID:** `developer_agent_2_0_20260206`
**Created:** 2026-02-06
**Status:** ACTIVE
**Priority:** HIGH
**Owner:** Claude

---

## 🎯 Cél

Stabil, öngyógyító fejlesztő ügynök létrehozása, ami:

- Automatikusan kódot generál (GPT-4o)
- Teszteket ír (Vitest)
- Hibákat javít (self-healing)
- CLI-központú (brunella CLI integráció)

---

## 📋 Fázisok

### 📌 Legutóbbi validáció (2026-02-11)

- `npm run build` ✅
- `npm test` (361/361 PASS) ✅
- `npm run smoke` ⚠️ Hiányzó `ANYTHINGLLM_API_KEY` és `WEB_UI_ENABLED=0` miatt AnythingLLM 403 + UI tiltott; Node szerver stdio ping OK

### ✅ Fázis 1: Core Implementation (DONE - 2026-02-06)

**Időtartam:** 1 óra

**Feladatok:**

- [x] DeveloperAgent 2.0 teljes átírás (~400 sor)
- [x] GPT-4o integráció (GitHub Models)
- [x] Kód generálás LLM-mel
- [x] Teszt generálás (Vitest)
- [x] Hiba javítás (self-healing)
- [x] Build & Test loop (retry logic)
- [x] Git műveletek (commit, branch)
- [x] Python kód futtatás

**Funkciók:**

```typescript
- handleCodeGeneration()    // Kód generálás GPT-4o-val
- handleTestGeneration()    // Vitest teszt generálás
- handleErrorFix()          // Automatikus hiba javítás
- handlePythonExecution()   // Python kód futtatás
- handleGitOperation()      // Git commit/branch
- selfHealBuild()           // Build hiba auto-fix (3 retry)
```

**Használt technológiák:**

- GPT-4o (GitHub Models API)
- LangSmith tracing (automatikus)
- TypeScript + ESM
- Vitest (tesztelés)
- Python FastAPI (myai/ alrendszer)

---

### ⏳ Fázis 2: CLI Integráció (TODO)

**Időtartam:** 30 perc

**Feladatok:**

- [ ] CLI parancsok hozzáadása:

  ```bash
  brunella dev generate "create function X"
  brunella dev test "generate tests for file Y"
  brunella dev fix "fix error in file Z"
  brunella dev commit "commit with message M"
  ```

- [ ] Interaktív mód (src/interactive.ts) bővítés
- [ ] VIP menü "Developer" almenü

---

### ⏳ Fázis 3: Memory Bank (LanceDB) (TODO)

**Időtartam:** 1 óra

**Feladatok:**

- [ ] Hiba-javítás párok tárolása LanceDB-ben
- [ ] Pattern matching (hasonló hibák detektálása)
- [ ] Success rate tracking
- [ ] Auto-apply ismert javítások

**Interfész:**

```typescript
interface FixMemory {
  errorPattern: string;
  solution: string;
  successRate: number;
  timestamp: Date;
  context: Record<string, any>;
}
```

---

### ⏳ Fázis 4: MCP Tool Integráció (TODO)

**Időtartam:** 30 perc

**Feladatok:**

- [ ] GitHub MCP tool használat (PR, issue)
- [ ] LangSmith MCP tool (tracing)
- [ ] n8n workflow trigger (automatizálás)

---

### ⏳ Fázis 5: Dashboard Integráció (OPTIONAL)

**Időtartam:** 1 óra

**Feladatok:**

- [ ] Developer panel a Dashboard-on
- [ ] Live code generation preview
- [ ] Build status widget
- [ ] Commit history

---

## 🧪 Tesztelési Terv

### Unit Tesztek

```bash
test/developer_agent_2_0.test.ts
- Kód generálás teszt
- Teszt generálás teszt
- Hiba javítás teszt
- Self-healing teszt
```

### Integrációs Tesztek

```bash
# CLI-ből
brunella dev generate "create add function"
brunella dev test "generate tests for src/utils/math.ts"
brunella dev fix "fix build error in src/agents/X.ts"
```

### Validáció

- [ ] Build sikeres (npm run build)
- [ ] Tesztek átmennek (npm test)
- [ ] GPT-4o válaszol 30s-en belül
- [ ] Self-healing max 3 kísérlet alatt javít

---

## 📊 Sikermetrikák

| Metrika | Cél | Státusz |
|---------|-----|---------|
| Kód generálási siker | >90% | - |
| Build auto-fix siker | >70% | - |
| Átlagos válaszidő | <30s | - |
| Teszt lefedettség | >80% | - |

---

## 🔗 Kapcsolódó Fájlok

| Fájl | Leírás |
|------|--------|
| `src/agents/DeveloperAgent.ts` | Fő implementáció (v2.0) |
| `src/core/llm_client.ts` | GPT-4o integráció |
| `src/cli.ts` | CLI belépési pont |
| `src/interactive.ts` | Interaktív CLI mód |
| `test/developer_agent_2_0.test.ts` | Unit tesztek |

---

## 🚧 Blocker-ek és Kockázatok

| Blocker | Megoldás |
|---------|----------|
| GitHub token hiányzik | `gh auth login` vagy GITHUB_TOKEN env |
| GPT-4o rate limit | Fallback Ollama-ra |
| Build timeout | Növeld LLM_TIMEOUT_MS env-t |

---

## 📝 Megjegyzések

- GPT-4o korlátlan GitHub Pro+ előfizetéssel
- LangSmith tracing automatikus (LANGCHAIN_API_KEY)
- Self-healing max 3 retry (konfigurálható)
- CLI-központú, de Dashboard bővíthető

---

## 🎯 Következő Lépések

1. **Build & Test** - Ellenőrizd hogy minden működik
2. **CLI Teszt** - Próbáld ki CLI-ből:

   ```bash
   brunella agent Developer "generate function add(a, b)"
   ```

3. **Fázis 2** - CLI parancsok hozzáadása
4. **Fázis 3** - Memory Bank (LanceDB)

---

**Utolsó frissítés:** 2026-02-06
**Státusz:** ✅ Fázis 1 DONE, Fázis 2-5 TODO
