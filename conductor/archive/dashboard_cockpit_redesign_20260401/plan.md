# Dashboard Cockpit Redesign + Stabilization

**Track ID:** `dashboard_cockpit_redesign_20260401`
**Cél:** a dashboard legyen újra használható, gyorsan olvasható, modern operator cockpit; közben a 3000/5173 működéshez szükséges build és teszt blokkolók is megszűnjenek.

---

## Feladatok

- [x] Track scaffold és redesign-spec létrehozása.
- [x] Backend build-blokkoló hibák javítása a 3000-es szerver újraépíthetőségéhez.
- [x] Dashboard tesztkör unblock (`jsdom`) és alap dashboard test config validálása.
- [x] MissionControl shell refaktor: top bar, sidebar, content canvas, bottom dock.
- [x] WidgetGrid refaktor: hierarchikus bento layout, kevesebb elsődleges kártya, jobb scanability.
- [x] Core widget polish: System Health, Agent State, Task Queue, Terminal rail.
- [x] API/socket polling keményítés a timeoutok és túl sűrű lekérdezések csökkentésére.
- [x] A/B experiment context megtisztítása és tesztelhetővé tétele.
- [x] Dashboard component tesztek írása a shellre és layout logikára.
- [x] Playwright smoke + kattintás + vizuális ellenőrzés frissítése az új shellre.
- [x] Build / test / smoke validáció és naplófrissítés.

## Állapotjegyzet (2026-04-01 17:10)

- Elkészült az új shell-alapú Mission Control cockpit (`MissionControlLayout`, `MissionControlHome`, letisztított `DynamicSidebar`, közvetlen `App` entrypoint).
- A dashboard tesztkör helyreállt: `jsdom` + Testing Library függőségek bekerültek, a stale tesztek újra lettek írva a jelenlegi komponensszerződésekhez.
- Verifikált állapot: `npm run build` ✅, `npm run build:ui` ✅, `npm run test:dashboard` ✅ (36/36 teszt), `npx playwright test test/e2e/mission-control-shell.spec.ts` ✅ (3/3 teszt).
- Nyitott maradt: a legacy `WidgetGrid` teljes kifésülése és a fő widgetek további vizuális/polish köre.

## Siker kritériumok

- `npm run build` újra zöld.
- `npm run build:ui` zöld.
- `npm run test:dashboard` futtatható és legalább az új shelltesztek zöldek.
- A Mission Control default nézete vizuálisan rendezett, nem túlzsúfolt, és tartja a kritikus információs hierarchiát.
- A dashboard offline/degraded állapotban sem omlik össze, hanem kulturált fallbacket mutat.
