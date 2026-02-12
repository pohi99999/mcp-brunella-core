# Track: Engineering Precision Protocol v2 (EPP v2)

**Status:** PROPOSED
**Priority:** P0
**Complexity:** LOW
**Created:** 2026-02-11
**Owner:** Claude

## 🎯 Cél

Engineering Precision Protocol frissítése v2-re. **Új kötelező szabály:** Minden új funkció = Dashboard + CLI integráció (magyar nyelven, menüvezérelt).

## ✅ Acceptance Criteria

1. EPP v2 dokumentáció létrehozása (conductor/epp-v2.md)
2. Dashboard + CLI integráció szabály dokumentálása
3. Track template frissítés (új checklist)
4. README.md frissítés (EPP v2 hivatkozás)
5. .ai/FOSZAL.md frissítés (protokoll változás)

## 🔧 EPP v2 Főbb Szabályok

### 1. NINCS KÓDÍRÁS TRACK NÉLKÜL ❌→✅
- Ad-hoc kódolás tiltva
- Minden feature = `conductor/tracks/<name>/track.md`
- SpecWriterAgent használat (ötlet → track)

### 2. HIBÁK KÖTELEZŐ JAVÍTÁSA 🐛
- Fejlesztés közben talált hibák AZONNAL javítandók
- Regression teszt hozzáadása
- Track.md "Bugs Fixed" szekció frissítése

### 3. GITHUB COMMIT MINDEN MAJOR LÉPÉS UTÁN 📝
- Track Phase befejezése → Git commit
- Commit formátum: `feat(track-name): [phase] Brief`
- Minden commit után: `npm test` MUST PASS

### 4. TODO LISTA KÖTELEZŐ ✅
- Track.md checkbox lista
- CLI: `brunella tracks status <name>`
- Dashboard: TODO widget real-time

### 5. MINDEN TESZT ZÖLD BEFEJEZÉSHEZ 🧪
- TESTING → COMPLETED csak ha:
  - npm run build ✅
  - npm test 100% ✅
  - Manual testing ✅
  - Acceptance criteria ✅

### 6. DASHBOARD + CLI INTEGRÁCIÓ KÖTELEZŐ 🎨+🖥️
**ÚJ SZABÁLY!**
- Minden új funkció Dashboard komponenst kap
- Minden új funkció CLI parancsot kap (magyar, menüvezérelt)
- Track.md checklist tartalmazza mindkettőt
- Ha valamelyik elmarad → Track nem COMPLETED

### 7. FINAL COMMIT + DOCS 🎉
- Track COMPLETED után:
  - Git commit: `feat: Complete track-name`
  - Update `.ai/<agent>.md`
  - Run `python scripts/sync_foszal.py`
  - Update `conductor/tracks.md` status

## 📋 Implementation Plan

### Phase 1: Dokumentáció
- [ ] conductor/epp-v2.md létrehozása
- [ ] Minden szabály részletezése
- [ ] Példák hozzáadása
- [ ] Track template frissítés

### Phase 2: README Frissítés
- [ ] README.md EPP v2 szekció
- [ ] Dashboard + CLI szabály kiemelése
- [ ] Quick Reference táblázat

### Phase 3: FOSZAL Frissítés
- [ ] .ai/FOSZAL.md új bejegyzés
- [ ] EPP v2 bevezetés dokumentálása
- [ ] sync_foszal.py futtatás

### Phase 4: Testing
- [ ] Manual review (minden dokumentum)
- [ ] Consistency check
- [ ] GitHub commit

## 📝 Implementation Prompt

```
EPP v2 Protocol dokumentálás:

conductor/epp-v2.md:
- 7 fő szabály részletezése
- ÚJ: Dashboard + CLI integráció kötelező
- Példák minden szabályhoz
- Track template checklist

README.md:
- EPP v2 Quick Reference
- Dashboard + CLI szabály kiemelés

.ai/FOSZAL.md:
- EPP v2 bevezetés dokumentálása
- Dátum: 2026-02-11
```

---

## 📝 Napló

### 2026-02-12

- Meta/progress drift rendezés végrehajtva a `conductor/tracks/*` alatt:
  - hiányzó `meta.json` fájlok pótlása (nem-test trackek)
  - progress összehangolás (pl. `bas_comprehensive_test_protocol_20260210`: 65 → 85)
- `ProjectConductor "track update"` futtatva → `conductor/tracks.md` újragenerálva és konzisztens.
- Teszt artefakt takarítás: `test-track-12345678` kikerült a registry-ből.
