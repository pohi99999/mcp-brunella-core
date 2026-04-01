# Dashboard Cockpit Redesign + Stabilization Spec

## Probléma

A jelenlegi dashboard shell vizuálisan széttartó, túl sok felsőszintű felületet próbál egyszerre megjeleníteni, miközben a kritikus működési élmény több ponton sérül:

- a default dashboard túlzsúfolt és nem operator-cockpit jellegű,
- a shell és a widgetek több design-nyelvet kevernek,
- a frontend oldalon a polling/socket réteg túl agresszív és timeout-érzékeny,
- a dashboard testkör jelenleg `jsdom` hiány miatt blokkolt,
- a backend buildhibák miatt a 3000-es szerver útvonala jelenleg nem verifikálható stabilan.

## Célállapot

A Mission Control legyen egy prémium dark, jól szkennelhető operator cockpit:

1. **Shell-first kialakítás** — rendezett top bar, strukturált bal oldali navigáció, központi bento canvas, alsó log dock.
2. **Hierarchikus információs rétegzés** — globális státusz, primer operatív kártyák, másodlagos telemetria.
3. **Graceful degraded élmény** — ha a backend nem elérhető vagy lassú, a dashboard ne omoljon össze, hanem egyértelmű fallback állapotot mutasson.
4. **Tesztelhető shell** — stabil `data-testid` felületek, smoke/E2E-barát markup.
5. **Build- és tesztállapot javítása** — dashboard tesztkör és backend build unblock.

## In Scope

- `src/dashboard/App.tsx`
- `src/dashboard/components/dashboard/MissionControlLayout.tsx`
- `src/dashboard/components/dashboard/WidgetGrid.tsx`
- `src/dashboard/components/dashboard/DynamicSidebar.tsx`
- `src/dashboard/components/dashboard/SystemHealthCard.tsx`
- `src/dashboard/components/dashboard/AgentStatusMonitor.tsx`
- `src/dashboard/components/dashboard/TaskQueueMonitor.tsx`
- `src/dashboard/components/dashboard/TerminalLog.tsx`
- `src/dashboard/context/ExperimentContext.tsx`
- `src/dashboard/context/SocketContext.tsx`
- `src/dashboard/hooks/useSystemSignal.ts`
- `src/dashboard/index.css`
- `src/dashboard/styles/theme.css`
- minimális backend unblock fájlok a 3000-es buildhez
- dashboard component és Playwright smoke/E2E tesztek

## Out of Scope

- minden dashboard panel teljes újraírása,
- navigációs registry teljes funkcionális újratervezése az összes 70+ panel szintjén,
- backend feature-bővítés a dashboard redesigntól független területeken.

## Acceptance Criteria

- A default Mission Control nézet 5–7 elsődleges zónára egyszerűsödik.
- A top barból kikerülnek a zajos utility shortcutok; a shell fókusza operator státusz és vezérlés.
- A sidebar vizuálisan tisztább, jobban csoportosított és keyboard-nav kompatibilis.
- A System Health, Agent State és Task Queue widgetek konzisztens card-anatómiát kapnak.
- A dashboard shell rendelkezik stabil teszt hookokkal (`data-testid`).
- A `test:dashboard` futtatható.
- A backend buildhibák javítva vannak, hogy a 3000-es út ismét validálható legyen.
