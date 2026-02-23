# Implementációs Terv: PAIOS PhoenixEventsPanel UI
**Track ID:** `paios_phoenix_events_panel_20260223`

> ⚠️ Előfeltétel ellenőrzés:
> - `src/core/phoenixEventBus.ts` létezik ✅
> - `src/server/SocketService.ts` létezik ✅
> - `src/dashboard/context/SocketContext.tsx` létezik ✅

---

## Phase 1: Backend — Phoenix → Socket.IO bekötés

* [ ] **Task 1.1** — `src/core/phoenixEventBus.ts` bővítése:
  - Importáld a `getSocketService`-t
  - Minden `emit()` után broadcast a dashboardra (lásd spec.md §2)
  - **Csak addálj, ne törölj meglévő logikát!**

* [ ] **Task 1.2** — Ellenőrizd hogy a meglévő checkpoint.ts / retryStrategy.ts
  hívja-e a phoenixEventBus `emit()`-et — ha nem, kösd be

---

## Phase 2: Frontend — PhoenixEventsPanel komponens

* [ ] **Task 2.1** — `src/dashboard/components/dashboard/PhoenixEventsPanel.tsx`
  - `useSocket()` hook (meglévő SocketContext-ből)
  - Feliratkozás: `phoenix:recovery`, `phoenix:restart`, `phoenix:state_restored`, `phoenix:checkpoint_saved`, `phoenix:error`
  - State: max 100 event (FIFO), legújabb elöl
  - Filter Bar: `all | recovery | restart | checkpoint | error`
  - Event sor: ikon + timestamp + type + agent + details

* [ ] **Task 2.2** — Event ikonok (Lucide React, már telepítve):
  - `recovery` → `CheckCircle` (zöld)
  - `restart` → `RefreshCw` (sárga)
  - `checkpoint_saved` → `Save` (kék)
  - `state_restored` → `RotateCcw` (lila)
  - `error` → `AlertCircle` (piros)

---

## Phase 3: Dashboard regisztráció

* [ ] **Task 3.1** — `src/dashboard/lib/navigation.tsx`:
  ```typescript
  navigationRegistry.registerItem({
    id: 'phoenix-events',
    label: 'Phoenix Events',
    icon: 'Flame',
    component: PhoenixEventsPanel,
    group: 'monitoring',
  });
  ```

* [ ] **Task 3.2** — Badge counter: hány `error` és `recovery` esemény volt az utolsó 1 órában

---

## Phase 4: Tesztek

* [ ] **Task 4.1** — `test/dashboard/PhoenixEventsPanel.test.tsx`
  - Mock Socket.IO: `phoenix:recovery` event → megjelenik a listában
  - Filter: `recovery` filter → csak recovery eventek látszanak
  - Max 100 limit: 101 event esetén a legrégebbit kiesik

* [ ] **Task 4.2** — `npm run build && npm test` → 0 hiba

---

## 🎯 Sikerességi Kritériumok

- Phoenix recovery / restart / checkpoint / error események megjelennek a Dashboard-on valós időben
- Filter működik típus szerint
- Max 100 event memóriában
- `npm run build` → 0 TypeScript hiba
- `npm test` → minden PASS
