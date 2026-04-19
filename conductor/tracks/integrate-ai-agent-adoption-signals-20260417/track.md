# Integrate AI Agent Adoption Signals

**Track ID:** `integrate-ai-agent-adoption-signals-20260417`
**Priority:** P1
**Progress:** 0%
**Created:** 2026-04-17
**Estimated Time:** 27 hours

---

## 🎯 Cél

Integrate AI agent research adoption signals into Brunella's daily briefing pipeline, providing deterministic adopt/prototype/watch classifications on existing briefing surfaces.

## 📋 Feladatok (TODO)

### Phase 1: Phase 1: Tervezés és Specifikáció
- [ ] Specifikálja az AI ügynök örökbefogadási jelek forrásait és adatmodelljét. (60 min)
- [ ] Tervezze meg a determinisztikus osztályozási algoritmust (adopt/prototype/watch). (90 min)
- [ ] Határozza meg a meglévő összefoglaló pipeline-nal való integrációs pontokat. (45 min)

### Phase 2: Phase 2: Mag Implementáció
- [ ] Valósítsa meg az örökbefogadási jelek adatbetöltési mechanizmusát. (120 min)
- [ ] Implementálja az osztályozási logika motorját. (180 min)
- [ ] Hozzon létre adatperzisztenciát az osztályozott jelek számára. (90 min)
- [ ] Írjon egység- és integrációs teszteket a magfunkciókhoz. (120 min)

### Phase 3: Phase 3: Briefing Pipeline Integráció
- [ ] Integrálja az osztályozott adatokat a napi összefoglaló adatfolyamába. (120 min)
- [ ] Biztosítsa az adatok frissességét és az ütemezett frissítési mechanizmusokat. (90 min)

### Phase 4: Phase 4: Irányítópult Integráció
- [ ] Fejlesszen ki egy új komponenst az irányítópult összefoglaló paneljéhez. (180 min)
- [ ] Jelenítse meg vizuálisan az 'adopt/prototype/watch' osztályozásokat. (90 min)
- [ ] Integrálja a komponenst a meglévő irányítópult keretrendszerrel. (60 min)

### Phase 5: Phase 5: CLI Eszközök
- [ ] Implementáljon CLI parancsot az AI ügynök örökbefogadási jeleinek megtekintéséhez. (120 min)
- [ ] Implementáljon CLI parancsot az osztályozási szabályok konfigurálásához. (90 min)

### Phase 6: Phase 6: Dokumentáció és Tesztelés
- [ ] Frissítse a rendszer és API dokumentációt. (60 min)
- [ ] Végezzen végpontok közötti (E2E) tesztelést. (90 min)

## ✅ Acceptance Criteria

- [ ] Dashboard integráció kész (New dashboard panel component displaying AI agent adoption signals, with visual indicators for adopt/prototype/watch classifications.)
- [ ] CLI integráció kész (Egy `bas agent signals` parancs lekérdezi és megjeleníti az AI ügynökök aktuális örökbefogadási jeleit, és osztályozásukat (adopt/prototype/watch).)
- [ ] `npm test` - All tests passing (0 errors)
- [ ] `npm run build` - Clean build (0 TypeScript errors)
- [ ] EPP v2 compliance: 7 Arany Szabály követve
- [ ] Documentation updated (.ai/claude.md + FOSZAL.md)

## 🔗 Integrációk

### Dashboard
New dashboard panel component displaying AI agent adoption signals, with visual indicators for adopt/prototype/watch classifications.

**Component:** `src/dashboard/components/[ComponentName].tsx`

### CLI
Egy `bas agent signals` parancs lekérdezi és megjeleníti az AI ügynökök aktuális örökbefogadási jeleit, és osztályozásukat (adopt/prototype/watch).

**Command:** `brunella [command-name]`
**File:** `src/cli/[commandName]Commands.ts`

## 📝 Notes

- **EPP v2 Protocol:** This track follows the 7 Arany Szabály (Golden Rules)
- **Testing:** Unit + Integration tests required
- **Documentation:** Update .ai/claude.md work log after completion

---

**Status:** Ready for Implementation ✅
**Next Step:** Begin Phase 1

---