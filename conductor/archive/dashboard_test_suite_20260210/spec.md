# Dashboard Komplett Tesztsorozat

**Track ID:** `dashboard_test_suite_20260210`
**Prioritás:** HIGH
**Létrehozva:** 2026-02-10
**Státusz:** `frozen` (implementáció engedélyezve)

---

## 1. Célkitűzés

A Brunella Dashboard (localhost:5173) teljes tesztlefedettségének megteremtése. **Jelenleg 0 dashboard teszt létezik.** A tesztsorozat lefedi: navigáció, 10+4 sidebar tab, ~50 interaktív elem, API kapcsolatok, Socket.IO real-time funkciók, hibakezelés és stabilitás.

**Technológiai stack:**

- **E2E:** Playwright (böngészőben futó tesztek, valódi kattintások)
- **Komponens:** Vitest + jsdom + Testing Library (izolált React render)
- **API Mock:** MSW (Mock Service Worker)

---

## 2. Előfeltételek (Fázis 0)

### Dependencies

- `@playwright/test` — E2E tesztek
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` — komponens tesztek
- `jsdom` — Vitest environment React-hez
- `msw` — API mock

### Config fájlok

- `playwright.config.ts` — baseURL, webServer, timeout
- `vitest.dashboard.config.ts` — jsdom environment, dashboard include pattern

### Mappa struktúra

```
test/
├── dashboard/           ← komponens tesztek
│   ├── setup.ts
│   ├── mocks/
│   │   ├── handlers.ts
│   │   └── socket.ts
│   └── components/
│       └── *.test.tsx
└── e2e/                 ← Playwright E2E
    └── *.spec.ts
```

---

## 3. E2E Tesztek (Fázis 1-15)

### Fázis 1: Navigáció

| # | Teszt | Elvárt |
|---|-------|--------|
| 1.1 | Dashboard betöltés localhost:5173 | Renderel, nincs fehér képernyő |
| 1.2 | Sidebar 10 menüpont látható | Mind jelen van |
| 1.3 | Kattintás minden sidebar elemre | Panel cserélődik, nincs console error |
| 1.4 | Ctrl+K CommandMenu | Dialog megnyílik |
| 1.5 | Gyors tab-váltás (10x) | Nincs crash |

### Fázis 2: Mission Control

| # | Teszt | API | Elvárt |
|---|-------|-----|--------|
| 2.1 | Betöltés | GET /api/registry, /api/health | Agent kártyák megjelennek |
| 2.2 | List/Graph toggle | — | Nézet vált |
| 2.3 | SystemHealthCard | GET /api/health | Státuszok megjelennek |

### Fázis 3-12: Minden egyéb tab

*(Részletes tesztlista a plan.md-ben)*

### Fázis 13: Socket.IO Real-time

| # | Teszt | Elvárt |
|---|-------|--------|
| 13.1 | Kapcsolat jelző | isConnected állapot UI-ban |
| 13.2 | system:log event | TerminalLog frissül |
| 13.3 | agent:update event | Agent státusz változik |

### Fázis 14: Hibakezelés

| # | Teszt | Elvárt |
|---|-------|--------|
| 14.1 | Backend nem elérhető | ErrorBoundary, nem fehér képernyő |
| 14.2 | API 500 válasz | Toast error |
| 14.3 | Rossz JSON | Nem crash |

### Fázis 15: Stabilitás

| # | Teszt | Elvárt |
|---|-------|--------|
| 15.1 | 50x gyors tab-váltás | Nincs memory leak |
| 15.2 | Console error monitoring | 0 JS error |
| 15.3 | Responsive viewportok | Layout nem törik el |

---

## 4. Ismert Bugok (javítandó implementáció előtt)

1. **CommandMenu props hiánya** — `setActiveTab` nem adódik át MissionControlLayout.tsx L93-ban
2. **"Training indítása" gomb** — IncubatorPanel, nincs onClick handler
3. **"Download" gomb** — FileExplorer, nincs handler

---

## 5. Acceptance Criteria

- [ ] Fázis 0: Dependencies + config + mocks telepítve
- [ ] Fázis 1: Navigation E2E tesztek PASS
- [ ] Fázis 2-12: Tab-specifikus E2E tesztek PASS
- [ ] Fázis 13: Socket.IO tesztek PASS
- [ ] Fázis 14: Error handling tesztek PASS
- [ ] Fázis 15: Stabilitás tesztek PASS
- [ ] 3 ismert bug javítva
- [ ] `npm run build` 0 error
- [ ] `npm test` meglévő tesztek továbbra is PASS
- [ ] `npx playwright test` E2E tesztek PASS
