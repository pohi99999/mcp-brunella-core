# Végrehajtási Terv: R2 Alapú Agent Artifact Tárolás

**Track ID:** `cf_r2_artifact_storage_20260323`
**Prioritás:** HIGH
**Becsült idő:** 5-7 nap
**Előfeltétel:** `cf_r2_activation_20260323` track teljesítése

---

## Fázis 1: R2Client utility osztály

- [ ] `src/utils/r2Client.ts` létrehozása
  - [ ] `uploadArtifact()` — strukturált kulccsal feltöltés
  - [ ] `downloadArtifact()` — letöltés kulcs alapján
  - [ ] `listArtifacts()` — listázás prefix alapján
  - [ ] `cleanupOldArtifacts()` — lifecycle policy implementáció
- [ ] Egységteszt: `test/utils/r2Client.test.ts`
- [ ] TypeScript típus definíciók: `R2ArtifactMetadata` interfész

## Fázis 2: Agent artifact feltöltés

- [ ] `BaseAgent` osztály bővítése `saveArtifact()` metódussal
- [ ] Graceful degradation: ha nincs R2 binding, a feltöltés kihagyásra kerül
- [ ] Agent futási log automatikus feltöltése minden agent futás végén
- [ ] Egységteszt a `saveArtifact()` logikára

## Fázis 3: Screenshot tárolás böngésző agent-ekhez

- [ ] `RobotkezV2` agent módosítása: screenshot-ok R2-be mentése
- [ ] Tömörítés: PNG → WebP konverzió méretcsökkentéshez
- [ ] Lépésenként elnevezés: `step-{index}-{action}.png`
- [ ] Integrációs teszt böngésző feladattal

## Fázis 4: Log archiválás pipeline

- [ ] Cron trigger (Cloudflare Cron) a napi log archiváláshoz
- [ ] Lokális log fájlok → R2 feltöltés → lokális törlés
- [ ] Lifecycle policy implementáció (30/14/90 napos szabályok)
- [ ] Monitoring: napi archiválás sikeresség ellenőrzés

## Fázis 5: Dashboard R2 böngésző panel

- [ ] Worker API endpoint-ok:
  - [ ] `GET /api/r2/list` — fájl listázás
  - [ ] `GET /api/r2/download/:key` — fájl letöltés
  - [ ] `DELETE /api/r2/cleanup` — kézi cleanup
- [ ] React komponens: `src/dashboard/components/R2Browser.tsx`
  - [ ] Fa nézet az R2 struktúráról
  - [ ] Szűrők: agent, dátum, artifact típus
  - [ ] Screenshot előnézet
  - [ ] Log tartalom megjelenítés
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

- Az `R2Client` osztály tesztekkel lefedve és működik
- Minden agent futás után az artifact automatikusan R2-be kerül
- A RobotkezV2 screenshotok elérhetők az R2-ből
- A log archiválás pipeline naponta fut
- A dashboard R2 böngésző panel megjeleníti az artifact-okat
