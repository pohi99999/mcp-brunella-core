# Track: Dashboard TODO Widget (Real-time Track Progress)

**Status:** IN_PROGRESS (Iteration 1: Dashboard + CLI + API ✅)
**Priority:** P2
**Complexity:** MEDIUM
**Created:** 2026-02-11
**Owner:** Claude

## 🎯 Cél

Dashboard widget a track TODO listák real-time megjelenítésére. WebSocket sync a track.md fájlokkal, progress bar, checkbox interaktivitás.

## ✅ Acceptance Criteria

1. Dashboard widget (Card komponens)
2. Active track-ek listája (TODO checklist)
3. Progress bar (completed/total)
4. Checkbox toggle (mark as done)
5. WebSocket real-time sync (track.md változás → widget frissül)
6. **CLI:** Track progress lekérdezés (magyar)

## 🔧 Technikai Követelmények

### Dashboard

- Widget: `src/dashboard/components/dashboard/TrackProgress.tsx`
- Bekötés: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (jobb oldali widget oszlop)

```typescript
interface TrackTodo {
  trackName: string;
  status: string;
  todos: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  progress: number; // 0-100
}
```

**UI elemek:**

- Track dropdown (active track-ek)
- TODO checklist (interactive)
- Progress bar (shadcn/ui)
- "Frissítés" button (manual reload)
- WebSocket connection status

### Backend

Megvalósítás: `src/server/tracksRoutes.ts` (EPP v2: közös API Dashboard + CLI)

- `GET /api/v1/tracks/todos/active` → aktív track summary (progress + counts)
- `GET /api/v1/tracks/:trackId/todos` → checkbox TODO parse
- `PATCH /api/v1/tracks/:trackId/todos/:todoId` → checkbox toggle (id: `line:<n>`)

Real-time frissítés:

- Socket.IO események (best-effort poll watcher, nincs új dependency):
  - `track:changed`
  - `track:todo_updated`

### CLI

- Parancs: `brunella progress` (magyar menü)
- Implementáció: `src/cli/progressCommands.ts`

```text
1. 📊 Track progress (választott track)
2. 📈 Összes track progress
3. ✅ TODO kipipálása
4. 🔙 Vissza
```

## 📋 Implementation Plan

### Phase 1: Backend Parser

- [x] Track.md checkbox parser
- [x] GET /api/v1/tracks/:trackId/todos
- [x] PATCH /api/v1/tracks/:trackId/todos/:todoId
- [x] File write back (track.md update)
- [x] Aktív track summary: GET /api/v1/tracks/todos/active

### Phase 2: Dashboard Widget

- [x] TrackProgress widget komponens
- [x] Track dropdown + TODO list UI
- [x] Progress bar (shadcn/ui)
- [x] Checkbox toggle handler
- [x] Dashboard integráció

### Phase 3: WebSocket Sync

- [x] Socket.IO események: `track:changed`, `track:todo_updated`
- [x] Poll watcher (setInterval + mtime) a track.md változásokhoz
- [ ] Reconnect logic (SocketContext alapból reconnectel)

### Phase 4: CLI Commands

- [x] Magyar progress parancs: `brunella progress`
- [x] Track selection menü
- [x] TODO display + toggle
- [x] ASCII progress bar
- [x] CLI regisztráció (`src/cli.ts`)

### Phase 5: Testing

- [x] Checkbox toggle + parser test: `test/tracks_todos_routes.test.ts`
- [ ] WebSocket sync test (opcionális)
- [ ] CLI test (opcionális)
- [x] npm test

### Phase 6: Deployment

- [ ] README.md frissítés
- [ ] GitHub commit

## 📝 Implementation Prompt

```text
Dashboard TODO Widget implementálás:

Backend:
- Track.md checkbox parser
- GET/PATCH todos endpoints
- WebSocket server (chokidar file watch)

Dashboard:
- TrackProgress.tsx widget
- Interactive checklist
- Progress bar
- WebSocket real-time sync

CLI:
- Magyar progress parancsok
- Track selection menu
- ASCII progress bar
```
