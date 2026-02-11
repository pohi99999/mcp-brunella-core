# Track: Dashboard TODO Widget (Real-time Track Progress)

**Status:** PROPOSED
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

### Dashboard: src/dashboard/components/TrackProgress.tsx
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

### Backend: src/server/routes/track-progress.ts
- GET /api/tracks/:name/todos → Parse track.md checkboxes
- PATCH /api/tracks/:name/todos/:id → Toggle checkbox
- WebSocket /ws/track-progress → Real-time updates

### CLI: src/cli-commands/progress-hu.ts
```
1. 📊 Track progress (választott track)
2. 📈 Összes track progress
3. ✅ TODO kipipálása
4. 🔙 Vissza
```

## 📋 Implementation Plan

### Phase 1: Backend Parser
- [ ] Track.md checkbox parser
- [ ] GET /api/tracks/:name/todos handler
- [ ] PATCH checkbox toggle handler
- [ ] File write back (track.md update)

### Phase 2: Dashboard Widget
- [ ] TrackProgress.tsx komponens
- [ ] Track dropdown + TODO list UI
- [ ] Progress bar komponens
- [ ] Checkbox toggle handler
- [ ] Dashboard integráció

### Phase 3: WebSocket Sync
- [ ] WebSocket server setup (/ws/track-progress)
- [ ] File watcher (chokidar)
- [ ] track.md change → broadcast
- [ ] Client reconnect logic

### Phase 4: CLI Commands
- [ ] progress-hu.ts létrehozás
- [ ] Track selection menu
- [ ] TODO display + toggle
- [ ] Progress bar (CLI ascii)
- [ ] CLI regisztráció

### Phase 5: Testing
- [ ] Checkbox toggle test
- [ ] WebSocket sync test
- [ ] CLI test
- [ ] npm test

### Phase 6: Deployment
- [ ] README.md frissítés
- [ ] GitHub commit

## 📝 Implementation Prompt

```
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
