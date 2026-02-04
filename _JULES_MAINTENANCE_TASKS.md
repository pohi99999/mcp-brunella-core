# Jules Async Agent - Karbantartási és Tesztelési Feladatok

**Projekt:** Brunella Agent System (BAS)
**Generálva:** 2026-02-04
**Készítette:** Claude Code (Opus 4.5)
**Jules Portal:** https://jules.google.com

---

## Áttekintés

Ez a dokumentum a Jules async agent számára készült, aki a Brunella Agent System automatizált karbantartását és tesztelését végzi. Jules napi 100 hívás kerettel rendelkezik, így a feladatokat priorizáltan kell végrehajtani.

---

## Napi Automatikus Tesztek (Prioritás: MAGAS)

### 1. Build Ellenőrzés
```bash
# Futtasd naponta
npm run build
```
**Elvárt:** Exit code 0, nincs TypeScript hiba

### 2. Unit Tesztek
```bash
npm test
```
**Elvárt:** Minden teszt PASS

### 3. Smoke Test
```bash
npm run smoke
```
**Elvárt:** Health check sikeres (Ollama, AnythingLLM, Agents)

---

## Heti Karbantartási Feladatok

### 1. Dependency Audit
```bash
npm audit
```
**Akció:** Ha CRITICAL vagy HIGH vulnerability van, készíts PR-t a javításra:
```bash
npm audit fix
```

### 2. Elavult Csomagok Ellenőrzése
```bash
npm outdated
```
**Akció:** Ha major version update van (pl. 3.x -> 4.x), ne frissíts automatikusan - csak jelentsd.

### 3. Python Dependency Check
```bash
cd myai
pip list --outdated
```

---

## CI/CD Hibajavító Feladatok

### Jules Self-Heal Workflow Trigger
Ha a CI (`ci.yml`) megbukik, a `jules-self-heal.yml` automatikusan aktiválódik.

**Jules feladata:**
1. Elemezd a hibát a workflow log-ból
2. Azonosítsd a root cause-t
3. Implementáld a fix-et
4. Készíts PR-t a javítással
5. Győződj meg róla, hogy a CI zölden fut

**Tipikus hibák és megoldások:**

| Hiba | Megoldás |
|------|----------|
| TypeScript compile error | Javítsd a típushibát |
| Test failure | Ellenőrizd a teszt logikát vagy a kódot |
| Import error | Ellenőrizd az ESM import útvonalakat (.js kiterjesztés) |
| Python syntax error | Javítsd a Python fájlt |

---

## Code Quality Feladatok

### 1. Unused Imports Eltávolítása
```bash
# Keress unused importokat
grep -r "import.*from" src/ | grep -v "// used"
```

### 2. Console.log Cleanup
```bash
# Production kódban ne legyen console.log
grep -rn "console.log" src/ --include="*.ts" | grep -v "test" | grep -v ".d.ts"
```
**Akció:** Cseréld `logInfo()` vagy `logError()` hívásokra (`src/utils/logger.ts`)

### 3. Any Type Audit
```bash
grep -rn ": any" src/ --include="*.ts" | grep -v ".d.ts"
```
**Akció:** Ahol lehet, adj konkrét típust

---

## Dokumentáció Szinkron Ellenőrzés

### 1. Track Státusz Validálás
Ellenőrizd, hogy `conductor/tracks.md` és `conductor/SUMMARY.md` összhangban van-e:
- Aktív track-ek száma egyezik
- Befejezett track-ek dátuma helyes

### 2. README és CLAUDE.md Konzisztencia
Ellenőrizd, hogy a parancsok és példák működnek-e:
```bash
# Teszteld a dokumentált parancsokat
npm run dev &
sleep 5
curl http://localhost:3000/api/health
```

---

## PR Review Segítség

Ha PR-t kell review-olni, ellenőrizd:

1. **Build sikeres?**
   ```bash
   npm run build
   ```

2. **Tesztek futnak?**
   ```bash
   npm test
   ```

3. **Típusok helyesek?**
   - Nincs új `any` típus
   - ESM importok `.js` kiterjesztéssel

4. **Kód stílus**
   - Logger használat `console.log` helyett
   - Error handling try/catch-csel

---

## Specifikus Fájlok Figyelése

### Kritikus Fájlok (változás esetén extra figyelem)
- `src/agents/AgentManager.ts` - Agent delegálás logika
- `src/core/llm_client.ts` - LLM kommunikáció
- `src/server/web.ts` - API endpoints
- `.github/workflows/*.yml` - CI/CD

### Gyakran Hibás Területek
- `src/agents/DynamicAgent.ts` - Konstruktor kompatibilitás
- `src/dashboard/context/SocketContext.tsx` - Socket kapcsolat
- `myai/browser_worker.py` - Playwright automatizáció

---

## Jelentési Formátum

Minden Jules futás végén készíts összefoglalót:

```markdown
## Jules Karbantartási Jelentés - [DÁTUM]

### Végrehajtott Ellenőrzések
- [ ] Build: PASS/FAIL
- [ ] Tesztek: PASS/FAIL (X/Y)
- [ ] Audit: X vulnerability

### Talált Problémák
1. [Probléma leírása]
   - Fájl: `path/to/file.ts`
   - Súlyosság: LOW/MEDIUM/HIGH/CRITICAL
   - Javasolt megoldás: ...

### Készített PR-ek
- #123: Fix TypeScript error in AgentManager
- #124: Update vulnerable dependency

### Következő Lépések
- [Ami nem sikerült vagy figyelmet igényel]
```

---

## Konfiguráció

### Environment Variables (szükséges a tesztekhez)
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
WEB_UI_ENABLED=0  # CI-ban ne indítson UI-t
```

### GitHub Actions Secrets (Jules-nak szüksége van rá)
- `JULES_API_KEY` - Jules autentikáció
- `GITHUB_TOKEN` - PR készítéshez (automatikusan elérhető)

---

## Kapcsolat

Ha Jules elakad vagy emberi beavatkozás szükséges:
1. Nyiss GitHub Issue-t `jules-needs-help` címkével
2. Részletezd a problémát és a próbált megoldásokat
3. Csatold a releváns log részleteket

---

*Generálta: Claude Code (Opus 4.5) - 2026-02-04*
*A feladatok a Brunella Agent System aktuális állapotára vonatkoznak.*
